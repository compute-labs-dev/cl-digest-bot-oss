// scripts/test/test-advanced-ai.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { AIService } from '../../lib/ai/ai-service';
import { PromptTemplateManager } from '../../lib/ai/prompt-templates';
import { ReasoningChainManager } from '../../lib/ai/reasoning-chains';
import { CostOptimizer } from '../../lib/ai/cost-optimizer';
import { QualityAssurance } from '../../lib/ai/quality-assurance';
import logger from '../../lib/logger';

async function testAdvancedAI() {
  console.log('🧠 Testing Advanced AI Techniques...\n');

  try {
    // Test 1: Prompt Templates
    console.log('1. Testing Prompt Templates:');
    const promptManager = new PromptTemplateManager();
    
    const marketTemplate = promptManager.getTemplate('market_intelligence');
    console.log(`✅ Market intelligence template loaded: ${marketTemplate?.name}`);
    
    const techTemplate = promptManager.getTemplate('technical_analysis');
    console.log(`✅ Technical analysis template loaded: ${techTemplate?.name}`);
    
    const newsTemplate = promptManager.getTemplate('news_synthesis');
    console.log(`✅ News synthesis template loaded: ${newsTemplate?.name}`);

    // Test template building
    const builtPrompt = promptManager.buildPrompt('news_synthesis', {
      timeframe: '24 hours',
      content_count: '15',
      priority_topics: 'AI, Technology',
      formatted_content: 'Sample content for testing...'
    });
    
    if (builtPrompt) {
      console.log('✅ Prompt template building successful');
      console.log(`   System prompt length: ${builtPrompt.systemPrompt.length} chars`);
      console.log(`   User prompt length: ${builtPrompt.userPrompt.length} chars`);
    }

    // Test 2: Cost Optimization
    console.log('\n2. Testing Cost Optimization:');
    const costOptimizer = new CostOptimizer({
      maxDailyCost: 10.0,
      maxPerAnalysisCost: 2.0,
      priorityLevels: {
        critical: 1.5,
        important: 0.8,
        routine: 0.3
      },
      modelPreferences: {
        low_cost: ['gpt-4o-mini', 'claude-3-haiku-20240307'],
        balanced: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
        premium: ['claude-3-5-sonnet-20241022', 'gpt-4o']
      }
    });

    const recommendation = costOptimizer.getOptimizationRecommendation(
      5000, // content size
      'important', // priority
      'gpt-4o' // current model
    );

    console.log(`✅ Cost optimization recommendation:`);
    console.log(`   Recommended model: ${recommendation.recommendedModel.modelName}`);
    console.log(`   Estimated cost: $${recommendation.estimatedCost.toFixed(4)}`);
    console.log(`   Cost savings: $${recommendation.costSavings.toFixed(4)}`);
    console.log(`   Quality impact: ${recommendation.qualityImpact}`);

    // Test 3: Quality Assurance
    console.log('\n3. Testing Quality Assurance:');
    const qa = new QualityAssurance();
    
    const mockAnalysis = {
      title: 'AI Market Analysis',
      executive_summary: 'AI market shows strong growth with emerging opportunities in enterprise automation',
      key_insights: [
        'Enterprise AI adoption accelerating',
        'New investment in AI infrastructure',
        'Regulatory frameworks developing'
      ],
      trending_topics: [
        { topic: 'AI Automation', relevance_score: 0.9 }
      ],
      content_analysis: {
        sentiment: { overall: 'positive', confidence: 0.8 }
      },
      recommendations: [
        'Invest in AI infrastructure companies',
        'Monitor regulatory developments'
      ],
      confidence_score: 0.75
    };

    const qualityEval = qa.evaluateAnalysis(mockAnalysis, {});
    console.log(`✅ Quality evaluation completed:`);
    console.log(`   Completeness: ${qualityEval.metrics.completeness_score.toFixed(2)}`);
    console.log(`   Coherence: ${qualityEval.metrics.coherence_score.toFixed(2)}`);
    console.log(`   Actionability: ${qualityEval.metrics.actionability_score.toFixed(2)}`);
    console.log(`   Issues found: ${qualityEval.issues.length}`);

    // Test 4: Real AI Analysis with Templates
    console.log('\n4. Testing Template-Based Analysis:');
    const aiService = AIService.getInstance();
    aiService.useClaude('claude-3-5-sonnet-20241022');

    const testContent = {
      tweets: [{
        id: 'test1',
        text: 'Major breakthrough in AI reasoning capabilities announced by leading research lab',
        author: 'AI_Research',
        created_at: new Date().toISOString(),
        engagement_score: 200,
        quality_score: 0.9,
        url: 'https://twitter.com/test'
      }],
      rss_articles: [{
        id: 'article1',
        title: 'The Future of Artificial Intelligence: Trends and Predictions',
        description: 'Comprehensive analysis of AI development trends',
        content: 'Artificial intelligence continues to evolve rapidly...',
        author: 'Tech Expert',
        published_at: new Date().toISOString(),
        source: 'Tech Journal',
        quality_score: 0.85,
        url: 'https://example.com/article'
      }],
      timeframe: {
        from: new Date(Date.now() - 24*60*60*1000).toISOString(),
        to: new Date().toISOString()
      },
      metadata: {
        total_sources: 2,
        source_breakdown: { twitter: 1, telegram: 0, rss: 1 }
      }
    };

    // Test with news synthesis (cost-effective)
    const newsAnalysis = await aiService.analyzeContent({
      content: testContent,
      analysisType: 'summary',
      instructions: 'Use news synthesis approach for cost-effective analysis'
    });

    console.log(`✅ News synthesis analysis completed:`);
    console.log(`   Title: "${newsAnalysis.analysis.title}"`);
    console.log(`   Insights: ${newsAnalysis.analysis.key_insights.length}`);
    console.log(`   Tokens used: ${newsAnalysis.token_usage.total_tokens}`);
    console.log(`   Processing time: ${(newsAnalysis.processing_time_ms / 1000).toFixed(2)}s`);

    // Test 5: Reasoning Chain (if time permits)
    console.log('\n5. Testing Reasoning Chains:');
    const chainManager = new ReasoningChainManager(aiService);
    const availableChains = chainManager.getAvailableChains();
    
    console.log(`✅ Available reasoning chains: ${availableChains.join(', ')}`);
    
    // Get chain details
    const chainDetails = chainManager.getChainDetails('content_quality_enhancement');
    if (chainDetails) {
      console.log(`✅ Content quality enhancement chain:`);
      console.log(`   Steps: ${chainDetails.steps.length}`);
      console.log(`   Estimated cost: $${chainDetails.totalEstimatedCost}`);
    }

    console.log('\n🎉 Advanced AI techniques test completed successfully!');
    console.log('\n💡 Key capabilities now available:');
    console.log('   ✅ Template-based prompt engineering');
    console.log('   ✅ Cost optimization and budget management');
    console.log('   ✅ Quality assurance and validation');
    console.log('   ✅ Multi-step reasoning chains');
    console.log('   ✅ Advanced analysis workflows');

  } catch (error: any) {
    logger.error('Advanced AI test failed', error);
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('API_KEY')) {
      console.log('\n💡 Make sure you have valid API keys in .env.local');
    }
    
    process.exit(1);
  }
}

testAdvancedAI();