// scripts/test/test-rss.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { RSSProcessor } from '../../lib/rss/rss-processor';
import { RSSCache } from '../../lib/rss/rss-cache';
import { popularFeeds } from '../../config/rss-feeds';
import logger from '../../lib/logger';

async function testRSSProcessing() {
  console.log('📰 Testing RSS Processing...\n');

  try {
    // Test 1: Connection and basic parsing
    console.log('1. Testing RSS Feed Access:');
    const processor = new RSSProcessor();
    
    // Use a reliable RSS feed
    const testFeedUrl = popularFeeds.tech[0]; // TechCrunch
    const canAccess = await processor.testFeed(testFeedUrl);
    
    if (!canAccess) {
      throw new Error(`Cannot access RSS feed: ${testFeedUrl}`);
    }
    console.log(`✅ RSS feed accessible: ${testFeedUrl}`);

    // Test 2: Process feed and extract articles
    console.log('\n2. Testing Article Processing:');
    const result = await processor.processFeed(testFeedUrl, {
      maxArticles: 5,
      extractFullContent: true
    });

    console.log(`✅ Processed ${result.articles.length} articles from ${result.feed.title}`);
    console.log(`   Total processed: ${result.total_processed}`);
    console.log(`   Successful content extractions: ${result.successful_extractions}`);
    console.log(`   Errors: ${result.errors.length}`);

    if (result.articles.length > 0) {
      const sampleArticle = result.articles[0];
      console.log(`   Sample article: "${sampleArticle.title}"`);
      console.log(`   Author: ${sampleArticle.author || 'Unknown'}`);
      console.log(`   Word count: ${sampleArticle.word_count}`);
      console.log(`   Quality score: ${sampleArticle.quality_score.toFixed(2)}`);
      console.log(`   Full content extracted: ${sampleArticle.content_extracted}`);
      console.log(`   Categories: ${sampleArticle.categories.join(', ') || 'None'}`);
    }

    // Test 3: Caching
    console.log('\n3. Testing Caching System:');
    const cache = new RSSCache();
    
    await cache.storeArticles(result.articles);
    console.log('✅ Articles stored in cache');
    
    const cachedArticles = await cache.getCachedArticles(testFeedUrl);
    console.log(`✅ Retrieved ${cachedArticles.length} articles from cache`);
    
    const isFresh = await cache.isCacheFresh(testFeedUrl);
    console.log(`✅ Cache freshness check: ${isFresh ? 'Fresh' : 'Stale'}`);

    // Test 4: Multiple feeds
    console.log('\n4. Testing Multiple Feed Processing:');
    const testFeeds = popularFeeds.tech.slice(0, 3); // Test 3 feeds
    
    for (const feedUrl of testFeeds) {
      try {
        const feedResult = await processor.processFeed(feedUrl, { 
          maxArticles: 2,
          extractFullContent: false // Faster for testing
        });
        console.log(`✅ ${feedResult.feed.title}: ${feedResult.articles.length} articles`);
      } catch (error: any) {
        console.log(`❌ Failed to process ${feedUrl}: ${error.message}`);
      }
    }

    // Test 5: Quality analysis
    console.log('\n5. Testing Quality Analysis:');
    const allArticles = result.articles;
    const highQuality = allArticles.filter(a => a.quality_score > 0.7);
    const mediumQuality = allArticles.filter(a => a.quality_score > 0.5 && a.quality_score <= 0.7);
    const lowQuality = allArticles.filter(a => a.quality_score <= 0.5);

    console.log(`✅ Quality distribution:`);
    console.log(`   High quality (>0.7): ${highQuality.length} articles`);
    console.log(`   Medium quality (0.5-0.7): ${mediumQuality.length} articles`);
    console.log(`   Low quality (≤0.5): ${lowQuality.length} articles`);

    console.log('\n🎉 RSS processing test completed successfully!');
    console.log('💰 Cost: $0.00 (RSS feeds are free!)');

  } catch (error: any) {
    logger.error('RSS processing test failed', error);
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('timeout')) {
      console.log('\n💡 Some RSS feeds may be slow to respond');
      console.log('   Try increasing the timeout in config/environment.ts');
    }
    
    process.exit(1);
  }
}

testRSSProcessing();