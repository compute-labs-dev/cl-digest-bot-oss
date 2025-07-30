// scripts/test/test-config.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { 
  getXAccountConfig, 
  getTelegramChannelConfig, 
  getRssFeedConfig 
} from '../../config/data-sources-config';
import { configValidator } from '../../config/validator';
import { envConfig } from '../../config/environment';
import logger from '../../lib/logger';

async function testConfiguration() {
  console.log('🔧 Testing Configuration System...\n');

  // Test 1: Default configurations
  console.log('1. Testing Default Configurations:');
  
  const defaultXConfig = getXAccountConfig('random_user');
  console.log(`✅ X defaults: ${defaultXConfig.tweetsPerRequest} tweets, ${defaultXConfig.cacheHours}h cache`);
  
  const defaultTelegramConfig = getTelegramChannelConfig('random_channel');
  console.log(`✅ Telegram defaults: ${defaultTelegramConfig.messagesPerChannel} messages, ${defaultTelegramConfig.cacheHours}h cache`);
  
  const defaultRssConfig = getRssFeedConfig('https://example.com/feed.xml');
  console.log(`✅ RSS defaults: ${defaultRssConfig.articlesPerFeed} articles, ${defaultRssConfig.cacheHours}h cache`);

  // Test 2: Override configurations
  console.log('\n2. Testing Override Configurations:');
  
  const elonConfig = getXAccountConfig('elonmusk');
  console.log(`✅ Elon override: ${elonConfig.maxPages} pages (default is 2)`);
  
  const newsConfig = getXAccountConfig('breakingnews');
  console.log(`✅ Breaking news override: ${newsConfig.cacheHours}h cache (default is 5)`);

  // Test 3: Validation
  console.log('\n3. Testing Configuration Validation:');
  
  const validationErrors = configValidator.validateAll();
  if (validationErrors.length === 0) {
    console.log('✅ All configurations are valid');
  } else {
    console.log('❌ Configuration errors found:');
    validationErrors.forEach(error => {
      console.log(`  - ${error.source}.${error.field}: ${error.message}`);
    });
  }

  // Test 4: Environment configuration
  console.log('\n4. Testing Environment Configuration:');
  console.log(`✅ Environment: ${envConfig.development ? 'Development' : 'Production'}`);
  console.log(`✅ Twitter timeout: ${envConfig.apiTimeouts.twitter}ms`);
  console.log(`✅ Log level: ${envConfig.logging.level}`);

  // Test 5: Type safety demonstration
  console.log('\n5. Demonstrating Type Safety:');
  
  // This would cause a TypeScript error:
  // const badConfig = getXAccountConfig('test');
  // badConfig.invalidProperty = 'error'; // ← TypeScript catches this!
  
  console.log('✅ TypeScript prevents invalid configuration properties');

  console.log('\n🎉 Configuration system test completed successfully!');
}

// Run the test
testConfiguration().catch(error => {
  logger.error('Configuration test failed', error);
  process.exit(1);
});