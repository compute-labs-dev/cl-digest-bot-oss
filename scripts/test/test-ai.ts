// scripts/test/test-ai.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { AIService } from '../../lib/ai/ai-service';
import { AIAnalysisRequest } from '../../types/ai';
import logger from '../../lib/logger';

// Command line argument parsing
const args = process.argv.slice(2);
const providerArg = args.find(arg => arg.startsWith('--provider='));
const selectedProvider = providerArg ? providerArg.split('=')[1] : 'all';

// Provider configurations for testing
const PROVIDER_CONFIGS = {
  openai: {
    name: 'OpenAI',
    method: 'useOpenAI',
    model: 'gpt-4o',
    envVar: 'OPENAI_API_KEY',
    costRates: { prompt: 0.0000025, completion: 0.00001 }
  },
  anthropic: {
    name: 'Anthropic Claude',
    method: 'useClaude', 
    model: 'claude-3-5-sonnet-20241022',
    envVar: 'ANTHROPIC_API_KEY',
    costRates: { prompt: 0.000003, completion: 0.000015 }
  },
  google: {
    name: 'Google Gemini',
    method: 'useGemini',
    model: 'gemini-1.5-pro',
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
    costRates: { prompt: 0.00000125, completion: 0.000005 }
  },
  ollama: {
    name: 'Ollama (Local)',
    method: 'useOllama', 
    model: 'llama3.1:8b',
    envVar: null, // No API key required
    costRates: { prompt: 0, completion: 0 } // Local model, no cost
  }
} as const;

