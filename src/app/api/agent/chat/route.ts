// app/api/agent/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { IntentParser } from '../../../../../lib/agent/intent-parser';
import { ConfigurationAgent } from '../../../../../lib/agent/configuration-agent';
import { ActionPreview, PreviewChange } from '../../../../../types/chat';
import logger from '../../../../../lib/logger';

const intentParser = new IntentParser();
const configAgent = new ConfigurationAgent();

import { pendingActions } from '../shared-storage';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ 
        message: '❌ Please provide a valid message.',
        error: 'Invalid input' 
      }, { status: 400 });
    }

    logger.info('Received chat message', { message });

    // Parse user intent
    const intentResult = await intentParser.parseIntent(message);
    
    if (!intentResult.success) {
      // For parsing failures, show comprehensive help by default
      const helpResult = await configAgent.executeIntent({
        type: 'GET_HELP',
        entities: {},
        confidence: 1.0,
        originalMessage: message,
        requiresConfirmation: false
      });
      
      return NextResponse.json({
        message: helpResult.message,
        suggestedActions: [
          {
            label: "Add Twitter Source",
            description: "Add a Twitter account to monitor",
            command: "Add @username to Twitter sources",
            category: 'common'
          },
          {
            label: "Generate Digest",
            description: "Create a new digest",
            command: "Generate digest with current settings",
            category: 'common'
          },
          {
            label: "View Sources",
            description: "See current configuration",
            command: "Show current sources",
            category: 'info'
          }
        ]
      });
    }

    const intent = intentResult.intent!;

    // Check if this requires user confirmation
    if (shouldRequireConfirmation(intent)) {
      // Generate preview to check if there are actual changes
      const preview = await generateActionPreview(intent);
      
      // If no changes detected, ask for clarification
      if (preview.changes.length === 0) {
        return NextResponse.json({
          message: getClarificationMessage(intent),
          intent,
          suggestedActions: getClarificationSuggestions(intent)
        });
      }
      
      // Store pending action only when there are actual changes
      const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      pendingActions.set(actionId, { intent, timestamp: Date.now() });
      


      return NextResponse.json({
        message: getPreviewMessage(intent),
        intent,
        preview: {
          ...preview,
          actionId
        }
      });
    } else {
      // Execute immediately for safe actions (like status queries)
      const result = await configAgent.executeIntent(intent);
      
      return NextResponse.json({
        message: result.message,
        intent,
        result,
        suggestedActions: getSuggestedActionsForResult(result)
      });
    }

  } catch (error: any) {
    logger.error('Chat API error', { error: error.message });
    
    return NextResponse.json({
      message: '❌ I encountered an error processing your request. Please try again.',
      error: error.message
    }, { status: 500 });
  }
}

function shouldRequireConfirmation(intent: any): boolean {
  // Always require confirmation for configuration changes
  const configurationIntents = [
    'ADD_TWITTER_SOURCE',
    'REMOVE_TWITTER_SOURCE',
    'ADD_RSS_SOURCE',
    'REMOVE_RSS_SOURCE',
    'CHANGE_AI_MODEL',
    'MULTI_ACTION'
  ];
  
  return configurationIntents.includes(intent.type) || intent.confidence < 0.8;
}

async function generateActionPreview(intent: any): Promise<ActionPreview> {
  const changes: PreviewChange[] = [];
  let title = 'Configuration Change';
  let description = 'Review the changes below before applying.';
  let estimatedImpact: 'low' | 'medium' | 'high' = 'low';

  switch (intent.type) {
    case 'ADD_TWITTER_SOURCE':
      title = 'Add Twitter Sources';
      description = `Add ${intent.entities.twitterUsernames?.length || 0} Twitter account(s) to monitoring.`;
      estimatedImpact = 'low';
      
      intent.entities.twitterUsernames?.forEach((username: string) => {
        changes.push({
          type: 'add',
          category: 'twitter',
          description: `Add @${username} to Twitter sources`,
          details: {
            value: `@${username}`
          }
        });
      });
      break;

    case 'ADD_RSS_SOURCE':
      title = 'Add RSS Sources';
      description = `Add ${intent.entities.rssUrls?.length || 0} RSS feed(s) to monitoring.`;
      estimatedImpact = 'low';
      
      intent.entities.rssUrls?.forEach((url: string) => {
        changes.push({
          type: 'add',
          category: 'rss',
          description: `Add RSS feed: ${url}`,
          details: {
            value: url
          }
        });
      });
      break;

    case 'CHANGE_AI_MODEL':
      title = 'Switch AI Model';
      description = `Change AI provider to ${intent.entities.aiModel?.toUpperCase()}.`;
      estimatedImpact = 'medium';
      
      changes.push({
        type: 'modify',
        category: 'ai_model',
        description: `Switch AI provider to ${intent.entities.aiModel}`,
        details: {
          after: intent.entities.aiModel
        }
      });
      break;

    case 'MULTI_ACTION':
      title = 'Multiple Changes';
      description = 'Multiple configuration changes will be applied.';
      estimatedImpact = 'medium';
      
      // Add changes for each sub-action
      if (intent.entities.twitterUsernames) {
        intent.entities.twitterUsernames.forEach((username: string) => {
          changes.push({
            type: 'add',
            category: 'twitter',
            description: `Add @${username} to Twitter sources`,
            details: { value: `@${username}` }
          });
        });
      }
      
      if (intent.entities.aiModel) {
        changes.push({
          type: 'modify',
          category: 'ai_model',
          description: `Switch to ${intent.entities.aiModel} model`,
          details: { after: intent.entities.aiModel }
        });
      }
      break;
  }

  return {
    title,
    description,
    changes,
    requiresConfirmation: changes.length > 0,
    estimatedImpact,
    warnings: generateWarnings(intent)
  };
}

