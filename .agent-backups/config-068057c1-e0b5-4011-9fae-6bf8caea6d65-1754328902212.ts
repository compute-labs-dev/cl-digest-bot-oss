// config/data-sources-config.ts

import { XAccountConfig, TelegramChannelConfig, RssFeedConfig } from './types';

/**
 * Twitter/X Configuration
 * 
 * Provides defaults and per-account overrides for Twitter data collection
 */
export const xConfig = {
  // Global defaults - work for 90% of accounts
  defaults: {
    tweetsPerRequest: 100,      // Max allowed by Twitter API
    maxPages: 2,                // 200 tweets total per account
    cacheHours: 5,              // Refresh every 5 hours
    minTweetLength: 50,         // Skip very short tweets
    minEngagementScore: 5,      // Skip tweets with <5 total engagement
  } as XAccountConfig,
  
  // Special cases - accounts that need different settings
  accountOverrides: {
    // High-volume accounts - get more data
    'elonmusk': { maxPages: 5 },
    'unusual_whales': { maxPages: 5 },
    
    // News accounts - shorter cache for breaking news
    'breakingnews': { cacheHours: 2 },
    
    // Technical accounts - allow shorter tweets (code snippets)
    'dan_abramov': { minTweetLength: 20 },
  } as Record<string, Partial<XAccountConfig>>
};

/**
 * Telegram Configuration
 */
export const telegramConfig = {
  defaults: {
    messagesPerChannel: 50,     // 50 messages per channel
    cacheHours: 5,              // Same as Twitter
    minMessageLength: 30,       // Skip very short messages
  } as TelegramChannelConfig,
  
  channelOverrides: {
    // High-activity channels
    'financial_express': { messagesPerChannel: 100 },
    
    // News channels - fresher data
    'cryptonews': { cacheHours: 3 },
  } as Record<string, Partial<TelegramChannelConfig>>
};

/**
 * RSS Configuration  
 */
export const rssConfig = {
  defaults: {
    articlesPerFeed: 20,        // 20 articles per feed
    cacheHours: 6,              // RSS updates less frequently
    minArticleLength: 200,      // Skip very short articles
    maxArticleLength: 5000,     // Trim long articles to save tokens
  } as RssFeedConfig,
  
  feedOverrides: {
    'https://techcrunch.com/feed/': { articlesPerFeed: 10 },
    'https://arxiv.org/rss/cs.AI': { articlesPerFeed: 10 },
    'https://feeds.feedburner.com/ycombinator': { articlesPerFeed: 10 }
  } as Record<string, Partial<RssFeedConfig>>
};

// Helper functions to get configuration for specific sources
export function getXAccountConfig(username: string): XAccountConfig {
  const override = xConfig.accountOverrides[username] || {};
  return { ...xConfig.defaults, ...override };
}

export function getTelegramChannelConfig(channelName: string): TelegramChannelConfig {
  const override = telegramConfig.channelOverrides[channelName] || {};
  return { ...telegramConfig.defaults, ...override };
}

export function getRssFeedConfig(feedUrl: string): RssFeedConfig {
  const override = rssConfig.feedOverrides[feedUrl] || {};
  return { ...rssConfig.defaults, ...override };
}