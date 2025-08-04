// lib/twitter/twitter-client.ts

import { TwitterApi, TwitterApiReadOnly, TweetV2, UserV2 } from 'twitter-api-v2';
import { TwitterUser, TweetWithEngagement } from '../../types/twitter';
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

// Interfaces for posting functionality
export interface DigestTweet {
  title: string;
  summary: string;
  keyInsights: string[];
  trendingTopics: Array<{
    topic: string;
    relevance_score: number;
  }>;
  confidence_score: number;
  sources_count: number;
}

export interface TweetResult {
  success: boolean;
  tweetId?: string;
  url?: string;
  error?: string;
  threadIds?: string[]; // For multi-tweet threads
}

export class TwitterClient {
  private readOnlyClient: TwitterApiReadOnly;
  private writeClient?: TwitterApi;
  private rateLimitInfo: Map<string, RateLimitInfo> = new Map();
  private canWrite: boolean = false;

  constructor() {
    // Initialize read-only client (OAuth 2.0 Bearer token or App-only)
    const bearerToken = process.env.X_BEARER_TOKEN;
    const apiKey = process.env.X_API_KEY;
    const apiSecret = process.env.X_API_SECRET;

    // Try Bearer Token first (recommended for v2 API read operations)
    if (bearerToken) {
      this.readOnlyClient = new TwitterApi(bearerToken).readOnly;
    } 
    // Fallback to App Key/Secret (OAuth 1.0a style for read operations)
    else if (apiKey && apiSecret) {
      this.readOnlyClient = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
      }).readOnly;
    } 
    else {
      throw new Error('Missing Twitter API credentials. Need either X_BEARER_TOKEN or both X_API_KEY and X_API_SECRET in .env.local file.');
    }

    // Initialize write client (OAuth 1.0a with user context)
    this.initializeWriteClient();

    logger.info('Twitter client initialized', { 
      readAccess: true, 
      writeAccess: this.canWrite 
    });
  }

  /**
   * Initialize write client with OAuth 1.0a credentials
   */
  private initializeWriteClient(): void {
    try {
      // TODO: Once you get matching access tokens for X_ app, uncomment these lines:
      // const apiKey = process.env.X_API_KEY;
      // const apiSecret = process.env.X_API_SECRET;
      // const accessToken = process.env.X_ACCESS_TOKEN;  // Get these new tokens
      // const accessSecret = process.env.X_ACCESS_TOKEN_SECRET;  // Get these new tokens

      // Current setup (using invalid TWITTER_ credentials)
      const apiKey = process.env.TWITTER_API_KEY;
      const apiSecret = process.env.TWITTER_API_SECRET;
      const accessToken = process.env.TWITTER_ACCESS_TOKEN;
      const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

      // Check if all write credentials are available and are strings
      if (apiKey && apiSecret && accessToken && accessSecret) {
        
        this.writeClient = new TwitterApi({
          appKey: apiKey,
          appSecret: apiSecret,
          accessToken: accessToken,
          accessSecret: accessSecret,
        });
        this.canWrite = true;
        logger.info('Write client initialized successfully with TWITTER_* credentials');
      } else {
        logger.warn('Write credentials incomplete - posting disabled', {
          hasApiKey: !!apiKey,
          hasApiSecret: !!apiSecret,
          hasAccessToken: !!accessToken,
          hasAccessSecret: !!accessSecret
        });
      }
    } catch (error) {
      logger.warn('Write client initialization failed', error);
      this.canWrite = false;
    }
  }

  /**
   * Post a digest as a Twitter thread
   */
  async postDigestThread(digest: DigestTweet): Promise<TweetResult> {
    if (!this.canWrite || !this.writeClient) {
      return {
        success: false,
        error: 'Twitter write credentials not configured'
      };
    }

    try {
      logger.info('Posting digest thread to Twitter', { title: digest.title });

      // Build thread content
      const threadTweets = this.buildDigestThread(digest);
      
      // Post the thread
      const threadResult = await this.postThread(threadTweets);

      if (threadResult.success && threadResult.threadIds && threadResult.threadIds.length > 0) {
        const mainTweetId = threadResult.threadIds[0];
        
        logger.info('Digest thread posted successfully', {
          mainTweetId,
          threadLength: threadResult.threadIds.length
        });

        return {
          success: true,
          tweetId: mainTweetId,
          url: `https://twitter.com/user/status/${mainTweetId}`,
          threadIds: threadResult.threadIds
        };
      }

      return threadResult;

    } catch (error: any) {
      logger.error('Failed to post digest thread', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Post a simple digest summary tweet
   */
  async postDigestSummary(digest: DigestTweet): Promise<TweetResult> {
    if (!this.canWrite || !this.writeClient) {
      return {
        success: false,
        error: 'Twitter write credentials not configured'
      };
    }

    try {
      const tweetText = this.formatDigestSummary(digest);
      
      const result = await this.writeClient.v2.tweet(tweetText);
      
      logger.info('Digest summary posted to Twitter', { 
        tweetId: result.data.id 
      });

      return {
        success: true,
        tweetId: result.data.id,
        url: `https://twitter.com/user/status/${result.data.id}`
      };

    } catch (error: any) {
      logger.error('Failed to post digest summary', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build a thread from digest content
   */
  private buildDigestThread(digest: DigestTweet): string[] {
    const tweets: string[] = [];
    
    // Tweet 1: Main summary with hook
    const mainTweet = `🚀 ${digest.title}

${digest.summary}

🧵 Thread with key insights below 👇

#TechDigest #AI ${this.getHashtagsFromTopics(digest.trendingTopics)}`;

    tweets.push(this.truncateToTweetLength(mainTweet));

    // Tweet 2+: Key insights (one per tweet or combined if short)
    let currentTweet = '';
    let tweetCount = 2;

    digest.keyInsights.forEach((insight, index) => {
      const insightText = `${index + 1}/ ${insight}`;
      
      // If adding this insight would exceed tweet length, post current tweet and start new one
      if (currentTweet && (currentTweet + '\n\n' + insightText).length > 260) {
        tweets.push(this.truncateToTweetLength(currentTweet));
        currentTweet = insightText;
        tweetCount++;
      } else {
        currentTweet = currentTweet 
          ? currentTweet + '\n\n' + insightText 
          : insightText;
      }
    });

    // Add the last tweet if there's content
    if (currentTweet) {
      tweets.push(this.truncateToTweetLength(currentTweet));
    }

    // Final tweet: Trending topics and stats
    const finalTweet = `📊 Key Stats:
• ${digest.sources_count} sources analyzed
• ${(digest.confidence_score * 100).toFixed(0)}% confidence
• Top trends: ${digest.trendingTopics.slice(0, 2).map(t => t.topic).join(', ')}

🤖 Generated by CL Digest Bot`;

    tweets.push(this.truncateToTweetLength(finalTweet));

    return tweets;
  }

  /**
   * Post a thread of tweets
   */
  private async postThread(tweets: string[]): Promise<TweetResult> {
    if (!this.writeClient) {
      return { success: false, error: 'Write client not available' };
    }

    const threadIds: string[] = [];
    let replyToId: string | undefined;

    try {
      for (let i = 0; i < tweets.length; i++) {
        const tweetOptions: any = {
          text: tweets[i]
        };

        // Add reply-to for thread continuity
        if (replyToId) {
          tweetOptions.reply = { in_reply_to_tweet_id: replyToId };
        }

        const result = await this.writeClient.v2.tweet(tweetOptions);
        threadIds.push(result.data.id);
        replyToId = result.data.id;

        // Add small delay between tweets to avoid rate limits
        if (i < tweets.length - 1) {
          await this.sleep(1000); // 1 second delay
        }
      }

      return {
        success: true,
        threadIds: threadIds
      };

    } catch (error: any) {
      logger.error('Failed to post thread', { error: error.message, postedTweets: threadIds.length });
      return {
        success: false,
        error: error.message,
        threadIds: threadIds // Return partial success
      };
    }
  }

  /**
   * Format digest as a single summary tweet
   */
  private formatDigestSummary(digest: DigestTweet): string {
    const topInsights = digest.keyInsights.slice(0, 2);
    const topTopics = digest.trendingTopics.slice(0, 2).map(t => `#${t.topic.replace(/\s+/g, '')}`);
    
    const summary = `🚀 ${digest.title}

${digest.summary}

💡 Key insights:
${topInsights.map((insight, i) => `${i + 1}. ${insight.substring(0, 100)}${insight.length > 100 ? '...' : ''}`).join('\n')}

📊 ${digest.sources_count} sources • ${(digest.confidence_score * 100).toFixed(0)}% confidence

${topTopics.join(' ')} #TechDigest #AI`;

    return this.truncateToTweetLength(summary);
  }

  /**
   * Get hashtags from trending topics
   */
  private getHashtagsFromTopics(topics: Array<{ topic: string; relevance_score: number }>): string {
    return topics
      .slice(0, 2)
      .map(t => `#${t.topic.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '')}`)
      .join(' ');
  }

  /**
   * Truncate text to Twitter's character limit
   */
  private truncateToTweetLength(text: string, maxLength: number = 280): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Find the last complete word within the limit
    const truncated = text.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return lastSpace > 0 
      ? truncated.substring(0, lastSpace) + '...'
      : truncated + '...';
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
      const response = await this.readOnlyClient.v2.userByUsername(username, {
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
    return await this.readOnlyClient.v2.userTimeline(userId, {
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
      const rateLimits = await this.readOnlyClient.v1.get('application/rate_limit_status.json', {
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
      await this.readOnlyClient.v1.get('application/rate_limit_status.json');
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

  /**
   * Sleep for a given number of milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if client is ready for read operations
   */
  public isReady(): boolean {
    return !!this.readOnlyClient;
  }

  /**
   * Check if client can perform write operations (post tweets)
   */
  public canPost(): boolean {
    return this.canWrite;
  }
}