async function testAIIntegration() {
  console.log('🤖 Testing AI Integration...\n');

  if (selectedProvider !== 'all') {
    console.log(`🎯 Testing specific provider: ${selectedProvider.toUpperCase()}\n`);
  }

  try {
    const aiService = AIService.getInstance();
    const testResults: Array<{
      provider: string;
      success: boolean;
      response?: any;
      error?: string;
      cost?: number;
    }> = [];

    // Determine which providers to test
    const providersToTest = selectedProvider === 'all' 
      ? Object.keys(PROVIDER_CONFIGS)
      : [selectedProvider];

    // Validate provider selection
    for (const provider of providersToTest) {
      if (!(provider in PROVIDER_CONFIGS)) {
        console.error(`❌ Unknown provider: ${provider}`);
        console.log('Available providers: openai, anthropic, google, ollama');
        process.exit(1);
      }
    }

    console.log('📋 Environment Check:');
    let hasAllRequiredKeys = true;
    
    for (const provider of providersToTest) {
      const config = PROVIDER_CONFIGS[provider as keyof typeof PROVIDER_CONFIGS];
      if (config.envVar) {
        const hasKey = !!process.env[config.envVar];
        console.log(`   ${config.name}: ${hasKey ? '✅' : '❌'} (${config.envVar})`);
        if (!hasKey) hasAllRequiredKeys = false;
      } else {
        console.log(`   ${config.name}: ✅ (No API key required)`);
      }
    }

    if (!hasAllRequiredKeys) {
      console.log('\n💡 Missing API keys. Add them to .env.local:');
      console.log('   OPENAI_API_KEY=your_openai_key');
      console.log('   ANTHROPIC_API_KEY=your_anthropic_key');  
      console.log('   GOOGLE_GENERATIVE_AI_API_KEY=your_google_key');
      console.log('   (Ollama requires no API key, just local server)');
    }

    // Test each provider
    for (const [index, provider] of providersToTest.entries()) {
      const config = PROVIDER_CONFIGS[provider as keyof typeof PROVIDER_CONFIGS];
      
      console.log(`\n${index + 1}. Testing ${config.name} Connection:`);
      
      try {
        // Configure the service for this provider
        (aiService as any)[config.method](config.model);
        
        // Test connection
        const connected = await aiService.testConnection();
        if (connected) {
          console.log(`✅ ${config.name} connection successful`);
        } else {
          console.log(`❌ ${config.name} connection failed`);
          testResults.push({ provider, success: false, error: 'Connection test failed' });
          continue;
        }

        // Test content analysis if connection successful
        console.log(`   Testing content analysis...`);
        const analysisResponse = await aiService.analyzeContent(getTestContent());
        
        console.log(`✅ ${config.name} Analysis Complete:`);
        console.log(`   Title: "${analysisResponse.analysis.title}"`);
        console.log(`   Key Insights: ${analysisResponse.analysis.key_insights.length} insights`);
        console.log(`   Trending Topics: ${analysisResponse.analysis.trending_topics.length} topics`);
        console.log(`   Confidence: ${analysisResponse.analysis.confidence_score.toFixed(2)}`);
        console.log(`   Tokens: ${analysisResponse.token_usage.total_tokens} (Prompt: ${analysisResponse.token_usage.prompt_tokens}, Completion: ${analysisResponse.token_usage.completion_tokens})`);
        console.log(`   Processing Time: ${(analysisResponse.processing_time_ms / 1000).toFixed(2)}s`);
        
        // Calculate cost
        const cost = calculateCost(analysisResponse.token_usage, config.costRates);
        if (cost > 0) {
          console.log(`   Estimated Cost: $${cost.toFixed(6)}`);
        } else {
          console.log(`   Cost: Free (local model)`);
        }

        testResults.push({ 
          provider, 
          success: true, 
          response: analysisResponse,
          cost 
        });

      } catch (error: any) {
        console.log(`❌ ${config.name} test failed: ${error.message}`);
        
        // Provider-specific error guidance
        if (provider === 'ollama' && error.message.includes('Ollama server not running')) {
          console.log('   💡 Start Ollama server with: ollama serve');
          console.log('   💡 Then pull the model with: ollama pull llama3.1:8b');
        } else if (error.message.includes('API_KEY') || error.message.includes('API key')) {
          console.log(`   💡 Check your ${config.envVar} environment variable`);
        }
        
        testResults.push({ 
          provider, 
          success: false, 
          error: error.message 
        });
      }
    }

    // Summary
    console.log('\n📊 Test Summary:');
    const successful = testResults.filter(r => r.success);
    const failed = testResults.filter(r => !r.success);
    
    console.log(`   ✅ Successful: ${successful.length}/${testResults.length}`);
    console.log(`   ❌ Failed: ${failed.length}/${testResults.length}`);

    if (successful.length > 0) {
      console.log('\n💰 Cost Comparison (for this test):');
      successful.forEach(result => {
        const config = PROVIDER_CONFIGS[result.provider as keyof typeof PROVIDER_CONFIGS];
        if (result.cost! > 0) {
          console.log(`   ${config.name}: $${result.cost!.toFixed(6)}`);
        } else {
          console.log(`   ${config.name}: Free (local)`);
        }
      });
    }

    if (successful.length >= 2) {
      console.log('\n🔍 Response Quality Comparison:');
      successful.slice(0, 2).forEach(result => {
        const config = PROVIDER_CONFIGS[result.provider as keyof typeof PROVIDER_CONFIGS];
        console.log(`   ${config.name}: "${result.response!.analysis.executive_summary.substring(0, 100)}..."`);
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed Providers:');
      failed.forEach(result => {
        const config = PROVIDER_CONFIGS[result.provider as keyof typeof PROVIDER_CONFIGS];
        console.log(`   ${config.name}: ${result.error}`);
      });
    }

    console.log('\n🎉 AI integration test completed!');
    
    if (successful.length > 0) {
      console.log('\n💡 Provider Recommendations:');
      console.log('   - OpenAI: Fast, cost-effective, good general performance');
      console.log('   - Anthropic: Best for complex analysis and reasoning');
      console.log('   - Google Gemini: Good balance of speed and quality');
      console.log('   - Ollama: Free local inference, privacy-focused');
    }

    // Exit with error code if all tests failed
    if (successful.length === 0) {
      process.exit(1);
    }

  } catch (error: any) {
    logger.error('AI integration test failed', error);
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

function getTestContent(): AIAnalysisRequest {
  return {
    content: {
      tweets: [
        {
          id: 'tweet1',
          text: 'Breaking: New AI model shows unprecedented capabilities in reasoning and mathematics',
          author: 'AI_News',
          created_at: '2024-01-15T10:00:00Z',
          engagement_score: 150,
          quality_score: 0.9,
          url: 'https://twitter.com/AI_News/status/1'
        },
        {
          id: 'tweet2', 
          text: 'The future of work is changing rapidly with AI automation. Companies need to adapt now.',
          author: 'TechExpert',
          created_at: '2024-01-15T11:00:00Z',
          engagement_score: 85,
          quality_score: 0.8,
          url: 'https://twitter.com/TechExpert/status/2'
        }
      ],
      rss_articles: [
        {
          id: 'article1',
          title: 'The Rise of Large Language Models in Enterprise',
          description: 'How companies are integrating AI into their workflows',
          content: 'Large language models are transforming how businesses operate...',
          author: 'Jane Smith',
          published_at: '2024-01-15T09:00:00Z',
          source: 'TechCrunch',
          quality_score: 0.95,
          url: 'https://techcrunch.com/article1'
        }
      ],
      timeframe: {
        from: '2024-01-15T00:00:00Z',
        to: '2024-01-15T23:59:59Z'
      },
      metadata: {
        total_sources: 3,
        source_breakdown: {
          twitter: 2,
          telegram: 0,
          rss: 1
        }
      }
    },
    analysisType: 'digest'
  };
}

function calculateCost(tokenUsage: any, rates: { prompt: number; completion: number }): number {
  return (tokenUsage.prompt_tokens * rates.prompt) + (tokenUsage.completion_tokens * rates.completion);
}

testAIIntegration();