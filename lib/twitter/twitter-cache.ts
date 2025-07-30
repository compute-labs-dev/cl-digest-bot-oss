// lib/twitter/twitter-cache.ts

import { supabase } from '../supabase/supabase-client';
import { TweetWithEngagement } from '../../types/twitter';
import { getXAccountConfig } from '../../config/data-sources-config';
import logger from '../logger';

export class TwitterCache {
  
  /**
   * Check if we have fresh cached data for a user
   */
  async isCacheFresh(username: string): Promise<boolean> {
    const config = getXAccountConfig(username);
    const cacheThresholdMs = config.cacheHours * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - cacheThresholdMs).toISOString();

    const { data, error } = await supabase
      .from('tweets')
      .select('processed_at')
      .eq('author_username', username)
      .gte('processed_at', cutoffTime)
      .limit(1);

    if (error) {
      logger.error(`Cache check failed for @${username}`, error);
      return false;
    }

    const isFresh = (data?.length || 0) > 0;
    logger.info(`Cache check for @${username}: ${isFresh ? 'fresh' : 'stale'}`);
    
    return isFresh;
  }

  /**
   * Get cached tweets for a user
   */
  async getCachedTweets(username: string): Promise<TweetWithEngagement[]> {
    const config = getXAccountConfig(username);
    const cacheThresholdMs = config.cacheHours * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - cacheThresholdMs).toISOString();

    const { data, error } = await supabase
      .from('tweets')
      .select('*')
      .eq('author_username', username)
      .gte('processed_at', cutoffTime)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error(`Failed to retrieve cached tweets for @${username}`, error);
      return [];
    }

    logger.info(`Retrieved ${data?.length || 0} cached tweets for @${username}`);
    return data || [];
  }

  /**
   * Store tweets in cache
   */
  async storeTweets(tweets: TweetWithEngagement[]): Promise<void> {
    if (tweets.length === 0) return;

    // Prepare data for database
    const dbTweets = tweets.map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      author_id: tweet.author_id,
      author_username: tweet.author_username,
      author_name: tweet.author_name,
      created_at: tweet.created_at,
      retweet_count: tweet.public_metrics.retweet_count,
      like_count: tweet.public_metrics.like_count,
      reply_count: tweet.public_metrics.reply_count,
      quote_count: tweet.public_metrics.quote_count,
      engagement_score: tweet.engagement_score,
      quality_score: tweet.quality_score,
      source_url: `https://twitter.com/${tweet.author_username}/status/${tweet.id}`,
      raw_data: tweet,
      processed_at: tweet.processed_at,
    }));

    // Use upsert to handle duplicates
    const { error } = await supabase
      .from('tweets')
      .upsert(dbTweets, { onConflict: 'id' });

    if (error) {
      logger.error('Failed to store tweets in cache', error);
      throw error;
    }

    logger.info(`Stored ${tweets.length} tweets in cache`);
  }

  /**
   * Clean old cache entries
   */
  async cleanOldCache(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { error } = await supabase
      .from('tweets')
      .delete()
      .lt('processed_at', cutoffDate.toISOString());

    if (error) {
      logger.error('Failed to clean old cache entries', error);
    } else {
      logger.info(`Cleaned cache entries older than ${olderThanDays} days`);
    }
  }
}