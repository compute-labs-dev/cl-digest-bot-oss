// lib/ai/ai-service.ts

import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { ollama } from 'ollama-ai-provider';
import { generateText, generateObject } from 'ai';
import { 
  AIModelConfig, 
  AIAnalysisRequest, 
  AIAnalysisResponse, 
  TokenUsage,
  DigestAnalysis 
} from '../../types/ai';
import { envConfig } from '../../config/environment';
import logger from '../logger';
import { ProgressTracker } from '../../utils/progress';

export class AIService {
  private static instance: AIService;
  private currentConfig: AIModelConfig;

  // Default configurations for all 4 providers
  private static readonly DEFAULT_OPENAI_CONFIG: AIModelConfig = {
    provider: 'openai',
    modelName: 'gpt-4o',
    options: {
      temperature: 0.7,
      max_tokens: 2000,
    }
  };

  private static readonly DEFAULT_ANTHROPIC_CONFIG: AIModelConfig = {
    provider: 'anthropic',
    modelName: 'claude-3-5-sonnet-20241022',
    options: {
      temperature: 0.7,
      max_tokens: 2000,
      thinking: {
        type: 'enabled',
        budgetTokens: 20000,
      }
    }
  };

  private static readonly DEFAULT_GOOGLE_CONFIG: AIModelConfig = {
    provider: 'google',
    modelName: 'gemini-1.5-pro',
    options: {
      temperature: 0.7,
      max_tokens: 2000,
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        }
      ]
    }
  };

  private static readonly DEFAULT_OLLAMA_CONFIG: AIModelConfig = {
    provider: 'ollama',
    modelName: 'llama3.1:8b', // 8B model for good balance of speed/quality
    options: {
      temperature: 0.7,
      max_tokens: 2000,
      baseURL: 'http://localhost:11434', // Default Ollama server
      keepAlive: '5m' // Keep model loaded for 5 minutes
    }
  };

  private constructor(config?: AIModelConfig) {
    this.currentConfig = config || AIService.DEFAULT_ANTHROPIC_CONFIG;
    this.validateConfiguration();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: AIModelConfig): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService(config);
    } else if (config) {
      AIService.instance.setConfig(config);
    }
    return AIService.instance;
  }

  /**
   * Set AI model configuration
   */
  public setConfig(config: AIModelConfig): void {
    this.currentConfig = config;
    this.validateConfiguration();
    logger.info(`AI model configured: ${config.provider}:${config.modelName}`);
  }

  /**
   * Switch to OpenAI
   */
  public useOpenAI(modelName?: string): void {
    this.setConfig({
      ...AIService.DEFAULT_OPENAI_CONFIG,
      modelName: modelName || AIService.DEFAULT_OPENAI_CONFIG.modelName
    });
  }

  /**
   * Switch to Anthropic Claude
   */
  public useClaude(modelName?: string): void {
    this.setConfig({
      ...AIService.DEFAULT_ANTHROPIC_CONFIG,
      modelName: modelName || AIService.DEFAULT_ANTHROPIC_CONFIG.modelName
    });
  }

  /**
   * Switch to Google Gemini
   */
  public useGemini(modelName?: string): void {
    this.setConfig({
      ...AIService.DEFAULT_GOOGLE_CONFIG,
      modelName: modelName || AIService.DEFAULT_GOOGLE_CONFIG.modelName
    });
  }

  /**
   * Switch to Ollama (local)
   */
  public useOllama(modelName?: string, baseURL?: string): void {
    this.setConfig({
      ...AIService.DEFAULT_OLLAMA_CONFIG,
      modelName: modelName || AIService.DEFAULT_OLLAMA_CONFIG.modelName,
      options: {
        ...AIService.DEFAULT_OLLAMA_CONFIG.options,
        ...(baseURL && { baseURL })
      }
    });
  }

  /**
   * Main analysis method - analyzes content and generates insights
   */
  async analyzeContent(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    const progress = new ProgressTracker({
      total: 4,
      label: `AI Analysis (${this.currentConfig.provider}:${this.currentConfig.modelName})`
    });

    try {
      // Step 1: Prepare content for analysis
      progress.update(1, { step: 'Preparing content' });
      const preparedContent = this.prepareContentForAnalysis(request.content);
      
      // Step 2: Generate analysis prompt
      progress.update(2, { step: 'Generating prompt' });
      const analysisPrompt = this.buildAnalysisPrompt(request, preparedContent);
      
      // Step 3: Call AI model
      progress.update(3, { step: 'AI processing' });
      const aiResponse = await this.callAIModel(analysisPrompt, request.outputFormat);
      
      // Step 4: Process and validate response
      progress.update(4, { step: 'Processing response' });
      const analysis = this.parseAndValidateResponse(aiResponse.text);
      
      const processingTime = Date.now() - startTime;
      progress.complete(`Analysis completed in ${(processingTime / 1000).toFixed(2)}s`);

      return {
        analysis,
        token_usage: this.extractTokenUsage(aiResponse),
        model_info: {
          provider: this.currentConfig.provider,
          model: this.currentConfig.modelName,
          reasoning_time_ms: aiResponse.reasoning_time_ms
        },
        processing_time_ms: processingTime
      };

    } catch (error: any) {
      progress.fail(`AI analysis failed: ${error.message}`);
      logger.error('AI analysis failed', { 
        error: error.message,
        provider: this.currentConfig.provider,
        model: this.currentConfig.modelName 
      });
      throw error;
    }
  }

  /**
   * Prepare content for AI analysis with quality signals for intelligent filtering
   * 
   * This method doesn't just format content - it provides the AI with key signals
   * to make intelligent filtering decisions during content analysis.
   */
  private prepareContentForAnalysis(content: any): string {
    const sections: string[] = [];

    // Add tweets with quality signals for AI filtering
    if (content.tweets?.length > 0) {
      sections.push('## TWITTER/X CONTENT');
      sections.push(`*Note: ${content.tweets.length} tweets passed rule-based filtering. Focus on highest quality and most relevant items.*`);
      sections.push('');
      
      content.tweets.forEach((tweet: any, index: number) => {
        sections.push(`### Tweet ${index + 1}`);
        sections.push(`**Author:** @${tweet.author}`);
        sections.push(`**Date:** ${tweet.created_at}`);
        
        // Quality signals that guide AI filtering decisions
        sections.push(`**Engagement:** ${tweet.engagement_score} (Quality: ${tweet.quality_score.toFixed(2)})`);
        sections.push(`**Priority:** ${tweet.engagement_score > 100 ? 'HIGH' : tweet.engagement_score > 50 ? 'MEDIUM' : 'LOW'}`);
        
        sections.push(`**Content:** ${tweet.text}`);
        sections.push(`**URL:** ${tweet.url}`);
        sections.push('');
      });
    }

    // Add Telegram messages with filtering guidance
    if (content.telegram_messages?.length > 0) {
      sections.push('## TELEGRAM CONTENT');
      sections.push(`*Note: ${content.telegram_messages.length} messages from insider channels. Prioritize unique insights and breaking news.*`);
      sections.push('');
      
      content.telegram_messages.forEach((msg: any, index: number) => {
        sections.push(`### Message ${index + 1}`);
        sections.push(`**Channel:** ${msg.channel}`);
        sections.push(`**Author:** ${msg.author || 'Unknown'}`);
        sections.push(`**Date:** ${msg.message_date}`);
        
        // Quality signals for AI filtering
        sections.push(`**Views:** ${msg.views} (Quality: ${msg.quality_score.toFixed(2)})`);
        sections.push(`**Signal Strength:** ${msg.views > 1000 ? 'STRONG' : msg.views > 500 ? 'MEDIUM' : 'WEAK'}`);
        
        sections.push(`**Content:** ${msg.text}`);
        sections.push(`**URL:** ${msg.url}`);
        sections.push('');
      });
    }

    // Add RSS articles with relevance scoring
    if (content.rss_articles?.length > 0) {
      sections.push('## RSS ARTICLES');
      sections.push(`*Note: ${content.rss_articles.length} articles from news sources. Focus on breaking news and unique analysis.*`);
      sections.push('');
      
      content.rss_articles.forEach((article: any, index: number) => {
        sections.push(`### Article ${index + 1}`);
        sections.push(`**Title:** ${article.title}`);
        sections.push(`**Source:** ${article.source}`);
        sections.push(`**Author:** ${article.author || 'Unknown'}`);
        sections.push(`**Date:** ${article.published_at}`);
        
        // Quality signals for AI filtering decisions
        sections.push(`**Quality Score:** ${article.quality_score.toFixed(2)}`);
        sections.push(`**Content Type:** ${article.quality_score > 0.8 ? 'PREMIUM ANALYSIS' : article.quality_score > 0.6 ? 'STANDARD NEWS' : 'BRIEF UPDATE'}`);
        
        sections.push(`**Summary:** ${article.description}`);
        if (article.content) {
          sections.push(`**Content:** ${article.content.substring(0, 1000)}${article.content.length > 1000 ? '...' : ''}`);
        }
        sections.push(`**URL:** ${article.url}`);
        sections.push('');
      });
    }

    // Add metadata
    sections.push('## METADATA');
    sections.push(`**Timeframe:** ${content.timeframe.from} to ${content.timeframe.to}`);
    sections.push(`**Total Sources:** ${content.metadata.total_sources}`);
    sections.push(`**Source Breakdown:**`);
    sections.push(`- Twitter: ${content.metadata.source_breakdown.twitter} items`);
    sections.push(`- Telegram: ${content.metadata.source_breakdown.telegram} items`);
    sections.push(`- RSS: ${content.metadata.source_breakdown.rss} items`);

    return sections.join('\n');
  }

  /**
   * Call the appropriate AI model based on current configuration
   */
  private async callAIModel(prompt: string, outputFormat: string = 'json'): Promise<any> {
    const { provider, modelName, options } = this.currentConfig;

    const baseOptions = {
      temperature: options.temperature || 0.7,
      maxTokens: options.max_tokens || 2000,
    };

    try {
      switch (provider) {
        case 'openai':
          return await generateText({
            model: openai(modelName),
            prompt,
            ...baseOptions,
            ...(options.reasoning_effort && { reasoningEffort: options.reasoning_effort })
          });

        case 'anthropic':
          return await generateText({
            model: anthropic(modelName),
            prompt,
            ...baseOptions,
            ...(options.thinking && {
              experimental_toolCallMode: 'json',
              experimental_thinking: options.thinking.type === 'enabled',
              ...(options.thinking.budgetTokens && {
                experimental_thinkingBudgetTokens: options.thinking.budgetTokens
              })
            })
          });

        case 'google':
          return await generateText({
            model: google(modelName),
            prompt,
            ...baseOptions,
            ...(options.safetySettings && { safetySettings: options.safetySettings })
          });

        case 'ollama':
          return await generateText({
            model: ollama(modelName),
            prompt,
            ...baseOptions
          });

        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }
    } catch (error: any) {
      // Add provider-specific error handling
      if (provider === 'ollama' && error?.message?.includes('ECONNREFUSED')) {
        throw new Error('Ollama server not running. Start it with: ollama serve');
      }
      if (provider === 'google' && error?.message?.includes('API_KEY_INVALID')) {
        throw new Error('Invalid Google API key. Check GOOGLE_GENERATIVE_AI_API_KEY environment variable');
      }
      throw error;
    }
  }

  /**
   * Build analysis prompt that guides AI filtering and content selection
   * 
   * This prompt is crucial - it instructs the AI to act as an intelligent filter,
   * not just a summarizer. The AI will select, prioritize, and curate content.
   */
  private buildAnalysisPrompt(request: AIAnalysisRequest, preparedContent: string): string {
    const baseInstructions = `You are an expert content analyst and curator specializing in technology, finance, and current events. 

Your job has TWO phases:
1. INTELLIGENT FILTERING: Select only the most valuable, relevant, and newsworthy content
2. ANALYSIS: Generate actionable insights from your curated selection

CONTENT CURATION GUIDELINES:
- IGNORE repetitive, off-topic, or low-value content
- PRIORITIZE breaking news, unique insights, and emerging trends
- COMBINE multiple sources discussing the same topic into single insights
- FOCUS on content with high engagement scores and quality ratings
- SELECT content that provides genuine value to readers

ANALYSIS REQUIREMENTS:
1. Focus on the most significant trends and patterns from your curated selection
2. Prioritize high-quality, high-engagement content you've selected
3. Identify emerging themes from your filtered content
4. Provide balanced, objective analysis based on your curation
5. Include confidence levels for your assessments
6. Cite specific examples from the content you chose to include

OUTPUT FORMAT: Return a valid JSON object with the following structure:
{
  "title": "Concise title summarizing the key theme (max 100 chars)",
  "executive_summary": "3-4 sentence overview of the most important findings",
  "key_insights": ["Array of 3-5 key insights, each 1-2 sentences"],
  "trending_topics": [
    {
      "topic": "Topic name",
      "relevance_score": 0.8,
      "supporting_content": ["Brief quotes or references"],
      "trend_direction": "rising|stable|declining"
    }
  ],
  "content_analysis": {
    "sentiment": {
      "overall": "positive|negative|neutral",
      "confidence": 0.85,
      "breakdown": {"positive": 60, "neutral": 30, "negative": 10}
    },
    "themes": [
      {"name": "Theme name", "frequency": 5, "significance": 0.9}
    ],
    "quality_distribution": {
      "high_quality_percentage": 75,
      "average_engagement": 150,
      "content_diversity": 0.8
    }
  },
  "recommendations": ["Array of 2-4 actionable recommendations"],
  "confidence_score": 0.85
}`;

    // Add specific instructions based on analysis type
    let specificInstructions = '';
    switch (request.analysisType) {
      case 'digest':
        specificInstructions = `
DIGEST-SPECIFIC INSTRUCTIONS:
- Create a comprehensive daily digest format
- Highlight breaking news and significant developments
- Connect related stories across different sources
- Identify market implications and business opportunities
- Focus on actionable intelligence for decision-makers`;
        break;
      
      case 'summary':
        specificInstructions = `
SUMMARY-SPECIFIC INSTRUCTIONS:
- Provide concise, factual summaries
- Maintain key details and context
- Avoid speculation or analysis beyond the source material
- Focus on information density and clarity`;
        break;
      
      case 'sentiment':
        specificInstructions = `
SENTIMENT-SPECIFIC INSTRUCTIONS:
- Perform detailed sentiment analysis
- Identify emotional tone and market sentiment
- Analyze sentiment trends over time
- Provide confidence levels for sentiment assessments`;
        break;
    }

    if (request.instructions) {
      specificInstructions += `\n\nADDITIONAL INSTRUCTIONS:\n${request.instructions}`;
    }

    return `${baseInstructions}\n${specificInstructions}\n\nCONTENT TO ANALYZE:\n\n${preparedContent}`;
  }



  /**
   * Parse and validate AI response
   */
  private parseAndValidateResponse(responseText: string): DigestAnalysis {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      const required = ['title', 'executive_summary', 'key_insights', 'trending_topics', 'content_analysis', 'recommendations', 'confidence_score'];
      for (const field of required) {
        if (!(field in parsed)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Validate structure
      if (!Array.isArray(parsed.key_insights)) {
        throw new Error('key_insights must be an array');
      }
      
      if (!Array.isArray(parsed.trending_topics)) {
        throw new Error('trending_topics must be an array');
      }

      if (!parsed.content_analysis.sentiment) {
        throw new Error('content_analysis.sentiment is required');
      }

      return parsed as DigestAnalysis;

    } catch (error: any) {
      logger.error('Failed to parse AI response', { error: error.message, response: responseText.substring(0, 500) });
      
      // Fallback response
      return {
        title: 'Analysis Failed',
        executive_summary: 'Unable to process the content due to parsing errors.',
        key_insights: ['Content analysis could not be completed'],
        trending_topics: [],
        content_analysis: {
          sentiment: {
            overall: 'neutral',
            confidence: 0.0,
            breakdown: { positive: 33, neutral: 33, negative: 33 }
          },
          themes: [],
          quality_distribution: {
            high_quality_percentage: 0,
            average_engagement: 0,
            content_diversity: 0
          }
        },
        recommendations: ['Please review the content and try again'],
        confidence_score: 0.0
      };
    }
  }

  /**
   * Extract token usage from AI response
   */
  private extractTokenUsage(response: any): TokenUsage {
    const usage = response.usage;
    if (!usage) {
      return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    }

    return {
      prompt_tokens: usage.promptTokens || 0,
      completion_tokens: usage.completionTokens || 0,
      total_tokens: usage.totalTokens || 0,
      reasoning_tokens: usage.reasoningTokens,
      cache_read_tokens: usage.cacheReadTokens
    };
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(): void {
    const { provider, modelName } = this.currentConfig;
    
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for OpenAI');
    }
    
    if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for Anthropic');
    }

    if (provider === 'google' && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is required for Google Gemini');
    }

    // Note: Ollama doesn't require API key validation as it's a local service

    logger.debug('AI configuration validated', { provider, modelName });
  }

  /**
   * Get current configuration
   */
  public getConfig(): AIModelConfig {
    return { ...this.currentConfig };
  }

  /**
   * Test AI connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const testRequest: AIAnalysisRequest = {
        content: {
          tweets: [{
            id: 'test',
            text: 'This is a test tweet about AI technology.',
            author: 'test_user',
            created_at: new Date().toISOString(),
            engagement_score: 10,
            quality_score: 0.8,
            url: 'https://twitter.com/test'
          }],
          timeframe: {
            from: new Date().toISOString(),
            to: new Date().toISOString()
          },
          metadata: {
            total_sources: 1,
            source_breakdown: { twitter: 1, telegram: 0, rss: 0 }
          }
        },
        analysisType: 'summary'
      };

      const response = await this.analyzeContent(testRequest);
      logger.info(`AI connection test successful: ${this.currentConfig.provider}:${this.currentConfig.modelName}`);
      logger.info(response);
      return true;

    } catch (error) {
      logger.error(`AI connection test failed: ${this.currentConfig.provider}:${this.currentConfig.modelName}`, error);
      return false;
    }
  }
}
