// types/config.ts

// Twitter/X account configuration
export interface XAccountConfig {
    tweetsPerRequest: number;    // How many tweets to fetch per API call (5-100)
    maxPages: number;            // How many pages to paginate through
    cacheHours: number;          // Hours before refreshing cached data
    minTweetLength: number;      // Filter out short tweets
    minEngagementScore: number;  // Filter out low-engagement tweets
  }
  
  // Telegram channel configuration  
  export interface TelegramChannelConfig {
    messagesPerChannel: number;  // How many messages to fetch
    cacheHours: number;          // Cache duration
    minMessageLength: number;    // Filter short messages
  }
  
  // RSS feed configuration
  export interface RssFeedConfig {
    articlesPerFeed: number;     // How many articles to fetch
    cacheHours: number;          // Cache duration  
    minArticleLength: number;    // Filter short articles
    maxArticleLength: number;    // Trim very long articles
  }