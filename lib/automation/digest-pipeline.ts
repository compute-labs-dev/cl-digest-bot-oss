// lib/automation/digest-pipeline.ts

import { ScheduledTask } from './scheduler';
import { TwitterClient } from '../twitter/twitter-client';
import { TwitterCache } from '../twitter/twitter-cache';
import { TelegramScraper } from '../telegram/telegram-scraper';
import { TelegramCache } from '../telegram/telegram-cache';
import { RSSProcessor } from '../rss/rss-processor';
import { RSSCache } from '../rss/rss-cache';
import { AIService } from '../ai/ai-service';
import { DigestStorage } from '../digest/digest-storage';
import { SlackClient } from '../slack/slack-client';
import { ProgressTracker } from '../../utils/progress';
import { DigestDistributor, DistributionConfig } from '../social/digest-distributor';
import { SlackNotifier } from '../slack/slack-notifier';

import logger from '../logger';

export interface DigestPipelineConfig {
  // Data collection settings
  enableTwitter: boolean;
  enableTelegram: boolean;
  enableRSS: boolean;
  
  // Processing settings
  aiModel: 'openai' | 'anthropic';
  aiModelName?: string;
  analysisType: 'digest' | 'summary' | 'market_intelligence';
  
  // Distribution settings
  postToSlack: boolean;
  slackChannelId?: string;
  
  // Quality settings
  minQualityThreshold: number;
  maxContentAge: number; // hours
}

export class DigestPipeline implements ScheduledTask {
  private config: DigestPipelineConfig;
  private twitterClient?: TwitterClient;
  private twitterCache?: TwitterCache;
  private telegramScraper?: TelegramScraper;
  private telegramCache?: TelegramCache;
  private rssProcessor?: RSSProcessor;
  private rssCache?: RSSCache;
  private aiService: AIService;
  private digestStorage: DigestStorage;
  private slackClient?: SlackClient;
  private digestDistributor: DigestDistributor;
  private slackNotifier: SlackNotifier;
  
  constructor(config: DigestPipelineConfig) {
    this.config = config;
    
    // Initialize components based on configuration
    if (config.enableTwitter) {
      this.twitterClient = new TwitterClient();
      this.twitterCache = new TwitterCache();
    }
    
    if (config.enableTelegram) {
      this.telegramScraper = new TelegramScraper();
      this.telegramCache = new TelegramCache();
    }
    
    if (config.enableRSS) {
      this.rssProcessor = new RSSProcessor();
      this.rssCache = new RSSCache();
    }
    
    this.aiService = AIService.getInstance();
    this.digestStorage = new DigestStorage();
    
    if (config.postToSlack) {
      this.slackClient = new SlackClient();
    }
    
    // Configure AI model
    if (config.aiModel === 'openai') {
      this.aiService.useOpenAI(config.aiModelName);
    } else {
      this.aiService.useClaude(config.aiModelName);
    }

    this.digestDistributor = new DigestDistributor();
    this.slackNotifier = new SlackNotifier();
  }

  /**
   * Execute the complete digest pipeline
   */
  async execute(): Promise<void> {
    const progress = new ProgressTracker({
      total: 8,
      label: 'Digest Pipeline'
    });

    const startTime = Date.now();
    let currentStep = 'initialization';

    try {
      logger.info('Starting digest pipeline execution');
      currentStep = 'data collection';
      // Step 1: Collect Twitter data
      progress.update(1, { step: 'Twitter Collection' });
      const tweets = await this.collectTwitterData();
      logger.info(`Collected ${tweets.length} tweets`);

      // Step 2: Collect Telegram data  
      progress.update(2, { step: 'Telegram Collection' });
      const telegramMessages = await this.collectTelegramData();
      logger.info(`Collected ${telegramMessages.length} Telegram messages`);

      // Step 3: Collect RSS data
      progress.update(3, { step: 'RSS Collection' });
      const rssArticles = await this.collectRSSData();
      logger.info(`Collected ${rssArticles.length} RSS articles`);

      // Step 4: Prepare content for AI analysis
      progress.update(4, { step: 'Content Preparation' });
      const analysisContent = this.prepareContentForAnalysis(tweets, telegramMessages, rssArticles);

      if (analysisContent.metadata.total_sources === 0) {
        logger.warn('No content collected, skipping AI analysis');
        progress.complete('Pipeline completed with no content');
        return;
      }

      currentStep = 'ai analysis';
      // Step 5: AI Analysis
      progress.update(5, { step: 'AI Analysis' });
      const aiResponse = await this.aiService.analyzeContent({
        content: analysisContent,
        analysisType: this.config.analysisType as any
      });

      // Step 6: Store and distribute results
      progress.update(6, { step: 'Storage & Distribution' });
      const digestId = await this.storeDigest(aiResponse, analysisContent);
      
      if (this.config.postToSlack && this.slackClient) {
        await this.distributeToSlack(aiResponse, digestId);
      }

      currentStep='Social Media Distribution'
      // Step 7: Distribute to social media
      progress.update(7, { step: 'Social Media Distribution' });
      
      const distributionResults = await this.digestDistributor.distributeDigest(
        { ...aiResponse.analysis, id: digestId },
        { enableTwitter: true, tweetFormat: 'thread' }
      );

      // Get Twitter URL if successful
      const twitterResult = distributionResults.find(r => r.platform === 'twitter' && r.success);
      const twitterUrl = twitterResult?.url;

      // Calculate processing time
      const processingTime = Math.round((Date.now() - startTime) / 1000);

      // Send success notification (don't block pipeline on this)
      this.sendSlackNotificationSafely(() => 
        this.slackNotifier.notifyDigestComplete(
          aiResponse.analysis.title,
          twitterUrl,
          {
            digest_id: digestId,
            sources_count: analysisContent.metadata.total_sources,
            processing_time: `${processingTime}s`,
            ai_model: aiResponse.model_info.model,
            confidence: `${(aiResponse.analysis.confidence_score * 100).toFixed(0)}%`
          }
        )
      );

      progress.complete(`Pipeline completed successfully (Digest: ${digestId})`);
      
      logger.info('Digest pipeline completed successfully', {
        digest_id: digestId,
        content_sources: analysisContent.metadata.total_sources,
        ai_tokens_used: aiResponse.token_usage.total_tokens,
        processing_time_ms: aiResponse.processing_time_ms
      });

    } catch (error: any) {
      progress.fail(`Pipeline failed: ${ error.message }, ${ currentStep }`);      

      // Send error notification (don't block pipeline on this)
      this.sendSlackNotificationSafely(() => 
        this.slackNotifier.notifyDigestError(error.message, currentStep)
      );

      throw error;
    }
  }

