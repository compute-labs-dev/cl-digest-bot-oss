// scripts/test/test-intent-parser.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { IntentParser } from '../../lib/agent/intent-parser';
import logger from '../../lib/logger';

interface TestCase {
  message: string;
  expectedIntent: string;
  expectedEntities: Record<string, any>;
  minConfidence: number;
}

async function testIntentRecognition() {
  console.log('🧪 Testing Intent Recognition System\n');

  const parser = new IntentParser();
  
  const testCases: TestCase[] = [
    // Twitter source management
    {
      message: "Add @elonmusk to my Twitter sources",
      expectedIntent: "ADD_TWITTER_SOURCE",
      expectedEntities: { twitterUsernames: ["elonmusk"] },
      minConfidence: 0.8
    },
    {
      message: "Remove @sama from Twitter monitoring",
      expectedIntent: "REMOVE_TWITTER_SOURCE", 
      expectedEntities: { twitterUsernames: ["sama"] },
      minConfidence: 0.8
    },
    
    // RSS source management
    {
      message: "Subscribe to TechCrunch RSS feed",
      expectedIntent: "ADD_RSS_SOURCE",
      expectedEntities: { rssUrls: ["techcrunch"] },
      minConfidence: 0.7
    },
    
    // AI model switching
    {
      message: "Switch to Gemini model to reduce costs",
      expectedIntent: "CHANGE_AI_MODEL",
      expectedEntities: { aiModel: "google" },
      minConfidence: 0.8
    },
    
    // Digest generation
    {  
      message: "Generate a digest about AI news from the last 12 hours",
      expectedIntent: "RUN_DIGEST",
      expectedEntities: { 
        timeRange: "12h",
        focusTopics: ["AI"]
      },
      minConfidence: 0.7
    },
    
    // Multi-action requests
    {
      message: "Add @karpathy to Twitter and switch to Ollama for testing",
      expectedIntent: "MULTI_ACTION",
      expectedEntities: {
        twitterUsernames: ["karpathy"],
        aiModel: "ollama"
      },
      minConfidence: 0.7
    },
    
    // System status
    {
      message: "What sources are currently configured?",
      expectedIntent: "GET_SOURCES", 
      expectedEntities: {},
      minConfidence: 0.8
    },
    
    // Edge cases
    {
      message: "I want to do something with the system",
      expectedIntent: "UNKNOWN",
      expectedEntities: {},
      minConfidence: 0.0
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`Testing: "${testCase.message}"`);
    
    try {
      const result = await parser.parseIntent(testCase.message);
      
      if (!result.success) {
        console.log(`❌ Failed: ${result.error}`);
        failed++;
        continue;
      }

      const intent = result.intent!;
      
      // Check intent type
      if (intent.type !== testCase.expectedIntent) {
        console.log(`❌ Intent mismatch: expected ${testCase.expectedIntent}, got ${intent.type}`);
        failed++;
        continue;
      }
      
      // Check confidence
      if (intent.confidence < testCase.minConfidence) {
        console.log(`❌ Low confidence: ${intent.confidence} < ${testCase.minConfidence}`);
        failed++;
        continue;
      }
      
      // Check entities (basic validation)
      let entitiesValid = true;
      for (const [key, expectedValue] of Object.entries(testCase.expectedEntities)) {
        if (!intent.entities[key as keyof typeof intent.entities]) {
          console.log(`❌ Missing entity: ${key}`);
          entitiesValid = false;
        }
      }
      
      if (!entitiesValid) {
        failed++;
        continue;
      }
      
      console.log(`✅ Passed (confidence: ${intent.confidence.toFixed(2)})`);
      console.log(`   Entities:`, intent.entities);
      passed++;
      
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
      failed++;
    }
    
    console.log('---\n');
  }

  console.log(`\n📊 Test Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n💡 Tips for improving intent recognition:');
    console.log('- Adjust AI model temperature (lower = more consistent)');
    console.log('- Improve prompt with more examples');
    console.log('- Add fallback entity extraction patterns');
    console.log('- Consider fine-tuning model for domain-specific intents');
  }
}

// Error handling for real-world scenarios
async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling\n');
  
  const parser = new IntentParser();
  
  const errorCases = [
    "", // Empty message
    "asdfghjkl", // Gibberish
    "🚀🚀🚀", // Only emojis
    "a".repeat(10000), // Very long message
  ];
  
  for (const errorCase of errorCases) {
    console.log(`Testing error case: "${errorCase.substring(0, 50)}${errorCase.length > 50 ? '...' : ''}"`);
    
    const result = await parser.parseIntent(errorCase);
    
    if (result.success) {
      console.log(`⚠️  Unexpected success: ${result.intent?.type}`);
    } else {
      console.log(`✅ Handled gracefully: ${result.error}`);
      if (result.needsClarification) {
        console.log(`   Clarification: ${result.needsClarification.question}`);
      }
    }
    
    console.log('---\n');
  }
}

// Performance testing
async function testPerformance() {
  console.log('\n⚡ Performance Testing\n');
  
  const parser = new IntentParser();
  const testMessage = "Add @elonmusk to Twitter sources and switch to Gemini";
  const iterations = 10;
  
  console.log(`Running ${iterations} iterations...`);
  
  const startTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    await parser.parseIntent(testMessage);
  }
  
  const endTime = Date.now();
  const avgTime = (endTime - startTime) / iterations;
  
  console.log(`📊 Average response time: ${avgTime.toFixed(0)}ms`);
  console.log(`📈 Throughput: ${(1000 / avgTime).toFixed(1)} requests/second`);
  
  if (avgTime > 2000) {
    console.log('⚠️  Consider using a faster model for intent recognition');
  } else {
    console.log('✅ Performance acceptable for interactive use');
  }
}

// Main test runner
async function main() {
  try {
    await testIntentRecognition();
    await testErrorHandling();
    await testPerformance();
    
    console.log('\n🎉 Intent recognition testing completed!');
    console.log('\n💡 Next steps:');
    console.log('- Review failed test cases and improve prompts');
    console.log('- Test with real user messages'); 
    console.log('- Monitor performance in production');
    console.log('- Consider caching for common intents');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

main();