// scripts/test/test-ai.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { AIService } from '../../lib/ai/ai-service';
import { AIAnalysisRequest } from '../../types/ai';
import logger from '../../lib/logger';

async function testAIIntegration() {
  console.log('🤖 Testing AI Integration...\n');

  try {
    // Test 1: OpenAI Connection
    console.log('1. Testing OpenAI Connection:');
    const openaiService = AIService.getInstance();
    openaiService.useOpenAI('gpt-4o');
    
    const openaiConnected = await openaiService.testConnection();
    if (openaiConnected) {
      console.log('✅ OpenAI connection successful');
    } else {
      console.log('❌ OpenAI connection failed');
    }

    // Test 2: Anthropic Connection
    console.log('\n2. Testing Anthropic Connection:');
    openaiService.useClaude('claude-3-5-sonnet-20241022');
    
    const anthropicConnected = await openaiService.testConnection();
    if (anthropicConnected) {
      console.log('✅ Anthropic connection successful');
    } else {
      console.log('❌ Anthropic connection failed');
    }

    // Test 3: Content Analysis
    console.log('\n3. Testing Content Analysis:');
    
    const testContent: AIAnalysisRequest = {
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

    // Test with Claude (current model)
    console.log('   Testing with Claude...');
    const claudeResponse = await openaiService.analyzeContent(testContent);
    
    console.log(`✅ Claude Analysis Complete:`);
    console.log(`   Title: "${claudeResponse.analysis.title}"`);
    console.log(`   Key Insights: ${claudeResponse.analysis.key_insights.length} insights`);
    console.log(`   Trending Topics: ${claudeResponse.analysis.trending_topics.length} topics`);
    console.log(`   Confidence: ${claudeResponse.analysis.confidence_score.toFixed(2)}`);
    console.log(`   Tokens: ${claudeResponse.token_usage.total_tokens} (Prompt: ${claudeResponse.token_usage.prompt_tokens}, Completion: ${claudeResponse.token_usage.completion_tokens})`);
    console.log(`   Processing Time: ${(claudeResponse.processing_time_ms / 1000).toFixed(2)}s`);

    // Test with OpenAI
    console.log('\n   Testing with OpenAI...');
    openaiService.useOpenAI('gpt-4o');
    const openaiResponse = await openaiService.analyzeContent(testContent);
    
    console.log(`✅ OpenAI Analysis Complete:`);
    console.log(`   Title: "${openaiResponse.analysis.title}"`);
    console.log(`   Key Insights: ${openaiResponse.analysis.key_insights.length} insights`);
    console.log(`   Trending Topics: ${openaiResponse.analysis.trending_topics.length} topics`);
    console.log(`   Confidence: ${openaiResponse.analysis.confidence_score.toFixed(2)}`);
    console.log(`   Tokens: ${openaiResponse.token_usage.total_tokens} (Prompt: ${openaiResponse.token_usage.prompt_tokens}, Completion: ${openaiResponse.token_usage.completion_tokens})`);
    console.log(`   Processing Time: ${(openaiResponse.processing_time_ms / 1000).toFixed(2)}s`);

    // Test 4: Cost Analysis
    console.log('\n4. Cost Analysis:');
    
    const claudeCost = (claudeResponse.token_usage.prompt_tokens * 0.000003) + 
                      (claudeResponse.token_usage.completion_tokens * 0.000015);
    const openaiCost = (openaiResponse.token_usage.prompt_tokens * 0.0000025) + 
                      (openaiResponse.token_usage.completion_tokens * 0.00001);
    
    console.log(`   Claude Cost: $${claudeCost.toFixed(4)}`);
    console.log(`   OpenAI Cost: $${openaiCost.toFixed(4)}`);
    console.log(`   Cost Difference: ${claudeCost > openaiCost ? 'Claude more expensive' : 'OpenAI more expensive'} by $${Math.abs(claudeCost - openaiCost).toFixed(4)}`);

    // Test 5: Response Quality Comparison
    console.log('\n5. Response Quality Comparison:');
    console.log(`   Claude Executive Summary: "${claudeResponse.analysis.executive_summary.substring(0, 100)}..."`);
    console.log(`   OpenAI Executive Summary: "${openaiResponse.analysis.executive_summary.substring(0, 100)}..."`);

    console.log('\n🎉 AI integration test completed successfully!');
    console.log('\n💡 Both models are working. Choose based on your needs:');
    console.log('   - Claude: Better for complex analysis and reasoning');
    console.log('   - OpenAI: Faster and often more cost-effective');

  } catch (error: any) {
    logger.error('AI integration test failed', error);
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('API_KEY')) {
      console.log('\n💡 Make sure you have valid API keys in .env.local:');
      console.log('   OPENAI_API_KEY=your_openai_key');
      console.log('   ANTHROPIC_API_KEY=your_anthropic_key');
    }
    
    process.exit(1);
  }
}

testAIIntegration();