  /**
   * Collect Twitter data
   */
  private async collectTwitterData(): Promise<any[]> {
    if (!this.config.enableTwitter || !this.twitterClient) {
      return [];
    }

    try {
      // Get configured Twitter accounts (you'd load this from config)
      const twitterAccounts = ['openai', 'anthropicai', 'elonmusk']; // Example
      const allTweets: any[] = [];

      for (const username of twitterAccounts) {
        try {
          // Check cache first
          const isCacheFresh = await this.twitterCache!.isCacheFresh(username);
          
          let tweets;
          if (isCacheFresh) {
            tweets = await this.twitterCache!.getCachedTweets(username);
            logger.debug(`Using cached tweets for @${username}: ${tweets.length} tweets`);
          } else {
            tweets = await this.twitterClient!.fetchUserTweets(username);
            await this.twitterCache!.storeTweets(tweets);
            logger.debug(`Fetched fresh tweets for @${username}: ${tweets.length} tweets`);
          }

          allTweets.push(...tweets);
        } catch (error) {
          logger.error(`Failed to collect tweets from @${username}`, error);
          // Continue with other accounts
        }
      }

      return this.filterByQuality(allTweets, 'tweet');
    } catch (error) {
      logger.error('Twitter data collection failed', error);
      return [];
    }
  }

  /**
   * Collect Telegram data
   */
  private async collectTelegramData(): Promise<any[]> {
    if (!this.config.enableTelegram) {
      return [];
    }

    try {
      // Get configured Telegram channels
      const telegramChannels = ['telegram', 'durov']; // Example
      const allMessages: any[] = [];

      for (const channelUsername of telegramChannels) {
        try {
          // Check cache first
          const isCacheFresh = await this.telegramCache!.isCacheFresh(channelUsername);
          
          let messages;
          if (isCacheFresh) {
            messages = await this.telegramCache!.getCachedMessages(channelUsername);
            logger.debug(`Using cached messages for t.me/${channelUsername}: ${messages.length} messages`);
          } else {
            const result = await this.telegramScraper!.scrapeChannel(channelUsername);
            messages = result.messages;
            await this.telegramCache!.storeMessages(messages);
            logger.debug(`Scraped fresh messages for t.me/${channelUsername}: ${messages.length} messages`);
          }

          allMessages.push(...messages);
        } catch (error) {
          logger.error(`Failed to collect messages from t.me/${channelUsername}`, error);
          // Continue with other channels
        }
      }

      return this.filterByQuality(allMessages, 'telegram');
    } catch (error) {
      logger.error('Telegram data collection failed', error);
      return [];
    }
  }

  /**
   * Collect RSS data
   */
  private async collectRSSData(): Promise<any[]> {
    if (!this.config.enableRSS) {
      return [];
    }

    try {
      // Get configured RSS feeds
      const rssFeeds = [
        'https://techcrunch.com/feed/',
        'https://www.theverge.com/rss/index.xml'
      ]; // Example
      
      const allArticles: any[] = [];

      for (const feedUrl of rssFeeds) {
        try {
          // Check cache first
          const isCacheFresh = await this.rssCache!.isCacheFresh(feedUrl);
          
          let articles;
          if (isCacheFresh) {
            articles = await this.rssCache!.getCachedArticles(feedUrl);
            logger.debug(`Using cached articles for ${feedUrl}: ${articles.length} articles`);
          } else {
            const result = await this.rssProcessor!.processFeed(feedUrl);
            articles = result.articles;
            await this.rssCache!.storeArticles(articles);
            logger.debug(`Processed fresh articles for ${feedUrl}: ${articles.length} articles`);
          }

          allArticles.push(...articles);
        } catch (error) {
          logger.error(`Failed to collect articles from ${feedUrl}`, error);
          // Continue with other feeds
        }
      }

      return this.filterByQuality(allArticles, 'rss');
    } catch (error) {
      logger.error('RSS data collection failed', error);
      return [];
    }
  }

