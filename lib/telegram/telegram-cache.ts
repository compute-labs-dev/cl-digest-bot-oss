// lib/telegram/telegram-cache.ts

import { supabase } from '../supabase/supabase-client';
import { TelegramMessage } from '../../types/telegram';
import { getTelegramChannelConfig } from '../../config/data-sources-config';
import logger from '../logger';

export class TelegramCache {
  
  /**
   * Check if we have fresh cached data for a channel
   */
  async isCacheFresh(channelUsername: string): Promise<boolean> {
    const config = getTelegramChannelConfig(channelUsername);
    const cacheThresholdMs = config.cacheHours * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - cacheThresholdMs).toISOString();

    const { data, error } = await supabase
      .from('telegram_messages')
      .select('fetched_at')
      .eq('channel_username', channelUsername)
      .gte('fetched_at', cutoffTime)
      .limit(1);

    if (error) {
      logger.error(`Cache check failed for t.me/${channelUsername}`, error);
      return false;
    }

    const isFresh = (data?.length || 0) > 0;
    logger.info(`Cache check for t.me/${channelUsername}: ${isFresh ? 'fresh' : 'stale'}`);
    
    return isFresh;
  }

  /**
   * Get cached messages for a channel
   */
  async getCachedMessages(channelUsername: string): Promise<TelegramMessage[]> {
    const config = getTelegramChannelConfig(channelUsername);
    const cacheThresholdMs = config.cacheHours * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - cacheThresholdMs).toISOString();

    const { data, error } = await supabase
      .from('telegram_messages')
      .select('*')
      .eq('channel_username', channelUsername)
      .gte('fetched_at', cutoffTime)
      .order('message_date', { ascending: false })
      .limit(config.messagesPerChannel);

    if (error) {
      logger.error(`Failed to retrieve cached messages for t.me/${channelUsername}`, error);
      return [];
    }

    logger.info(`Retrieved ${data?.length || 0} cached messages for t.me/${channelUsername}`);
    
    // Convert database format back to TelegramMessage format
    return (data || []).map(this.dbToTelegramMessage);
  }

  /**
   * Store messages in cache
   */
  async storeMessages(messages: TelegramMessage[]): Promise<void> {
    if (messages.length === 0) return;

    // Prepare data for database
    const dbMessages = messages.map(message => ({
      id: message.id,
      message_id: message.message_id,
      channel_username: message.channel_username,
      channel_title: message.channel_title,
      text: message.text,
      author: message.author,
      message_date: message.message_date,
      views: message.views,
      forwards: message.forwards,
      replies: message.replies,
      quality_score: message.quality_score,
      source_url: message.source_url,
      raw_data: {
        has_media: message.has_media,
        media_description: message.media_description,
        links: message.links,
        raw_html: message.raw_html
      },
      fetched_at: message.fetched_at,
    }));

    // Use upsert to handle duplicates
    const { error } = await supabase
      .from('telegram_messages')
      .upsert(dbMessages, { onConflict: 'message_id,channel_username' });

    if (error) {
      logger.error('Failed to store Telegram messages in cache', error);
      throw error;
    }

    logger.info(`Stored ${messages.length} Telegram messages in cache`);
  }

  /**
   * Convert database row back to TelegramMessage
   */
  private dbToTelegramMessage(dbRow: any): TelegramMessage {
    return {
      id: dbRow.id,
      message_id: dbRow.message_id,
      channel_username: dbRow.channel_username,
      channel_title: dbRow.channel_title,
      text: dbRow.text,
      author: dbRow.author,
      message_date: dbRow.message_date,
      views: dbRow.views,
      forwards: dbRow.forwards,
      replies: dbRow.replies,
      has_media: dbRow.raw_data?.has_media || false,
      media_description: dbRow.raw_data?.media_description,
      links: dbRow.raw_data?.links || [],
      quality_score: dbRow.quality_score,
      source_url: dbRow.source_url,
      raw_html: dbRow.raw_data?.raw_html,
      fetched_at: dbRow.fetched_at,
    };
  }

  /**
   * Clean old cache entries
   */
  async cleanOldCache(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { error } = await supabase
      .from('telegram_messages')
      .delete()
      .lt('fetched_at', cutoffDate.toISOString());

    if (error) {
      logger.error('Failed to clean old Telegram cache entries', error);
    } else {
      logger.info(`Cleaned Telegram cache entries older than ${olderThanDays} days`);
    }
  }
}