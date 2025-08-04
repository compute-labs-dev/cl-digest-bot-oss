// lib/rss/rss-cache.ts

import { supabase } from '../supabase/supabase-client';
import { RSSArticle } from '../../types/rss';
import { getRssFeedConfig } from '../../config/data-sources-config';
import logger from '../logger';

export class RSSCache {
  
  /**
   * Check if we have fresh cached articles for a feed
   */
  async isCacheFresh(feedUrl: string): Promise<boolean> {
    const config = getRssFeedConfig(feedUrl);
    const cacheThresholdMs = config.cacheHours * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - cacheThresholdMs).toISOString();

    const { data, error } = await supabase
      .from('rss_articles')
      .select('fetched_at')
      .eq('feed_url', feedUrl)
      .gte('fetched_at', cutoffTime)
      .limit(1);

    if (error) {
      logger.error(`RSS cache check failed for ${feedUrl}`, error);
      return false;
    }

    const isFresh = (data?.length || 0) > 0;
    logger.info(`RSS cache check for ${feedUrl}: ${isFresh ? 'fresh' : 'stale'}`);
    
    return isFresh;
  }

  /**
   * Get cached articles for a feed
   */
  async getCachedArticles(feedUrl: string): Promise<RSSArticle[]> {
    const config = getRssFeedConfig(feedUrl);
    const cacheThresholdMs = config.cacheHours * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - cacheThresholdMs).toISOString();

    const { data, error } = await supabase
      .from('rss_articles')
      .select('*')
      .eq('feed_url', feedUrl)
      .gte('fetched_at', cutoffTime)
      .order('published_at', { ascending: false })
      .limit(config.articlesPerFeed);

    if (error) {
      logger.error(`Failed to retrieve cached RSS articles for ${feedUrl}`, error);
      return [];
    }

    logger.info(`Retrieved ${data?.length || 0} cached RSS articles for ${feedUrl}`);
    
    return (data || []).map(this.dbToRSSArticle);
  }

  /**
   * Store articles in cache
   */
  async storeArticles(articles: RSSArticle[]): Promise<void> {
    if (articles.length === 0) return;

    // Prepare data for database
    const dbArticles = articles.map(article => ({
      id: article.id,
      title: article.title,
      link: article.link,
      description: article.description,
      content: article.content,
      author: article.author,
      published_at: article.published_at,
      feed_url: article.feed_url,
      feed_title: article.feed_title,
      quality_score: article.quality_score,
      word_count: article.word_count,
      raw_data: {
        categories: article.categories,
        content_extracted: article.content_extracted,
        extraction_method: article.extraction_method,
        raw_data: article.raw_data
      },
      fetched_at: article.fetched_at,
    }));

    // Use upsert to handle duplicates
    const { error } = await supabase
      .from('rss_articles')
      .upsert(dbArticles, { onConflict: 'link' });

    if (error) {
      logger.error('Failed to store RSS articles in cache', error);
      throw error;
    }

    logger.info(`Stored ${articles.length} RSS articles in cache`);
  }

  /**
   * Convert database row back to RSSArticle
   */
  private dbToRSSArticle(dbRow: any): RSSArticle {
    return {
      id: dbRow.id,
      title: dbRow.title,
      link: dbRow.link,
      description: dbRow.description,
      content: dbRow.content,
      author: dbRow.author,
      published_at: dbRow.published_at,
      feed_url: dbRow.feed_url,
      feed_title: dbRow.feed_title,
      word_count: dbRow.word_count,
      quality_score: dbRow.quality_score,
      categories: dbRow.raw_data?.categories || [],
      content_extracted: dbRow.raw_data?.content_extracted || false,
      extraction_method: dbRow.raw_data?.extraction_method,
      raw_data: dbRow.raw_data?.raw_data,
      fetched_at: dbRow.fetched_at,
    };
  }

  /**
   * Clean old cache entries
   */
  async cleanOldCache(olderThanDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { error } = await supabase
      .from('rss_articles')
      .delete()
      .lt('fetched_at', cutoffDate.toISOString());

    if (error) {
      logger.error('Failed to clean old RSS cache entries', error);
    } else {
      logger.info(`Cleaned RSS cache entries older than ${olderThanDays} days`);
    }
  }
}