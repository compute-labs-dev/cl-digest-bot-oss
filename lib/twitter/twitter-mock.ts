// lib/twitter/twitter-mock.ts

import { TweetWithEngagement } from '../../types/twitter';

export function createMockTweets(username: string, count: number = 10): TweetWithEngagement[] {
  const baseTime = Date.now();
  
  return Array.from({ length: count }, (_, i) => ({
    id: `mock_${username}_${i}`,
    text: `This is a mock tweet #${i + 1} from @${username}. It contains some interesting content about AI and technology trends. Mock tweets help you test without API costs!`,
    author_id: `mock_author_${username}`,
    created_at: new Date(baseTime - (i * 3600000)).toISOString(), // 1 hour apart
    
    public_metrics: {
      retweet_count: Math.floor(Math.random() * 50),
      like_count: Math.floor(Math.random() * 200),
      reply_count: Math.floor(Math.random() * 20),
      quote_count: Math.floor(Math.random() * 10),
    },
    
    author_username: username,
    author_name: username.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    engagement_score: Math.floor(Math.random() * 100),
    quality_score: 0.5 + (Math.random() * 0.4), // 0.5 to 0.9
    processed_at: new Date().toISOString(),
  }));
}

// Use in your code like this:
// const mockTweets = createMockTweets('elonmusk', 20);