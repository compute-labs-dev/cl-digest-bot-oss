// lib/social/digest-distributor.ts

import logger from '../logger';
import { createClient } from '@supabase/supabase-js';
import { envConfig } from '../../config/environment';
import { TwitterClient, DigestTweet, TweetResult } from '../twitter/twitter-client';

export interface DistributionResult {
  platform: string;
  success: boolean;
  url?: string;
  error?: string;
}

export interface DistributionConfig {
  enableTwitter: boolean;
  tweetFormat: 'summary' | 'thread';
}

export class DigestDistributor {
  private twitterClient: TwitterClient;
  private _supabase?: any;

  constructor() {
    this.twitterClient = new TwitterClient();
  }

  /**
   * Lazy-load Supabase client to ensure environment variables are loaded
   */
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient(envConfig.supabaseUrl, envConfig.supabaseServiceKey);
    }
    return this._supabase;
  }

  /**
   * Distribute digest to configured platforms
   */
  async distributeDigest(
    digestData: any, 
    config: DistributionConfig = {
      enableTwitter: true,
      tweetFormat: 'thread',
    }
  ): Promise<DistributionResult[]> {
    
    const results: DistributionResult[] = [];

    if (config.enableTwitter) {
      try {
        const twitterResult = await this.distributeToTwitter(digestData, config);
        results.push(twitterResult);
        
        // Store result in database for tracking
        if (twitterResult.success) {
          await this.storeDistributionResult('twitter', twitterResult, digestData);
        }
      } catch (error: any) {
        logger.error('Twitter distribution failed', error);
        results.push({
          platform: 'twitter',
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Distribute to Twitter
   */
  private async distributeToTwitter(digestData: any, config: DistributionConfig): Promise<DistributionResult> {
    if (!this.twitterClient.canPost()) {
      return {
        platform: 'twitter',
        success: false,
        error: 'Twitter credentials not configured for posting'
      };
    }

    // Convert digest data to DigestTweet format
    const digestTweet: DigestTweet = this.formatDigestForTwitter(digestData);
    
    let result: TweetResult;
    
    if (config.tweetFormat === 'thread') {
      result = await this.twitterClient.postDigestThread(digestTweet);
    } else {
      result = await this.twitterClient.postDigestSummary(digestTweet);
    }

    return {
      platform: 'twitter',
      success: result.success,
      url: result.url,
      error: result.error,
    };
  }

  /**
   * Format digest data for Twitter posting
   */
  private formatDigestForTwitter(digestData: any): DigestTweet {
    return {
      title: digestData.title || 'Tech Digest Update',
      summary: digestData.executive_summary || digestData.summary || 'Latest tech insights and trends.',
      keyInsights: digestData.key_insights || [],
      trendingTopics: digestData.trending_topics || [],
      confidence_score: digestData.confidence_score || 0.8,
      sources_count: digestData.metadata?.total_sources || 0
    };
  }

  /**
   * Store distribution result in database
   */
  private async storeDistributionResult(platform: string, result: DistributionResult, digestData: any): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('digest_distributions')
        .insert({
          platform,
          success: result.success,
          url: result.url,
          digest_id: digestData.title, // Using digest_id column to store title
          metrics: { 
            posted_at: new Date().toISOString(),
            digest_data: digestData 
          }
        });

      if (error) {
        logger.warn('Failed to store distribution result', error);
      }
    } catch (error) {
      logger.warn('Database error storing distribution result', error);
    }
  }
}