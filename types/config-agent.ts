// types/config-agent.ts

export interface ConfigurationChange {
    id: string;
    type: ConfigChangeType;
    description: string;
    parameters: Record<string, any>;
    timestamp: Date;
    status: 'pending' | 'applied' | 'failed' | 'rolled_back';
    rollbackData?: any;
  }
  
  export type ConfigChangeType = 
    | 'ADD_TWITTER_SOURCE' | 'REMOVE_TWITTER_SOURCE'
    | 'ADD_RSS_SOURCE' | 'REMOVE_RSS_SOURCE'
    | 'ADD_TELEGRAM_SOURCE' | 'REMOVE_TELEGRAM_SOURCE'
    | 'CHANGE_AI_MODEL' | 'UPDATE_AI_SETTINGS'
    | 'UPDATE_CACHE_SETTINGS' | 'UPDATE_FILTER_SETTINGS';
  
  export interface ConfigOperationResult {
    success: boolean;
    changeId?: string;
    message: string;
    changes?: ConfigurationChange[];
    rollbackAvailable?: boolean;
    validationErrors?: string[];
    warnings?: string[];
  }
  
  export interface ConfigValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    suggestions?: string[];
  }
  
  export interface ConfigBackup {
    id: string;
    timestamp: Date;
    description: string;
    configSnapshot: {
      dataSources: any;
      aiSettings: any;
      environment: Record<string, string>;
    };
  }