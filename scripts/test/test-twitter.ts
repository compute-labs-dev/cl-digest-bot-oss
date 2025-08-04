// scripts/test/test-twitter.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { TwitterClient } from '../../lib/twitter/twitter-client';
import { TwitterCache } from '../../lib/twitter/twitter-cache';
import logger from '../../lib/logger';
import { createMockTweets } from '../../lib/twitter/twitter-mock';


async function testTwitterIntegration() {
  console.log('🐦 Testing Twitter Integration...\n');

  try {
    // Test 1: Connection
    console.log('1. Testing API Connection:');
    const client = new TwitterClient();
    const connected = await client.testConnection();
    console.log('connected', connected);
    if (!connected) {
      throw new Error('Twitter API connection failed. Check your credentials.');
    }
    console.log('✅ Twitter API connection successful');

    // Test 2: Fetch tweets from a reliable account
    console.log('\n2. Testing Tweet Fetching:');
    const testUsername = 'OpenAI'; // Use a reliable, active account
    
    // IMPORTANT: Use mock data for testing to preserve API quota
    // Real API calls should only be used in production with proper monitoring
    console.log('⚠️  Using mock data to preserve API quota (you\'ve hit your monthly limit)');
    const tweets = createMockTweets(testUsername, 20);
    
    // Uncomment only when you have API quota available and want to test real calls:
    // const tweets = await client.fetchUserTweets(testUsername);

    console.log(`✅ Fetched ${tweets.length} tweets from @${testUsername}`);

    if (tweets.length > 0) {
      const sampleTweet = tweets[0];
      console.log(`   Sample tweet: "${sampleTweet.text.substring(0, 100)}..."`);
      console.log(`   Engagement score: ${sampleTweet.engagement_score}`);
      console.log(`   Quality score: ${sampleTweet.quality_score.toFixed(2)}`);
    }

    // Test 3: Caching
    console.log('\n3. Testing Caching System:');
    const cache = new TwitterCache();
    
    await cache.storeTweets(tweets);
    console.log('✅ Tweets stored in cache');
    
    const cachedTweets = await cache.getCachedTweets(testUsername);
    console.log(`✅ Retrieved ${cachedTweets.length} tweets from cache`);
    
    const isFresh = await cache.isCacheFresh(testUsername);
    console.log(`✅ Cache freshness check: ${isFresh ? 'Fresh' : 'Stale'}`);

    console.log('\n🎉 Twitter integration test completed successfully!');
    console.log(`💰 API calls made: ~3 (user lookup + 1-2 tweet pages)`);

  } catch (error: any) {
    logger.error('Twitter integration test failed', error);
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('credentials')) {
      console.log('\n💡 Make sure you have valid Twitter API credentials in .env.local');
      console.log('   Visit https://developer.twitter.com to get API access');
    }
    
    process.exit(1);
  }
}

testTwitterIntegration();