// lib/twitter/twitter-client.ts

import { TwitterApi, TwitterApiReadOnly, TweetV2, UserV2 } from 'twitter-api-v2';
import { TwitterTweet, TwitterUser, TweetWithEngagement } from '../../types/twitter';
import { getXAccountConfig } from '../../config/data-sources-config';
import { envConfig } from '../../config/environment';
import logger from '../logger';
import { ProgressTracker } from '../../utils/progress';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

export class TwitterClient {
  private client: TwitterApiReadOnly;
  private rateLimitInfo: Map<string, RateLimitInfo> = new Map();

  constructor() {
    // For Twitter API v2, we need Bearer Token for OAuth 2.0 Application-Only auth
    const bearerToken = process.env.X_BEARER_TOKEN;
    const apiKey = process.env.X_API_KEY;
    const apiSecret = process.env.X_API_SECRET;

    // Try Bearer Token first (recommended for v2 API)
    if (bearerToken) {
      this.client = new TwitterApi(bearerToken).readOnly;
    } 
    // Fallback to App Key/Secret (OAuth 1.0a style)
    else if (apiKey && apiSecret) {
      this.client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
      }).readOnly;
    } 
    else {
      throw new Error('Missing Twitter API credentials. Need either X_BEARER_TOKEN or both X_API_KEY and X_API_SECRET in .env.local file.');
    }

    logger.info('Twitter client initialized with proper authentication');
  }

  /**
   * Fetch tweets from a specific user
   */
  async fetchUserTweets(username: string): Promise<TweetWithEngagement[]> {
    // Check API quota before starting expensive operations
    await this.checkApiQuota();
    
    const config = getXAccountConfig(username);
    const progress = new ProgressTracker({
      total: config.maxPages,
      label: `Fetching tweets from @${username}`
    });

    try {
      // Check rate limits before starting
      await this.checkRateLimit('users/by/username/:username/tweets');

      // Get user info first
      const user = await this.getUserByUsername(username);
      if (!user) {
        throw new Error(`User @${username} not found`);
      }

      const allTweets: TweetWithEngagement[] = [];
      let nextToken: string | undefined;
      let pagesProcessed = 0;

      // Paginate through tweets (with conservative limits)
      const maxPagesForTesting = Math.min(config.maxPages, 2); // Limit to 2 pages for testing
      for (let page = 0; page < maxPagesForTesting; page++) {
        progress.update(page + 1);

        const tweets = await this.fetchTweetPage(user.id, {
          max_results: Math.min(config.tweetsPerRequest, 10), // Limit to 10 tweets per request
          pagination_token: nextToken,
        });

        if (!tweets.data?.data?.length) {
          logger.info(`No more tweets found for @${username} on page ${page + 1}`);
          break;
        }

        // Process and filter tweets
        const processedTweets = tweets.data.data
          .map((tweet: TweetV2) => this.enhanceTweet(tweet, user))
          .filter((tweet: TweetWithEngagement) => this.passesQualityFilter(tweet, config));

        allTweets.push(...processedTweets);
        pagesProcessed = page + 1;

        // Check if there are more pages
        nextToken = tweets.meta?.next_token;
        if (!nextToken) break;

        // Respect rate limits with longer delays
        await this.waitForRateLimit();
      }

      progress.complete(`Collected ${allTweets.length} quality tweets from @${username}`);

      logger.info(`Successfully fetched tweets from @${username}`, {
        total_tweets: allTweets.length,
        pages_fetched: pagesProcessed,
        api_calls_used: pagesProcessed + 1 // +1 for user lookup
      });

      return allTweets;

    } catch (error: any) {
      progress.fail(`Failed to fetch tweets from @${username}: ${error.message}`);
      logger.error(`Twitter API error for @${username}`, error);
      throw error;
    }
  }

  /**
   * Get user information by username
   */
  private async getUserByUsername(username: string): Promise<TwitterUser | null> {
    try {
      const response = await this.client.v2.userByUsername(username, {
        'user.fields': [
          'description',
          'public_metrics',
          'verified'
        ]
      });

      return response.data ? {
        id: response.data.id,
        username: response.data.username,
        name: response.data.name,
        description: response.data.description,
        verified: response.data.verified || false,
        followers_count: response.data.public_metrics?.followers_count || 0,
        following_count: response.data.public_metrics?.following_count || 0,
      } : null;

    } catch (error) {
      logger.error(`Failed to fetch user @${username}`, error);
      return null;
    }
  }

  /**
   * Fetch a single page of tweets
   */
  private async fetchTweetPage(userId: string, options: any) {
    return await this.client.v2.userTimeline(userId, {
      ...options,
      'tweet.fields': [
        'created_at',
        'public_metrics',
        'entities',
        'context_annotations'
      ],
      exclude: ['retweets', 'replies'], // Focus on original content
    });
  }

  /**
   * Enhance tweet with additional data
   */
  private enhanceTweet(tweet: TweetV2, user: TwitterUser): TweetWithEngagement {
    const engagementScore = this.calculateEngagementScore(tweet);
    const qualityScore = this.calculateQualityScore(tweet, user);

    return {
      id: tweet.id,
      text: tweet.text,
      author_id: tweet.author_id!,
      created_at: tweet.created_at!,
      public_metrics: tweet.public_metrics!,
      entities: tweet.entities,
      context_annotations: tweet.context_annotations,
      
      // Enhanced fields
      author_username: user.username,
      author_name: user.name,
      engagement_score: engagementScore,
      quality_score: qualityScore,
      processed_at: new Date().toISOString(),
    };
  }

  /**
   * Calculate engagement score (simple metric)
   */
  private calculateEngagementScore(tweet: TweetV2): number {
    const metrics = tweet.public_metrics;
    if (!metrics) return 0;

    // Weighted engagement score
    return (
      metrics.like_count +
      (metrics.retweet_count * 2) +  // Retweets worth more
      (metrics.reply_count * 1.5) +  // Replies show engagement
      (metrics.quote_count * 3)      // Quotes are highest value
    );
  }

  /**
   * Calculate quality score based on multiple factors
   */
  private calculateQualityScore(tweet: TweetV2, user: TwitterUser): number {
    let score = 0.5; // Base score

    // Text quality indicators
    const text = tweet.text.toLowerCase();
    
    // Positive indicators
    if (tweet.entities?.urls?.length) score += 0.1; // Has links
    if (tweet.entities?.hashtags?.length && tweet.entities.hashtags.length <= 3) score += 0.1; // Reasonable hashtags
    if (text.includes('?')) score += 0.05; // Questions engage
    if (tweet.context_annotations?.length) score += 0.1; // Twitter detected topics
    
    // Negative indicators
    if (text.includes('follow me')) score -= 0.2; // Spam-like
    if (text.includes('dm me')) score -= 0.1; // Promotional
    if ((tweet.entities?.hashtags?.length || 0) > 5) score -= 0.2; // Hashtag spam
    
    // Author credibility
    if (user.verified) score += 0.1;
    if (user.followers_count > 10000) score += 0.1;
    if (user.followers_count > 100000) score += 0.1;
    
    // Engagement factor
    const engagementRatio = this.calculateEngagementScore(tweet) / Math.max(user.followers_count * 0.01, 1);
    score += Math.min(engagementRatio, 0.2); // Cap the bonus

    return Math.max(0, Math.min(1, score)); // Keep between 0 and 1
  }

  /**
   * Check if tweet passes quality filters
   */
  private passesQualityFilter(tweet: TweetWithEngagement, config: any): boolean {
    // Length filter
    if (tweet.text.length < config.minTweetLength) {
      return false;
    }

    // Engagement filter
    if (tweet.engagement_score < config.minEngagementScore) {
      return false;
    }

    // Quality filter (can be adjusted)
    if (tweet.quality_score < 0.3) {
      return false;
    }

    return true;
  }

  /**
   * Rate limiting management
   */
  private async checkRateLimit(endpoint: string): Promise<void> {
    const rateLimit = this.rateLimitInfo.get(endpoint);
    
    if (!rateLimit) return; // No previous info, proceed

    const now = Math.floor(Date.now() / 1000);
    
    if (rateLimit.remaining <= 1 && now < rateLimit.reset) {
      const waitTime = (rateLimit.reset - now + 1) * 1000;
      logger.info(`Rate limit reached for ${endpoint}. Waiting ${waitTime}ms`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  private async waitForRateLimit(): Promise<void> {
    // Much more conservative delay between requests to preserve API quota
    const delay = envConfig.development ? 3000 : 5000; // 3-5 seconds between requests
    logger.info(`Waiting ${delay}ms to respect rate limits...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Check API quota before making expensive calls
   */
  private async checkApiQuota(): Promise<void> {
    try {
      // Get current rate limit status
      const rateLimits = await this.client.v1.get('application/rate_limit_status.json', {
        resources: 'users,tweets'
      });
      
      logger.info('API Quota Check:', rateLimits);
      
      // Warn if approaching limits
      const userTimelineLimit = rateLimits?.resources?.tweets?.['/2/users/:id/tweets'];
      if (userTimelineLimit && userTimelineLimit.remaining < 10) {
        logger.warn('⚠️  API quota running low!', {
          remaining: userTimelineLimit.remaining,
          limit: userTimelineLimit.limit,
          resets_at: new Date(userTimelineLimit.reset * 1000).toISOString()
        });
        
        console.log('⚠️  WARNING: Twitter API quota is running low!');
        console.log(`   Remaining calls: ${userTimelineLimit.remaining}/${userTimelineLimit.limit}`);
        console.log(`   Resets at: ${new Date(userTimelineLimit.reset * 1000).toLocaleString()}`);
      }
      
    } catch (error) {
      // If quota check fails, proceed but with warning
      logger.warn('Could not check API quota, proceeding with caution');
    }
  }

  /**
   * Test the connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Use a simple endpoint that works with OAuth 2.0 Application-Only
      await this.client.v1.get('application/rate_limit_status.json');
      logger.info('Twitter API connection test successful');
      return true;
    } catch (error: any) {
      logger.error('Twitter API connection test failed', {
        error: error.message,
        code: error.code
      });
      return false;
    }
  }
}