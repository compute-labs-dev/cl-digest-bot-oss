// types/database.ts

export interface Database {
    public: {
      Tables: {
        sources: {
          Row: Source;
          Insert: Omit<Source, 'id' | 'created_at' | 'updated_at'> & {
            id?: string;
            created_at?: string;
            updated_at?: string;
          };
          Update: Partial<Source>;
        };
        tweets: {
          Row: Tweet;
          Insert: Omit<Tweet, 'processed_at'> & {
            processed_at?: string;
          };
          Update: Partial<Tweet>;
        };
        telegram_messages: {
          Row: TelegramMessage;
          Insert: Omit<TelegramMessage, 'id' | 'fetched_at'> & {
            id?: string;
            fetched_at?: string;
          };
          Update: Partial<TelegramMessage>;
        };
        rss_articles: {
          Row: RSSArticle;
          Insert: Omit<RSSArticle, 'id' | 'fetched_at'> & {
            id?: string;
            fetched_at?: string;
          };
          Update: Partial<RSSArticle>;
        };
        digests: {
          Row: Digest;
          Insert: Omit<Digest, 'id' | 'created_at' | 'updated_at'> & {
            id?: string;
            created_at?: string;
            updated_at?: string;
          };
          Update: Partial<Digest>;
        };
      };
    };
  }
  
  // Individual table types
  export interface Source {
    id: string;
    name: string;
    type: 'twitter' | 'telegram' | 'rss';
    url?: string;
    username?: string;
    is_active: boolean;
    config: Record<string, any>;
    created_at: string;
    updated_at: string;
  }
  
  export interface Tweet {
    id: string; // Twitter's tweet ID
    text: string;
    author_id: string;
    author_username: string;
    author_name?: string;
    created_at: string;
    
    // Engagement metrics
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
    
    // Computed fields
    engagement_score: number;
    quality_score: number;
    
    // Metadata
    source_url?: string;
    raw_data?: Record<string, any>;
    processed_at: string;
  }
  
  export interface TelegramMessage {
    id: string;
    message_id: string;
    channel_username: string;
    channel_title?: string;
    text: string;
    author?: string;
    message_date: string;
    
    // Engagement
    views: number;
    forwards: number;
    replies: number;
    
    // Processing
    quality_score: number;
    source_url?: string;
    raw_data?: Record<string, any>;
    fetched_at: string;
  }
  
  export interface RSSArticle {
    id: string;
    title: string;
    link: string;
    description?: string;
    content?: string;
    author?: string;
    published_at?: string;
    
    // Source
    feed_url: string;
    feed_title?: string;
    
    // Processing
    quality_score: number;
    word_count: number;
    raw_data?: Record<string, any>;
    fetched_at: string;
  }
  
  export interface Digest {
    id: string;
    title: string;
    summary: string;
    content: DigestContent;
    
    // AI metadata
    ai_model?: string;
    ai_provider?: string;
    token_usage?: TokenUsage;
    
    // Data scope
    data_from: string;
    data_to: string;
    
    // Publishing
    published_to_slack: boolean;
    slack_message_ts?: string;
    
    created_at: string;
    updated_at: string;
  }
  
  // Supporting types
  export interface DigestContent {
    sections: DigestSection[];
    tweets: TweetDigestItem[];
    articles: ArticleDigestItem[];
    telegram_messages?: TelegramDigestItem[];
    metadata: {
      total_sources: number;
      processing_time_ms: number;
      model_config: any;
    };
  }
  
  export interface DigestSection {
    title: string;
    summary: string;
    key_points: string[];
    source_count: number;
  }
  
  export interface TweetDigestItem {
    id: string;
    text: string;
    author: string;
    url: string;
    engagement: {
      likes: number;
      retweets: number;
      replies: number;
    };
    relevance_score: number;
  }
  
  export interface ArticleDigestItem {
    title: string;
    summary: string;
    url: string;
    source: string;
    published_at: string;
    relevance_score: number;
  }
  
  export interface TelegramDigestItem {
    text: string;
    channel: string;
    author?: string;
    url: string;
    date: string;
    relevance_score: number;
  }
  
  export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens?: number;
  }