// scripts/test/test-twitter-distribution.ts

// Load environment variables FIRST, before any other imports
import { config } from 'dotenv';
config({ path: '../../.env.local' });

import { TwitterClient } from '../../lib/twitter/twitter-client';
import { DigestDistributor } from '../../lib/social/digest-distributor';
import logger from '../../lib/logger';

async function testTwitterDistribution() {
  console.log('🐦 Testing Twitter Distribution...\n');

  try {
    // Test 1: Twitter Connection
    console.log('1. Testing Twitter Connection:');
    const twitterClient = new TwitterClient();
    
    const connectionTest = await twitterClient.testConnection();
    if (connectionTest) {
      console.log('✅ Twitter connection successful');
      console.log(`   📖 Read access: ${twitterClient.isReady()}`);
      console.log(`   ✏️  Write access: ${twitterClient.canPost()}`);
    } else {
      console.log('❌ Twitter connection failed - check credentials');
      return;
    }

    // Test 2: Mock Digest Data
    console.log('\n2. Testing Digest Formatting:');
    
    const mockDigest = {
      title: 'AI Revolution Accelerating',
      executive_summary: 'Major breakthroughs in AI technology are transforming industries faster than expected.',
      key_insights: [
        'OpenAI GPT-4 adoption surged 300% in enterprise',
        'AI safety regulations proposed in 15 countries',
        'Venture funding in AI startups reached $50B this quarter'
      ],
      trending_topics: [
        { topic: 'Generative AI', relevance_score: 0.95 },
        { topic: 'AI Safety', relevance_score: 0.87 }
      ],
      confidence_score: 0.92,
      metadata: { total_sources: 47 }
    };

    // Test 3: Distribution (dry run)
    console.log('\n3. Testing Distribution System:');
    
    const distributor = new DigestDistributor();
    
    // Note: Set DRY_RUN=true in environment to test without actually posting
    if (process.env.DRY_RUN === 'true') {
      console.log('   🔍 DRY RUN MODE - No actual tweets will be posted');
      
      // Just test the formatting
      const formattedDigest = (distributor as any).formatDigestForTwitter(mockDigest);
      console.log('   📝 Formatted digest:', JSON.stringify(formattedDigest, null, 2));
      
    } else {
      // Check if we can post
      if (!twitterClient.canPost()) {
        console.log('   ⚠️  Cannot post - missing write credentials');
        console.log('   💡 Make sure you have all Twitter OAuth 1.0a credentials:');
        console.log('      TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET');
        return;
      }

      // Actually post (be careful!)
      console.log('   🚀 LIVE MODE - Actually posting to Twitter');
      console.log('   ⚠️  Make sure you want to post this publicly!');
      
      const results = await distributor.distributeDigest(mockDigest, {
        enableTwitter: true,
        tweetFormat: 'thread'
      });

      results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${result.platform}: ${result.success ? result.url : result.error}`);
      });
    }

    console.log('\n🎉 Twitter distribution test completed!');
    console.log('\n💡 Next steps:');
    console.log('   - Integrate with your digest pipeline');
    console.log('   - Set up automated posting schedule');
    console.log('   - Monitor engagement and optimize content');

  } catch (error: any) {
    logger.error('Twitter distribution test failed', error);
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('credentials') || error.message.includes('Unauthorized')) {
      console.log('\n💡 Make sure you have valid Twitter API credentials in .env.local:');
      console.log('   For read operations (OAuth 2.0):');
      console.log('   X_BEARER_TOKEN=your_bearer_token');
      console.log('   OR');
      console.log('   X_API_KEY=your_api_key');
      console.log('   X_API_SECRET=your_api_secret');
      console.log('');
      console.log('   For write operations (OAuth 1.0a):');
      console.log('   X_API_KEY=your_api_key (same as above)');
      console.log('   X_API_SECRET=your_api_secret (same as above)');
      console.log('   TWITTER_ACCESS_TOKEN=your_access_token');
      console.log('   TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret');
    }
    
    process.exit(1);
  }
}

testTwitterDistribution();