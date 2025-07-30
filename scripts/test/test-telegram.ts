// scripts/test/test-telegram.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { TelegramScraper } from '../../lib/telegram/telegram-scraper';
import { TelegramCache } from '../../lib/telegram/telegram-cache';
import logger from '../../lib/logger';

async function testTelegramScraping() {
  console.log('📱 Testing Telegram Scraping...\n');

  try {
    // Test 1: Connection
    console.log('1. Testing Connection:');
    const scraper = new TelegramScraper();
    const connected = await scraper.testConnection();
    
    if (!connected) {
      throw new Error('Cannot connect to Telegram');
    }
    console.log('✅ Telegram connection successful');

    // Test 2: Scrape a reliable public channel
    console.log('\n2. Testing Channel Scraping:');
    
    // Use a well-known public channel that always has content
    const testChannel = 'telegram'; // Official Telegram channel
    
    const result = await scraper.scrapeChannel(testChannel, { maxMessages: 5 });
    
    console.log(`✅ Scraped ${result.messages.length} messages from t.me/${testChannel}`);
    console.log(`   Channel: ${result.channel.title}`);
    console.log(`   Subscribers: ${result.channel.subscribers?.toLocaleString() || 'Unknown'}`);

    if (result.messages.length > 0) {
      const sampleMessage = result.messages[0];
      console.log(`   Sample message: "${sampleMessage.text.substring(0, 100)}..."`);
      console.log(`   Views: ${sampleMessage.views.toLocaleString()}`);
      console.log(`   Quality score: ${sampleMessage.quality_score.toFixed(2)}`);
    }

    // Test 3: Caching
    console.log('\n3. Testing Caching System:');
    const cache = new TelegramCache();
    
    await cache.storeMessages(result.messages);
    console.log('✅ Messages stored in cache');
    
    const cachedMessages = await cache.getCachedMessages(testChannel);
    console.log(`✅ Retrieved ${cachedMessages.length} messages from cache`);
    
    const isFresh = await cache.isCacheFresh(testChannel);
    console.log(`✅ Cache freshness check: ${isFresh ? 'Fresh' : 'Stale'}`);

    // Test 4: Quality filtering
    console.log('\n4. Testing Quality Filtering:');
    const highQualityMessages = result.messages.filter(msg => msg.quality_score > 0.6);
    const mediumQualityMessages = result.messages.filter(msg => msg.quality_score > 0.4 && msg.quality_score <= 0.6);
    const lowQualityMessages = result.messages.filter(msg => msg.quality_score <= 0.4);
    
    console.log(`✅ Quality distribution:`);
    console.log(`   High quality (>0.6): ${highQualityMessages.length} messages`);
    console.log(`   Medium quality (0.4-0.6): ${mediumQualityMessages.length} messages`);
    console.log(`   Low quality (≤0.4): ${lowQualityMessages.length} messages`);

    console.log('\n🎉 Telegram scraping test completed successfully!');
    console.log('💰 Cost: $0.00 (completely free!)');

  } catch (error: any) {
    logger.error('Telegram scraping test failed', error);
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('not found')) {
      console.log('\n💡 The test channel might be private or renamed');
      console.log('   Try testing with a different public channel like "durov" or "telegram"');
    }
    
    process.exit(1);
  }
}

testTelegramScraping();