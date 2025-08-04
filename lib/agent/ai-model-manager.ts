// lib/agent/ai-model-manager.ts

import { AIService } from '../ai/ai-service';
import { ConfigOperationResult, ConfigurationChange, ConfigValidationResult } from '../../types/config-agent';
import fs from 'fs/promises';
import path from 'path';
import logger from '../logger';

export class AIModelManager {
  private aiService: AIService;
  private configFile: string;

  constructor() {
    this.configFile = path.join(process.cwd(), 'config', 'current-ai-model.json');
    this.aiService = AIService.getInstance();
    
    // Load persisted configuration on startup (don't await)
    this.loadPersistedConfig().catch(err => 
      logger.debug('Failed to load persisted AI config on startup', err)
    );
  }

  /**
   * Switch AI model provider
   */
  async switchModel(provider: 'openai' | 'anthropic' | 'google' | 'ollama', modelName?: string, changeId?: string): Promise<ConfigOperationResult> {
    try {
      const previousConfig = this.aiService.getConfig();
      
      // Switch to new model
      switch (provider) {
        case 'openai':
          this.aiService.useOpenAI(modelName);
          break;
        case 'anthropic':
          this.aiService.useClaude(modelName);
          break;
        case 'google':
          this.aiService.useGemini(modelName);
          break;
        case 'ollama':
          this.aiService.useOllama(modelName);
          break;
      }

      // Test the new model
      const testResult = await this.testModelConnection();
      if (!testResult.valid) {
        // Rollback on failure
        if (previousConfig) {
          await this.restoreModelConfig(previousConfig);
        }
        
        return {
          success: false,
          message: `Failed to switch to ${provider}: ${testResult.errors.join(', ')}`,
          validationErrors: testResult.errors
        };
      }

      // Persist the configuration to prevent reset on refresh
      await this.persistAIConfig(provider, modelName);

      const change: ConfigurationChange = {
        id: changeId || 'ai-model-change',
        type: 'CHANGE_AI_MODEL',
        description: `Switched AI model to ${provider}${modelName ? `/${modelName}` : ''}`,
        parameters: { provider, modelName },
        timestamp: new Date(),
        status: 'applied',
        rollbackData: previousConfig
      };

      return {
        success: true,
        changeId,
        message: `✅ Successfully switched to ${provider.toUpperCase()} model`,
        changes: [change]
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Failed to switch AI model: ${error.message}`,
        validationErrors: [error.message]
      };
    }
  }

  /**
   * Validate model is available and working
   */
  async validateModel(provider: 'openai' | 'anthropic' | 'google' | 'ollama', modelName?: string): Promise<ConfigValidationResult> {
    try {
      // Check environment variables
      const envVars = this.getRequiredEnvVars(provider);
      const missingVars = envVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        return {
          valid: false,
          errors: [`Missing environment variables: ${missingVars.join(', ')}`],
          warnings: []
        };
      }

      // For Ollama, check if server is running
      if (provider === 'ollama') {
        const ollamaRunning = await this.checkOllamaServer();
        if (!ollamaRunning) {
          return {
            valid: false,
            errors: ['Ollama server is not running. Start it with: ollama serve'],
            warnings: []
          };
        }

        // Check if model is available
        if (modelName) {
          const modelAvailable = await this.checkOllamaModel(modelName);
          if (!modelAvailable) {
            return {
              valid: false,
              errors: [`Ollama model '${modelName}' not found. Pull it with: ollama pull ${modelName}`],
              warnings: []
            };
          }
        }
      }

      return {
        valid: true,
        errors: [],
        warnings: []
      };

    } catch (error: any) {
      return {
        valid: false,
        errors: [`Model validation failed: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Get cost comparison information
   */
  getCostComparison(newProvider: string): string {
    const costInfo = {
      openai: { cost: '$0.10-0.50', description: 'Premium quality, balanced cost' },
      anthropic: { cost: '$0.15-0.75', description: 'Highest quality analysis, premium cost' },
      google: { cost: '$0.05-0.25', description: 'Cost-effective with good performance' },
      ollama: { cost: 'Free', description: 'No API costs, runs locally' }
    };

    const info = costInfo[newProvider as keyof typeof costInfo];
    if (!info) return '';

    return `💰 Cost: ${info.cost} per digest. ${info.description}`;
  }

  /**
   * Test model connection with a simple request
   */
  private async testModelConnection(): Promise<ConfigValidationResult> {
    try {
      const testPrompt = "Hello, please respond with 'OK' to confirm you're working.";
      
      const response = await this.aiService.generateText({
        prompt: testPrompt,
        maxTokens: 10,
        temperature: 0
      });

      if (response.text.toLowerCase().includes('ok')) {
        return {
          valid: true,
          errors: [],
          warnings: []
        };
      } else {
        return {
          valid: false,
          errors: ['Model responded but output was unexpected'],
          warnings: []
        };
      }

    } catch (error: any) {
      return {
        valid: false,
        errors: [`Model connection test failed: ${error.message}`],
        warnings: []
      };
    }
  }

  private getRequiredEnvVars(provider: string): string[] {
    switch (provider) {
      case 'openai': return ['OPENAI_API_KEY'];
      case 'anthropic': return ['ANTHROPIC_API_KEY'];
      case 'google': return ['GOOGLE_API_KEY'];
      case 'ollama': return []; // Ollama runs locally, no API key needed
      default: return [];
    }
  }

  private async checkOllamaServer(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch('http://localhost:11434/api/tags', { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkOllamaModel(modelName: string): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      
      return data.models?.some((model: any) => 
        model.name.startsWith(modelName.split(':')[0])
      ) || false;
    } catch {
      return false;
    }
  }

  private async restoreModelConfig(config: any): Promise<void> {
    if (config.provider && this.aiService.setConfig) {
      this.aiService.setConfig(config);
    }
  }

  /**
   * Persist AI configuration to file to prevent reset on refresh
   */
  private async persistAIConfig(provider: string, modelName?: string): Promise<void> {
    try {
      const config = {
        provider,
        modelName,
        timestamp: new Date().toISOString()
      };
      
      await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));
      logger.info('AI configuration persisted', { provider, modelName });
    } catch (error: any) {
      logger.warn('Failed to persist AI configuration', { error: error.message });
      // Don't fail the operation for persistence issues
    }
  }

  /**
   * Load persisted AI configuration on startup
   */
  private async loadPersistedConfig(): Promise<void> {
    try {
      const content = await fs.readFile(this.configFile, 'utf-8');
      const config = JSON.parse(content);
      
      if (config.provider && config.modelName) {
        // Switch to the persisted model
        switch (config.provider) {
          case 'openai':
            this.aiService.useOpenAI(config.modelName);
            break;
          case 'anthropic':
            this.aiService.useClaude(config.modelName);
            break;
          case 'google':
            this.aiService.useGemini(config.modelName);
            break;
          case 'ollama':
            this.aiService.useOllama(config.modelName);
            break;
        }
        
        logger.info('Loaded persisted AI configuration', { 
          provider: config.provider, 
          modelName: config.modelName 
        });
      }
    } catch (error: any) {
      logger.debug('No persisted AI configuration found, using defaults');
      // File doesn't exist or is invalid, use defaults
    }
  }
}