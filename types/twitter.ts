// types/twitter.ts

export interface TwitterUser {
    id: string;
    username: string;
    name: string;
    description?: string;
    verified: boolean;
    followers_count: number;
    following_count: number;
  }
  
  export interface TwitterTweet {
    id: string;
    text: string;
    author_id: string;
    created_at: string;
    
    // Engagement metrics
    public_metrics: {
      retweet_count: number;
      like_count: number;
      reply_count: number;
      quote_count: number;
    };
    
    // Content analysis
    entities?: {
      urls?: Array<{ expanded_url: string; title?: string }>;
      hashtags?: Array<{ tag: string }>;
      mentions?: Array<{ username: string }>;
    };
    
    // Context
    context_annotations?: Array<{
      domain: { name: string };
      entity: { name: string };
    }>;
  }
  
  export interface TweetWithEngagement extends TwitterTweet {
    author_username: string;
    author_name: string;
    engagement_score: number;
    quality_score: number;
    processed_at: string;
  }