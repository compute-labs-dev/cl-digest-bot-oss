// lib/ai/ai-service.ts

import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
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

  // Default configurations
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      progress.fail(`AI analysis failed: ${errorMessage}`);
      logger.error('AI analysis failed', { 
        error: errorMessage,
        provider: this.currentConfig.provider,
        model: this.currentConfig.modelName 
      });
      throw error;
    }
  }

  /**
   * Prepare content for AI analysis (filtering and formatting)
   */
  private prepareContentForAnalysis(content: any): string {
    const sections: string[] = [];

    // Add tweets if available
    if (content.tweets?.length > 0) {
      sections.push('## TWITTER/X CONTENT');
      content.tweets.forEach((tweet: any, index: number) => {
        sections.push(`### Tweet ${index + 1}`);
        sections.push(`**Author:** @${tweet.author}`);
        sections.push(`**Date:** ${tweet.created_at}`);
        sections.push(`**Engagement:** ${tweet.engagement_score} (Quality: ${tweet.quality_score.toFixed(2)})`);
        sections.push(`**Content:** ${tweet.text}`);
        sections.push(`**URL:** ${tweet.url}`);
        sections.push('');
      });
    }

    // Add Telegram messages if available
    if (content.telegram_messages?.length > 0) {
      sections.push('## TELEGRAM CONTENT');
      content.telegram_messages.forEach((msg: any, index: number) => {
        sections.push(`### Message ${index + 1}`);
        sections.push(`**Channel:** ${msg.channel}`);
        sections.push(`**Author:** ${msg.author || 'Unknown'}`);
        sections.push(`**Date:** ${msg.message_date}`);
        sections.push(`**Views:** ${msg.views} (Quality: ${msg.quality_score.toFixed(2)})`);
        sections.push(`**Content:** ${msg.text}`);
        sections.push(`**URL:** ${msg.url}`);
        sections.push('');
      });
    }

    // Add RSS articles if available
    if (content.rss_articles?.length > 0) {
      sections.push('## RSS ARTICLES');
      content.rss_articles.forEach((article: any, index: number) => {
        sections.push(`### Article ${index + 1}`);
        sections.push(`**Title:** ${article.title}`);
        sections.push(`**Source:** ${article.source}`);
        sections.push(`**Author:** ${article.author || 'Unknown'}`);
        sections.push(`**Date:** ${article.published_at}`);
        sections.push(`**Quality:** ${article.quality_score.toFixed(2)}`);
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
   * Build analysis prompt based on request type
   */
  private buildAnalysisPrompt(request: AIAnalysisRequest, preparedContent: string): string {
    const baseInstructions = `You are an expert content analyst specializing in technology, finance, and current events. Your task is to analyze the provided content and generate actionable insights.

ANALYSIS REQUIREMENTS:
1. Focus on the most significant trends and patterns
2. Prioritize high-quality, high-engagement content
3. Identify emerging themes and topics
4. Provide balanced, objective analysis
5. Include confidence levels for your assessments
6. Cite specific examples to support your insights

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
   * Call the appropriate AI model
   */
  private async callAIModel(prompt: string, outputFormat: string = 'json'): Promise<any> {
    const startTime = Date.now();
    
    try {
      if (this.currentConfig.provider === 'openai') {
        return await this.callOpenAI(prompt, outputFormat);
      } else {
        return await this.callAnthropic(prompt, outputFormat);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`AI model call failed after ${duration}ms`, {
        provider: this.currentConfig.provider,
        model: this.currentConfig.modelName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string, outputFormat: string): Promise<any> {
    const model = openai(this.currentConfig.modelName);
    
    const result = await generateText({
      model,
      prompt,
      temperature: this.currentConfig.options.temperature || 0.7,
      maxTokens: this.currentConfig.options.max_tokens || 2000,
      topP: this.currentConfig.options.top_p,
    });

    return {
      text: result.text,
      usage: result.usage,
      reasoning_time_ms: result.usage?.completionTokens ? 
        (result.usage.completionTokens * 50) : undefined // Rough estimate for reasoning time
    };
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(prompt: string, outputFormat: string): Promise<any> {
    const model = anthropic(this.currentConfig.modelName);
    
    const modelOptions: any = {
      temperature: this.currentConfig.options.temperature || 0.7,
      maxTokens: this.currentConfig.options.max_tokens || 2000,
    };

    // Add thinking configuration for Claude models
    if (this.currentConfig.options.thinking?.type === 'enabled') {
      modelOptions.thinking = {
        budgetTokens: this.currentConfig.options.thinking.budgetTokens || 20000
      };
    }

    const result = await generateText({
      model,
      prompt,
      ...modelOptions
    });

    return {
      text: result.text,
      usage: result.usage,
      reasoning_time_ms: result.usage?.promptTokens ? 
        (result.usage.promptTokens * 2) : undefined // Rough estimate for reasoning time
    };
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
      return true;

    } catch (error) {
      logger.error(`AI connection test failed: ${this.currentConfig.provider}:${this.currentConfig.modelName}`, error);
      return false;
    }
  }
}