function generateWarnings(intent: any): string[] {
  const warnings: string[] = [];
  
  if (intent.confidence < 0.8) {
    warnings.push(`Low confidence (${(intent.confidence * 100).toFixed(0)}%) - please review carefully.`);
  }
  
  if (intent.type === 'CHANGE_AI_MODEL' && intent.entities.aiModel === 'ollama') {
    warnings.push('Switching to Ollama requires the local server to be running.');
  }
  
  if (intent.entities.twitterUsernames?.length > 5) {
    warnings.push('Adding many Twitter sources may increase API usage and costs.');
  }
  
  return warnings;
}

function getPreviewMessage(intent: any): string {
  switch (intent.type) {
    case 'ADD_TWITTER_SOURCE':
      const usernames = intent.entities.twitterUsernames?.map((u: string) => `@${u}`).join(', ');
      return `I'll add ${usernames} to your Twitter sources. Please review the changes below.`;
    
    case 'CHANGE_AI_MODEL':
      return `I'll switch your AI model to ${intent.entities.aiModel?.toUpperCase()}. Please confirm this change.`;
    
    case 'MULTI_ACTION':
      return 'I understand you want to make multiple changes. Please review them below.';
    
    default:
      return 'Please review the planned changes below before I apply them.';
  }
}

function getClarificationMessage(intent: any): string {
  switch (intent.type) {
    case 'ADD_TWITTER_SOURCE':
      return '❌ I couldn\'t find any Twitter usernames to add. Please specify usernames like "@elonmusk" or "sama".';
    
    case 'ADD_RSS_SOURCE':
      return '❌ I couldn\'t find any RSS feeds to add. Please provide either a direct RSS URL or a brand name like "TechCrunch RSS".';
    
    case 'REMOVE_TWITTER_SOURCE':
      return '❌ I couldn\'t find any Twitter usernames to remove. Please specify which usernames to remove.';
    
    case 'REMOVE_RSS_SOURCE':
      return '❌ I couldn\'t find any RSS feeds to remove. Please specify which feeds to remove.';
    
    case 'CHANGE_AI_MODEL':
      return '❌ I couldn\'t determine which AI model to switch to. Please specify a model like "Gemini", "Claude", "OpenAI", or "Ollama".';
    
    default:
      return '❌ I understood your intent but couldn\'t find the specific details needed. Could you please be more specific?';
  }
}

function getClarificationSuggestions(intent: any) {
  switch (intent.type) {
    case 'ADD_TWITTER_SOURCE':
      return [
        {
          label: "Add Twitter User",
          description: "Add a specific Twitter account",
          command: "Add @elonmusk to Twitter sources",
          category: 'common'
        },
        {
          label: "Add Multiple Users",
          description: "Add several Twitter accounts",
          command: "Add @sama and @naval to Twitter sources",
          category: 'common'
        }
      ];
    
    case 'ADD_RSS_SOURCE':
      return [
        {
          label: "Add RSS by Brand",
          description: "Add a popular RSS feed",
          command: "Subscribe to TechCrunch RSS",
          category: 'common'
        },
        {
          label: "Add RSS by URL",
          description: "Add a specific RSS feed URL",
          command: "Add https://feeds.feedburner.com/TechCrunch to RSS",
          category: 'common'
        }
      ];
    
    case 'CHANGE_AI_MODEL':
      return [
        {
          label: "Switch to Gemini",
          description: "Use Google's Gemini model",
          command: "Switch to Gemini model",
          category: 'common'
        },
        {
          label: "Switch to Claude",
          description: "Use Anthropic's Claude model",
          command: "Switch to Claude model",
          category: 'common'
        }
      ];
    
    default:
      return [
        {
          label: "Get Help",
          description: "See what I can do",
          command: "What can I do?",
          category: 'help'
        },
        {
          label: "View Sources",
          description: "Check current configuration",
          command: "Show me current sources",
          category: 'common'
        }
      ];
  }
}

function getSuggestedActionsForResult(result: any) {
  if (result.success) {
    return [
      {
        label: "View Sources",
        description: "See all configured sources",
        command: "Show me current sources",
        category: 'common'
      },
      {
        label: "Generate Digest",
        description: "Create a digest with current settings",
        command: "Generate a digest",
        category: 'common'
      }
    ];
  } else {
    return [
      {
        label: "Get Help",
        description: "Learn about available commands",
        command: "What can I do?",
        category: 'help'
      },
      {
        label: "Check Status",
        description: "View system status",
        command: "What's the system status?",
        category: 'common'
      }
    ];
  }
}