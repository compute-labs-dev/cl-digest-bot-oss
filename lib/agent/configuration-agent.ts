// lib/agent/configuration-agent.ts

import { ParsedIntent, ExtractedEntities } from '../../types/agent';
import { ConfigOperationResult, ConfigurationChange, ConfigValidationResult } from '../../types/config-agent';
import { SourceManager } from './source-manager';
import { AIModelManager } from './ai-model-manager';
import { ChangeTracker } from './change-tracker';
import { AIService } from '../ai/ai-service';
import { DigestPipeline } from '../automation/digest-pipeline';
import { DigestStorage } from '../digest/digest-storage';
import logger from '../logger';
import { v4 as uuidv4 } from 'uuid';

export class ConfigurationAgent {
  private sourceManager: SourceManager;
  private aiModelManager: AIModelManager;
  private changeTracker: ChangeTracker;
  private digestStorage: DigestStorage;
  private aiService: AIService;

  constructor() {
    this.sourceManager = new SourceManager();
    this.aiModelManager = new AIModelManager();
    this.changeTracker = new ChangeTracker();
    this.digestStorage = new DigestStorage();
    this.aiService = AIService.getInstance();
    
    logger.info('ConfigurationAgent initialized');
  }

  /**
   * Execute configuration changes based on parsed intent
   */
  async executeIntent(intent: ParsedIntent): Promise<ConfigOperationResult> {
    const changeId = uuidv4();
    
    try {
      logger.info('Executing configuration intent', { 
        type: intent.type, 
        changeId,
        confidence: intent.confidence 
      });

      // Low confidence intents require confirmation
      if (intent.confidence < 0.7) {
        return {
          success: false,
          message: `I'm not confident about this request (${(intent.confidence * 100).toFixed(0)}% confidence). Please rephrase or confirm you want to: ${this.describeIntent(intent)}`,
          validationErrors: ['Low confidence score requires confirmation']
        };
      }

      // Route to appropriate handler
      switch (intent.type) {
        case 'ADD_TWITTER_SOURCE':
          return await this.handleAddTwitterSource(intent.entities, changeId);
        
        case 'REMOVE_TWITTER_SOURCE':
          return await this.handleRemoveTwitterSource(intent.entities, changeId);
          
        case 'ADD_RSS_SOURCE':
          return await this.handleAddRSSSource(intent.entities, changeId);
          
        case 'REMOVE_RSS_SOURCE':
          return await this.handleRemoveRSSSource(intent.entities, changeId);
          
        case 'CHANGE_AI_MODEL':
          return await this.handleChangeAIModel(intent.entities, changeId);
          
        case 'RUN_DIGEST':
          return await this.handleRunDigest(intent.entities, changeId);
          
        case 'GET_STATUS':
          return await this.handleGetStatus();
          
        case 'GET_SOURCES':
          return await this.handleGetSources();
          
        case 'GET_RECENT_DIGESTS':
          return await this.handleGetRecentDigests();
          
        case 'GET_DIGEST_BY_ID':
          return await this.handleGetDigestById(intent.entities);
          
        case 'GET_HELP':
          return await this.handleGetHelp();
          
        case 'MULTI_ACTION':
          return await this.handleMultiAction(intent, changeId);
          
        case 'UNKNOWN':
        default:
          // For unknown intents, show comprehensive help
          return await this.handleGetHelp();
      }

    } catch (error: any) {
      logger.error('Configuration intent execution failed', { 
        error: error.message, 
        changeId, 
        intent: intent.type 
      });

      return {
        success: false,
        message: `Failed to execute configuration change: ${error.message}`,
        validationErrors: [error.message]
      };
    }
  }

