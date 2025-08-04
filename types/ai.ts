// types/ai.ts

export interface AIModelConfig {
    provider: 'openai' | 'anthropic' | 'google' | 'ollama';
    modelName: string;
    options: {
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      // OpenAI-specific options
      reasoning_effort?: 'low' | 'medium' | 'high'; // OpenAI o1 models
      // Anthropic-specific options
      thinking?: {  // Anthropic Claude thinking
        type: 'enabled' | 'disabled';
        budgetTokens?: number;
      };
      // Google Gemini-specific options
      safetySettings?: Array<{
        category: string;
        threshold: string;
      }>;
      // Ollama-specific options
      baseURL?: string; // Custom Ollama server URL
      keepAlive?: string; // Keep model loaded in memory
    };
  }
  
  export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens?: number; // For OpenAI o1 models
    cache_read_tokens?: number; // For Anthropic caching
  }
  
  export interface AIAnalysisRequest {
    content: ContentForAnalysis;
    analysisType: 'digest' | 'summary' | 'categorization' | 'sentiment';
    instructions?: string;
    outputFormat?: 'json' | 'markdown' | 'text';
  }
  
  export interface ContentForAnalysis {
    tweets?: AnalysisTweet[];
    telegram_messages?: AnalysisTelegramMessage[];
    rss_articles?: AnalysisRSSArticle[];
    timeframe: {
      from: string;
      to: string;
    };
    metadata: {
      total_sources: number;
      source_breakdown: {
        twitter: number;
        telegram: number;
        rss: number;
      };
    };
  }
  
  export interface AnalysisTweet {
    id: string;
    text: string;
    author: string;
    created_at: string;
    engagement_score: number;
    quality_score: number;
    url: string;
  }
  
  export interface AnalysisTelegramMessage {
    id: string;
    text: string;
    channel: string;
    author?: string;
    message_date: string;
    views: number;
    quality_score: number;
    url: string;
  }
  
  export interface AnalysisRSSArticle {
    id: string;
    title: string;
    content?: string;
    description: string;
    author?: string;
    published_at: string;
    source: string;
    quality_score: number;
    url: string;
  }
  
  export interface AIAnalysisResponse {
    analysis: DigestAnalysis;
    token_usage: TokenUsage;
    model_info: {
      provider: string;
      model: string;
      reasoning_time_ms?: number;
    };
    processing_time_ms: number;
  }
  
  export interface DigestAnalysis {
    title: string;
    executive_summary: string;
    key_insights: string[];
    trending_topics: TrendingTopic[];
    content_analysis: ContentAnalysis;
    recommendations: string[];
    confidence_score: number;
  }
  
  export interface TrendingTopic {
    topic: string;
    relevance_score: number;
    supporting_content: string[];
    trend_direction: 'rising' | 'stable' | 'declining';
  }
  
  export interface ContentAnalysis {
    sentiment: {
      overall: 'positive' | 'negative' | 'neutral';
      confidence: number;
      breakdown: {
        positive: number;
        neutral: number;
        negative: number;
      };
    };
    themes: {
      name: string;
      frequency: number;
      significance: number;
    }[];
    quality_distribution: {
      high_quality_percentage: number;
      average_engagement: number;
      content_diversity: number;
    };
  }