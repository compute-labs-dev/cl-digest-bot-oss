// types/chat.ts

import { ParsedIntent } from './agent';
import { ConfigOperationResult } from './config-agent';

export interface ChatMessage {
    id: string;
    type: 'user' | 'agent' | 'system';
    content: string;
    timestamp: Date;
    status?: 'sending' | 'sent' | 'processing' | 'completed' | 'error';
    
    // Rich content for agent responses
    intent?: ParsedIntent;
    previewData?: ActionPreview;
    executionResult?: ConfigOperationResult;
    suggestedActions?: SuggestedAction[];
  }
  
  export interface ActionPreview {
    title: string;
    description: string;
    changes: PreviewChange[];
    warnings?: string[];
    requiresConfirmation: boolean;
    estimatedImpact: 'low' | 'medium' | 'high';
    actionId?: string;
  }
  
  export interface PreviewChange {
    type: 'add' | 'remove' | 'modify';
    category: 'twitter' | 'rss' | 'telegram' | 'ai_model' | 'settings';
    description: string;
    details: {
      before?: string;
      after?: string;
      value?: string;
    };
  }
  
  export interface SuggestedAction {
    label: string;
    description: string;
    command: string;
    category: 'common' | 'advanced' | 'help';
  }
  
  export interface ChatState {
    messages: ChatMessage[];
    isLoading: boolean;
    currentInput: string;
    pendingAction?: {
      messageId: string;
      preview: ActionPreview;
    };
  }