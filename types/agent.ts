// types/agent.ts

// Primary intent categories
type IntentType = 
  // Source management
  | 'ADD_TWITTER_SOURCE' | 'REMOVE_TWITTER_SOURCE'
  | 'ADD_RSS_SOURCE' | 'REMOVE_RSS_SOURCE' 
  | 'ADD_TELEGRAM_SOURCE' | 'REMOVE_TELEGRAM_SOURCE'
  
  // AI model management  
  | 'CHANGE_AI_MODEL' | 'ADJUST_AI_SETTINGS'
  
  // Digest generation
  | 'RUN_DIGEST' | 'SCHEDULE_DIGEST'
  
  // System status
  | 'GET_STATUS' | 'GET_SOURCES' | 'GET_RECENT_DIGESTS' | 'GET_DIGEST_BY_ID' | 'GET_HELP'
  
  // Multi-action
  | 'MULTI_ACTION' | 'UNKNOWN';

export interface ParsedIntent {
    type: IntentType;
    entities: ExtractedEntities;
    confidence: number;
    originalMessage: string;
    suggestedActions?: ActionSuggestion[];
    requiresConfirmation?: boolean;
}

export interface ExtractedEntities {
    // Source identifiers
    twitterUsernames?: string[];
      rssUrls?: string[];
  rssBrands?: string[];
  digestId?: string;
    telegramChannels?: string[];
    
    // AI model settings
    aiModel?: 'openai' | 'anthropic' | 'google' | 'ollama';
    modelName?: string;
    
    // Digest parameters
    timeRange?: string;
    maxSources?: number;
    focusTopics?: string[];
    skipSources?: string[];
    
    // System parameters
    schedule?: string;
    outputFormat?: string;
}
  
  export interface ActionSuggestion {
    action: string;
    description: string;
    confidence: number;
    parameters?: Record<string, any>;
}
  
  export interface IntentRecognitionResult {
    success: boolean;
    intent?: ParsedIntent;
    error?: string;
    needsClarification?: {
        question: string;
        options?: string[];
    };
}