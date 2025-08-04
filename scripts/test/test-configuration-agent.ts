// scripts/test/test-configuration-agent.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { ConfigurationAgent } from '../../lib/agent/configuration-agent';
import { IntentParser } from '../../lib/agent/intent-parser';
import logger from '../../lib/logger';

interface AgentTestCase {
  description: string;
  userMessage: string;
  expectedSuccess: boolean;
  expectedActions?: string[];
  requiresSetup?: string[];
}

async function testConfigurationAgent() {
  console.log('🧪 Testing Configuration Agent\n');

  const intentParser = new IntentParser();
  const configAgent = new ConfigurationAgent();

  const testCases: AgentTestCase[] = [
    {
      description: "Add Twitter source",
      userMessage: "Add @elonmusk to my Twitter sources",
      expectedSuccess: true,
      expectedActions: ['ADD_TWITTER_SOURCE']
    },
    {
      description: "Add multiple Twitter sources",
      userMessage: "Add @sama and @karpathy to Twitter monitoring",
      expectedSuccess: true,
      expectedActions: ['ADD_TWITTER_SOURCE']
    },
    {
      description: "Switch AI model to Gemini",
      userMessage: "Switch to Gemini model to reduce costs",
      expectedSuccess: true,
      expectedActions: ['CHANGE_AI_MODEL'],
      requiresSetup: ['GOOGLE_API_KEY environment variable']
    },
    {
      description: "Add RSS feed",
      userMessage: "Subscribe to TechCrunch RSS feed",
      expectedSuccess: true,
      expectedActions: ['ADD_RSS_SOURCE']
    },
    {
      description: "Multi-action request",
      userMessage: "Add @sama to Twitter and switch to Ollama for testing",
      expectedSuccess: true,
      expectedActions: ['MULTI_ACTION'],
      requiresSetup: ['Ollama server running']
    },
    {
      description: "Get system status",
      userMessage: "What's the current system status?",
      expectedSuccess: true,
      expectedActions: ['GET_STATUS']
    },
    {
      description: "Invalid request",
      userMessage: "Make me a sandwich",
      expectedSuccess: false,
      expectedActions: ['UNKNOWN']
    }
  ];

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.description}`);
    console.log(`Message: "${testCase.userMessage}"`);

    try {
      // Check if test requirements are met
      if (testCase.requiresSetup) {
        const setupValid = await checkTestSetup(testCase.requiresSetup);
        if (!setupValid) {
          console.log(`⏭️  Skipped: Missing setup requirements`);
          console.log(`   Requirements: ${testCase.requiresSetup.join(', ')}`);
          skipped++;
          console.log('---\n');
          continue;
        }
      }

      // Parse intent
      const intentResult = await intentParser.parseIntent(testCase.userMessage);
      
      if (!intentResult.success) {
        if (testCase.expectedSuccess) {
          console.log(`❌ Intent parsing failed: ${intentResult.error}`);
          failed++;
        } else {
          console.log(`✅ Expected failure in intent parsing: ${intentResult.error}`);
          passed++;
        }
        console.log('---\n');
        continue;
      }

      // Execute configuration change
      const configResult = await configAgent.executeIntent(intentResult.intent!);
      
      // Check results
      if (configResult.success === testCase.expectedSuccess) {
        console.log(`✅ Expected success: ${configResult.success}`);
        console.log(`   Message: ${configResult.message}`);
        
        if (configResult.changes && configResult.changes.length > 0) {
          console.log(`   Changes: ${configResult.changes.length} configuration changes made`);
        }
        
        passed++;
      } else {
        console.log(`❌ Unexpected result: expected success=${testCase.expectedSuccess}, got success=${configResult.success}`);
        console.log(`   Message: ${configResult.message}`);
        
        if (configResult.validationErrors) {
          console.log(`   Errors: ${configResult.validationErrors.join(', ')}`);
        }
        
        failed++;
      }

    } catch (error: any) {
      console.log(`❌ Test error: ${error.message}`);
      failed++;
    }

    console.log('---\n');
  }

  console.log(`📊 Test Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
}

async function testRollbackFunctionality() {
  console.log('\n🔄 Testing Rollback Functionality\n');

  const intentParser = new IntentParser();
  const configAgent = new ConfigurationAgent();

  try {
    // Make a change
    console.log('Making a test change...');
    const intentResult = await intentParser.parseIntent("Add @testuser123 to Twitter sources");
    
    if (intentResult.success) {
      const configResult = await configAgent.executeIntent(intentResult.intent!);
      
      if (configResult.success && configResult.changeId) {
        console.log(`✅ Change applied: ${configResult.message}`);
        
        // Wait a moment, then rollback
        console.log('\nRolling back the change...');
        const rollbackResult = await configAgent.rollbackChange(configResult.changeId);
        
        if (rollbackResult.success) {
          console.log(`✅ Rollback successful: ${rollbackResult.message}`);
        } else {
          console.log(`❌ Rollback failed: ${rollbackResult.message}`);
        }
      } else {
        console.log(`❌ Initial change failed: ${configResult.message}`);
      }
    } else {
      console.log(`❌ Intent parsing failed: ${intentResult.error}`);
    }

  } catch (error: any) {
    console.log(`❌ Rollback test error: ${error.message}`);
  }
}

async function testChangeHistory() {
  console.log('\n📜 Testing Change History\n');

  const configAgent = new ConfigurationAgent();

  try {
    const recentChanges = await configAgent.getRecentChanges(5);
    
    console.log(`Found ${recentChanges.length} recent changes:`);
    
    recentChanges.forEach((change, index) => {
      console.log(`${index + 1}. ${change.description} (${change.status})`);
      console.log(`   Time: ${change.timestamp.toLocaleString()}`);
      console.log(`   ID: ${change.id}`);
    });

    if (recentChanges.length === 0) {
      console.log('No recent changes found. Try running some configuration commands first.');
    }

  } catch (error: any) {
    console.log(`❌ Change history test error: ${error.message}`);
  }
}

async function checkTestSetup(requirements: string[]): Promise<boolean> {
  for (const requirement of requirements) {
    if (requirement.includes('GOOGLE_API_KEY')) {
      if (!process.env.GOOGLE_API_KEY) return false;
    }
    if (requirement.includes('Ollama server')) {
      try {
        const response = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
        if (!response.ok) return false;
      } catch {
        return false;
      }
    }
  }
  return true;
}

// Main test runner
async function main() {
  try {
    await testConfigurationAgent();
    await testRollbackFunctionality();
    await testChangeHistory();
    
    console.log('\n🎉 Configuration agent testing completed!');
    console.log('\n💡 Next steps:');
    console.log('- Review any failed tests and improve validation');
    console.log('- Test with different AI models');
    console.log('- Verify configuration files are updated correctly');
    console.log('- Test rollback functionality with real changes');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

main();