  /**
   * Filter content by quality and age
   */
  private filterByQuality(content: any[], type: 'tweet' | 'telegram' | 'rss'): any[] {
    const maxAge = this.config.maxContentAge * 60 * 60 * 1000; // Convert to milliseconds
    const now = Date.now();

    return content.filter(item => {
      // Quality filter
      if (item.quality_score < this.config.minQualityThreshold) {
        return false;
      }

      // Age filter
      let itemDate: Date;
      switch (type) {
        case 'tweet':
          itemDate = new Date(item.created_at);
          break;
        case 'telegram':
          itemDate = new Date(item.message_date);
          break;
        case 'rss':
          itemDate = new Date(item.published_at || item.fetched_at);
          break;
      }

      return (now - itemDate.getTime()) <= maxAge;
    });
  }

  /**
   * Prepare content for AI analysis
   */
  private prepareContentForAnalysis(tweets: any[], telegramMessages: any[], rssArticles: any[]): any {
    const now = new Date().toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    return {
      tweets: tweets.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        author: tweet.author_username,
        created_at: tweet.created_at,
        engagement_score: tweet.engagement_score,
        quality_score: tweet.quality_score,
        url: tweet.source_url || `https://twitter.com/${tweet.author_username}/status/${tweet.id}`
      })),
      telegram_messages: telegramMessages.map(msg => ({
        id: msg.id,
        text: msg.text,
        channel: msg.channel_username,
        author: msg.author,
        message_date: msg.message_date,
        views: msg.views,
        quality_score: msg.quality_score,
        url: msg.source_url
      })),
      rss_articles: rssArticles.map(article => ({
        id: article.id,
        title: article.title,
        description: article.description,
        content: article.content,
        author: article.author,
        published_at: article.published_at,
        source: article.feed_title || 'RSS Feed',
        quality_score: article.quality_score,
        url: article.link
      })),
      timeframe: {
        from: oneDayAgo,
        to: now
      },
      metadata: {
        total_sources: tweets.length + telegramMessages.length + rssArticles.length,
        source_breakdown: {
          twitter: tweets.length,
          telegram: telegramMessages.length,
          rss: rssArticles.length
        }
      }
    };
  }

  /**
   * Store digest in database
   */
  private async storeDigest(aiResponse: any, analysisContent: any): Promise<string> {
    const digestData = {
      title: aiResponse.analysis.title,
      summary: aiResponse.analysis.executive_summary,
      content: aiResponse.analysis,
      ai_model: aiResponse.model_info.model,
      ai_provider: aiResponse.model_info.provider,
      token_usage: aiResponse.token_usage,
      data_from: analysisContent.timeframe.from,
      data_to: analysisContent.timeframe.to,
      published_to_slack: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return await this.digestStorage.storeDigest(digestData);
  }

  /**
   * Distribute to Slack
   */
  private async distributeToSlack(aiResponse: any, digestId: string): Promise<void> {
    if (!this.slackClient) return;

    try {
      await this.slackClient.postDigest({
        title: aiResponse.analysis.title,
        summary: aiResponse.analysis.executive_summary,
        tweets: [], // You'd format these properly
        articles: [],
        metadata: {
          digest_id: digestId,
          ai_model: aiResponse.model_info.model,
          token_usage: aiResponse.token_usage
        }
      });

      // Update digest as posted to Slack
      await this.digestStorage.updateDigest(digestId, { published_to_slack: true });
      
      logger.info(`Digest distributed to Slack: ${digestId}`);
    } catch (error) {
      logger.error('Failed to distribute to Slack', error);
      // Don't throw - we still want the digest to be considered successful
    }
  }

  /**
   * Send Slack notification safely without blocking pipeline execution
   */
  private sendSlackNotificationSafely(notificationFn: () => Promise<void>): void {
    // Set a reasonable timeout for Slack notifications
    const timeoutMs = 10000; // 10 seconds
    
    Promise.race([
      notificationFn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Slack notification timeout')), timeoutMs)
      )
    ]).catch(error => {
      // Log error but don't throw - we don't want Slack issues to break the pipeline
      logger.warn('Slack notification failed (continuing pipeline anyway)', error);
    });
  }

  /**
   * Get task name for scheduler
   */
  getName(): string {
    return 'digest-pipeline';
  }

  /**
   * Get estimated duration in milliseconds
   */
  getEstimatedDuration(): number {
    return 5 * 60 * 1000; // 5 minutes
  }
}