  /**
   * Handle adding Twitter source
   */
  private async handleAddTwitterSource(entities: ExtractedEntities, changeId: string): Promise<ConfigOperationResult> {
    if (!entities.twitterUsernames || entities.twitterUsernames.length === 0) {
      return {
        success: false,
        message: 'No Twitter usernames specified. Please provide usernames to add.',
        validationErrors: ['Missing Twitter usernames']
      };
    }

    const results: ConfigOperationResult[] = [];
    
    for (const username of entities.twitterUsernames) {
      // Validate username exists and is accessible
      const validation = await this.sourceManager.validateTwitterUsername(username);
      if (!validation.valid) {
        results.push({
          success: false,
          message: `Cannot add @${username}: ${validation.errors.join(', ')}`,
          validationErrors: validation.errors
        });
        continue;
      }

      // Add to configuration
      const result = await this.sourceManager.addTwitterSource(username, changeId);
      results.push(result);
    }

    // Combine results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length > 0 && failed.length === 0) {
      const usernames = entities.twitterUsernames.map(u => `@${u}`).join(', ');
      return {
        success: true,
        changeId,
        message: `✅ Successfully added ${usernames} to Twitter sources`,
        changes: successful.flatMap(r => r.changes || [])
      };
    } else if (successful.length > 0 && failed.length > 0) {
      const successNames = successful.map((_, i) => `@${entities.twitterUsernames![i]}`).join(', ');
      const failedNames = failed.map((_, i) => `@${entities.twitterUsernames![i]}`).join(', ');
      return {
        success: true,
        changeId,
        message: `⚠️ Added ${successNames} but failed to add ${failedNames}`,
        changes: successful.flatMap(r => r.changes || []),
        validationErrors: failed.flatMap(r => r.validationErrors || [])
      };
    } else {
      return {
        success: false,
        message: `❌ Failed to add any Twitter sources`,
        validationErrors: failed.flatMap(r => r.validationErrors || [])
      };
    }
  }

  /**
   * Handle removing Twitter source
   */
  private async handleRemoveTwitterSource(entities: ExtractedEntities, changeId: string): Promise<ConfigOperationResult> {
    if (!entities.twitterUsernames || entities.twitterUsernames.length === 0) {
      return {
        success: false,
        message: 'No Twitter usernames specified. Please provide usernames to remove.',
        validationErrors: ['Missing Twitter usernames']
      };
    }

    const results: ConfigOperationResult[] = [];
    
    for (const username of entities.twitterUsernames) {
      const result = await this.sourceManager.removeTwitterSource(username, changeId);
      results.push(result);
    }

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length > 0 && failed.length === 0) {
      const usernames = entities.twitterUsernames.map(u => `@${u}`).join(', ');
      return {
        success: true,
        changeId,
        message: `✅ Successfully removed ${usernames} from Twitter sources`,
        changes: successful.flatMap(r => r.changes || [])
      };
    } else {
      return {
        success: false,
        message: `❌ Failed to remove Twitter sources`,
        validationErrors: failed.flatMap(r => r.validationErrors || [])
      };
    }
  }

  /**
   * Handle adding RSS source
   */
  private async handleAddRSSSource(entities: ExtractedEntities, changeId: string): Promise<ConfigOperationResult> {
    if (!entities.rssUrls || entities.rssUrls.length === 0) {
      return {
        success: false,
        message: 'No RSS URLs specified. Please provide RSS feed URLs to add.',
        validationErrors: ['Missing RSS URLs']
      };
    }

    const results: ConfigOperationResult[] = [];
    
    for (const url of entities.rssUrls) {
      // Validate RSS feed
      const validation = await this.sourceManager.validateRSSFeed(url);
      if (!validation.valid) {
        results.push({
          success: false,
          message: `Cannot add RSS feed ${url}: ${validation.errors.join(', ')}`,
          validationErrors: validation.errors
        });
        continue;
      }

      const result = await this.sourceManager.addRSSSource(url, changeId);
      results.push(result);
    }

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length > 0 && failed.length === 0) {
      return {
        success: true,
        changeId,
        message: `✅ Successfully added ${successful.length} RSS feed(s)`,
        changes: successful.flatMap(r => r.changes || [])
      };
    } else {
      return {
        success: false,
        message: `❌ Failed to add RSS feeds`,
        validationErrors: failed.flatMap(r => r.validationErrors || [])
      };
    }
  }

  /**
   * Handle removing RSS source
   */
  private async handleRemoveRSSSource(entities: ExtractedEntities, changeId: string): Promise<ConfigOperationResult> {
    if (!entities.rssUrls || entities.rssUrls.length === 0) {
      return {
        success: false,
        message: 'No RSS URLs specified. Please provide RSS feed URLs to remove.',
        validationErrors: ['Missing RSS URLs']
      };
    }

    const results: ConfigOperationResult[] = [];
    
    for (const url of entities.rssUrls) {
      const result = await this.sourceManager.removeRSSSource(url, changeId);
      results.push(result);
    }

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length > 0 && failed.length === 0) {
      return {
        success: true,
        changeId,
        message: `✅ Successfully removed ${successful.length} RSS feed(s)`,
        changes: successful.flatMap(r => r.changes || [])
      };
    } else {
      return {
        success: false,
        message: `❌ Failed to remove RSS feeds`,
        validationErrors: failed.flatMap(r => r.validationErrors || [])
      };
    }
  }

  /**
   * Handle AI model changes
   */
  private async handleChangeAIModel(entities: ExtractedEntities, changeId: string): Promise<ConfigOperationResult> {
    if (!entities.aiModel) {
      return {
        success: false,
        message: 'No AI model specified. Please specify which model to use (OpenAI, Claude, Gemini, or Ollama).',
        validationErrors: ['Missing AI model']
      };
    }

    // Validate model is available
    const validation = await this.aiModelManager.validateModel(entities.aiModel, entities.modelName);
    if (!validation.valid) {
      return {
        success: false,
        message: `Cannot switch to ${entities.aiModel}: ${validation.errors.join(', ')}`,
        validationErrors: validation.errors
      };
    }

    // Switch model
    const result = await this.aiModelManager.switchModel(entities.aiModel, entities.modelName, changeId);
    
    if (result.success) {
      // Get cost comparison
      const costInfo = this.aiModelManager.getCostComparison(entities.aiModel);
      
      return {
        success: true,
        changeId,
        message: `✅ Switched to ${entities.aiModel.toUpperCase()} model. ${costInfo}`,
        changes: result.changes
      };
    } else {
      return result;
    }
  }

  /**
   * Handle digest generation with custom parameters
   */
  private async handleRunDigest(entities: ExtractedEntities, changeId: string): Promise<ConfigOperationResult> {
    try {
      // Build digest options from entities
      const digestOptions: any = {
        maxContentAge: 24 // Default 24 hours
      };
      
      if (entities.timeRange) {
        digestOptions.maxContentAge = this.parseTimeRangeToHours(entities.timeRange);
      }
      
      if (entities.maxSources) {
        digestOptions.maxSources = entities.maxSources;
      }
      
      // Configure pipeline options
      const pipelineConfig = {
        enableTwitter: !entities.skipSources?.includes('twitter'),
        enableTelegram: !entities.skipSources?.includes('telegram'),
        enableRSS: !entities.skipSources?.includes('rss'),
        aiModel: 'anthropic',
        aiModelName: 'claude-3-5-sonnet-20241022',
        analysisType: 'digest',
        postToSlack: false,
        minQualityThreshold: 0.7,
        maxContentAge: digestOptions.maxContentAge
      };

      // Log the digest generation request
      const change: ConfigurationChange = {
        id: changeId,
        type: 'RUN_DIGEST' as any,
        description: `Generate digest with custom parameters`,
        parameters: digestOptions,
        timestamp: new Date(),
        status: 'applied'
      };

      await this.changeTracker.logChange(change);

      // Start the actual digest pipeline in the background
      this.executeDigestPipeline(pipelineConfig, changeId);

      return {
        success: true,
        changeId,
        message: `🚀 Starting digest generation with your custom parameters...`,
        changes: [change]
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Failed to start digest generation: ${error.message}`,
        validationErrors: [error.message]
      };
    }
  }

  /**
   * Execute digest pipeline in background
   */
  private async executeDigestPipeline(config: any, changeId: string): Promise<void> {
    try {
      logger.info('Starting digest pipeline execution', { changeId, config });
      
      const pipeline = new DigestPipeline(config);
      await pipeline.execute();
      
      logger.info('Digest pipeline completed successfully', { changeId });
      
      // TODO: For now this runs in background. In the future, we should:
      // 1. Use WebSocket/SSE to stream progress updates to the UI
      // 2. Return the digest result (Twitter URL, digest content) to the user
      // 3. Show live progress bars and status updates during generation
      
    } catch (error: any) {
      logger.error('Digest pipeline execution failed', { changeId, error: error.message });
    }
  }

  /**
   * Handle system status requests
   */
  private async handleGetStatus(): Promise<ConfigOperationResult> {
    try {
      const status = await this.getSystemStatus();
      
      return {
        success: true,
        message: `📊 System Status:\n${status}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to get system status: ${error.message}`,
        validationErrors: [error.message]
      };
    }
  }

  /**
   * Handle get sources requests
   */
  private async handleGetSources(): Promise<ConfigOperationResult> {
    try {
      const sources = await this.sourceManager.getCurrentSources();
      
      let message = "📋 Current Sources:\n";
      message += `• Twitter: ${sources.twitter.length} accounts\n`;
      message += `• RSS: ${sources.rss.length} feeds\n`;
      message += `• Telegram: ${sources.telegram.length} channels`;
      
      if (sources.twitter.length > 0) {
        message += `\n\nTwitter accounts: ${sources.twitter.map(u => `@${u}`).join(', ')}`;
      }

      return {
        success: true,
        message
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to get sources: ${error.message}`,
        validationErrors: [error.message]
      };
    }
  }

  /**
   * Handle recent digests requests
   */
  private async handleGetRecentDigests(): Promise<ConfigOperationResult> {
    try {
      const digests = await this.digestStorage.getRecentDigests(5);
      
      if (digests.length === 0) {
        return {
          success: true,
          message: "📭 No recent digests found. Generate your first digest to get started!"
        };
      }

      let message = `📊 Recent Digests (${digests.length}):\n\n`;
      
      for (const digest of digests) {
        const date = new Date(digest.created_at).toLocaleDateString();
        message += `🔖 **${digest.title}**\n`;
        message += `   📅 ${date}\n`;
        message += `   🤖 ${digest.ai_provider}:${digest.ai_model}\n`;
        message += `   📋 ID: ${digest.id}\n\n`;
      }

      return {
        success: true,
        message
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to get recent digests: ${error.message}`,
        validationErrors: [error.message]
      };
    }
  }

  /**
   * Handle get digest by ID requests
   */
  private async handleGetDigestById(entities: ExtractedEntities): Promise<ConfigOperationResult> {
    try {
      if (!entities.digestId) {
        return {
          success: false,
          message: "❌ Please provide a digest ID. Example: 'show digest fee6c2b0-21b8-4fb6-a8b5-5277c344511d'",
          validationErrors: ['Missing digest ID']
        };
      }

      const digest = await this.digestStorage.getDigest(entities.digestId);
      
      if (!digest) {
        return {
          success: false,
          message: `❌ Digest not found: ${entities.digestId}`,
          validationErrors: ['Digest not found']
        };
      }

      // Format the digest content for display
      const date = new Date(digest.created_at).toLocaleDateString();
      const time = new Date(digest.created_at).toLocaleTimeString();
      
      let message = `📊 **${digest.title}**\n\n`;
      message += `📅 **Created:** ${date} at ${time}\n`;
      message += `🤖 **AI Model:** ${digest.ai_provider}:${digest.ai_model}\n`;
      message += `📋 **ID:** ${digest.id}\n\n`;
      
      message += `📝 **Summary:**\n${digest.summary}\n\n`;
      
      // Show key points if available
      if (digest.content && digest.content.key_points) {
        message += `🔑 **Key Points:**\n`;
        digest.content.key_points.forEach((point: string, index: number) => {
          message += `${index + 1}. ${point}\n`;
        });
        message += '\n';
      }
      
      // Show sections if available
      if (digest.content && digest.content.sections) {
        message += `📚 **Sections:**\n`;
        digest.content.sections.forEach((section: any) => {
          message += `**${section.title}** (${section.source_count} sources)\n`;
          if (section.summary) {
            message += `   ${section.summary}\n`;
          }
        });
      }

      return {
        success: true,
        message
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to get digest: ${error.message}`,
        validationErrors: [error.message]
      };
    }
  }

  /**
   * Handle help requests - show all available commands
   */
  private async handleGetHelp(): Promise<ConfigOperationResult> {
    try {
      let message = `🤖 **Digest Bot Assistant - Available Commands**\n\n`;
      
      message += `## 📊 **Source Management**\n`;
      message += `• *"Add @username to Twitter sources"* - Monitor Twitter accounts\n`;
      message += `• *"Subscribe to TechCrunch RSS"* - Add RSS feeds\n`;
      message += `• *"Remove @username from Twitter"* - Stop monitoring accounts\n`;
      message += `• *"Show current sources"* - List all configured sources\n\n`;
      
      message += `## 🤖 **AI Configuration**\n`;
      message += `• *"Switch to Claude model"* - Change AI provider\n`;
      message += `• *"Change to OpenAI"* - Use OpenAI GPT models\n`;
      message += `• *"Switch to Gemini"* - Use Google Gemini\n`;
      message += `• *"Use Ollama"* - Use local Ollama models\n\n`;
      
      message += `## 📰 **Digest Generation**\n`;
      message += `• *"Generate digest with current settings"* - Create new digest\n`;
      message += `• *"Show recent digests"* - View digest history\n`;
      message += `• *"Show digest [ID]"* - View specific digest details\n\n`;
      
      message += `## ⚙️ **System Information**\n`;
      message += `• *"What's the system status?"* - Check system health\n`;
      message += `• *"Show sources"* - List current configuration\n`;
      message += `• *"What can I do?"* - Show this help message\n\n`;
      
      message += `## 🔧 **Advanced Examples**\n`;
      message += `• *"Add @elonmusk and @sama to Twitter, then switch to Claude"*\n`;
      message += `• *"Subscribe to Hacker News RSS and The Verge"*\n`;
      message += `• *"Generate a digest about AI from last 24 hours"*\n\n`;
      
      message += `## 💡 **Tips**\n`;
      message += `• Use natural language - I understand context!\n`;
      message += `• I'll show previews before making changes\n`;
      message += `• You can combine multiple actions in one message\n`;
      message += `• Say "help" anytime to see this list again`;

      return {
        success: true,
        message
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to show help: ${error.message}`,
        validationErrors: [error.message]
      };
    }
  }

  /**
   * Handle multiple actions in sequence
   */
  private async handleMultiAction(intent: ParsedIntent, changeId: string): Promise<ConfigOperationResult> {
    const results: ConfigOperationResult[] = [];
    let overallSuccess = true;
    
    // Create sub-intents for each action
    const subIntents = this.extractSubIntents(intent);
    
    for (const subIntent of subIntents) {
      const result = await this.executeIntent(subIntent);
      results.push(result);
      
      if (!result.success) {
        overallSuccess = false;
      }
    }

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (overallSuccess) {
      return {
        success: true,
        changeId,
        message: `✅ Completed all ${results.length} actions successfully`,
        changes: successful.flatMap(r => r.changes || [])
      };
    } else {
      return {
        success: false,
        message: `⚠️ Completed ${successful.length}/${results.length} actions. ${failed.length} failed.`,
        changes: successful.flatMap(r => r.changes || []),
        validationErrors: failed.flatMap(r => r.validationErrors || [])
      };
    }
  }

  /**
   * Rollback a configuration change
   */
  async rollbackChange(changeId: string): Promise<ConfigOperationResult> {
    try {
      const result = await this.changeTracker.rollbackChange(changeId);
      
      if (result.success) {
        return {
          success: true,
          message: `✅ Successfully rolled back change ${changeId}`,
          changes: result.changes
        };
      } else {
        return {
          success: false,
          message: `Failed to rollback change: ${result.error}`,
          validationErrors: [result.error || 'Unknown rollback error']
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Rollback failed: ${error.message}`,
        validationErrors: [error.message]
      };
    }
  }

  /**
   * Get recent configuration changes
   */
  async getRecentChanges(limit: number = 10): Promise<ConfigurationChange[]> {
    return await this.changeTracker.getRecentChanges(limit);
  }

  // Helper methods
  private describeIntent(intent: ParsedIntent): string {
    switch (intent.type) {
      case 'ADD_TWITTER_SOURCE':
        return `add ${intent.entities.twitterUsernames?.map(u => `@${u}`).join(', ')} to Twitter sources`;
      case 'CHANGE_AI_MODEL':
        return `switch to ${intent.entities.aiModel} AI model`;
      default:
        return `perform ${intent.type.toLowerCase().replace('_', ' ')}`;
    }
  }

  private extractSubIntents(multiIntent: ParsedIntent): ParsedIntent[] {
    // Extract individual intents from multi-action intent
    const subIntents: ParsedIntent[] = [];
    
    if (multiIntent.entities.twitterUsernames) {
      subIntents.push({
        type: 'ADD_TWITTER_SOURCE',
        entities: { twitterUsernames: multiIntent.entities.twitterUsernames },
        confidence: multiIntent.confidence,
        originalMessage: multiIntent.originalMessage
      });
    }
    
    if (multiIntent.entities.aiModel) {
      subIntents.push({
        type: 'CHANGE_AI_MODEL',
        entities: { aiModel: multiIntent.entities.aiModel },
        confidence: multiIntent.confidence,
        originalMessage: multiIntent.originalMessage
      });
    }
    
    return subIntents;
  }

  private parseTimeRangeToHours(timeRange: string): number {
    const match = timeRange.match(/(\d+)([hdw])/);
    if (!match) return 24;
    
    const [, num, unit] = match;
    const number = parseInt(num);
    
    switch (unit) {
      case 'h': return number;
      case 'd': return number * 24;
      case 'w': return number * 24 * 7;
      default: return 24;
    }
  }

  private async getSystemStatus(): Promise<string> {
    const currentModel = this.aiService.getConfig();
    const sources = await this.sourceManager.getCurrentSources();
    const recentChanges = await this.getRecentChanges(3);
    
    let status = `🤖 AI Model: ${currentModel.provider}/${currentModel.modelName}\n`;
    status += `📊 Sources: ${sources.twitter.length} Twitter, ${sources.rss.length} RSS, ${sources.telegram.length} Telegram\n`;
    status += `🔄 Recent Changes: ${recentChanges.length}`;
    
    return status;
  }
}