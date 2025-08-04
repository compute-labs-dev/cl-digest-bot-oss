// lib/agent/source-manager.ts

import fs from 'fs/promises';
import path from 'path';
import { ConfigOperationResult, ConfigurationChange, ConfigValidationResult } from '../../types/config-agent';
import { TwitterClient } from '../twitter/twitter-client';
import logger from '../logger';

export class SourceManager {
  private configPath: string;
  private backupPath: string;

  constructor() {   
    this.configPath = path.join(process.cwd(), 'config', 'data-sources-config.ts');
    this.backupPath = path.join(process.cwd(), '.agent-backups');
  }

  /**
   * Add Twitter source to configuration
   */
  async addTwitterSource(username: string, changeId: string): Promise<ConfigOperationResult> {
    try {
      // Create backup
      await this.createConfigBackup(changeId);
      
      // Read current config
      const config = await this.readConfig();
      
      // Check if already exists
      if (config.twitter.accounts.includes(username)) {
        return {
          success: false,
          message: `@${username} is already in your Twitter sources`,
          validationErrors: ['Username already exists']
        };
      }

      // Add username
      config.twitter.accounts.push(username);
      
      // Write updated config
      await this.writeConfig(config);
      
      // Log change
      const change: ConfigurationChange = {
        id: changeId,
        type: 'ADD_TWITTER_SOURCE',
        description: `Added @${username} to Twitter sources`,
        parameters: { username },
        timestamp: new Date(),
        status: 'applied',
        rollbackData: { action: 'remove', username }
      };

      return {
        success: true,
        changeId,
        message: `✅ Added @${username} to Twitter sources`,
        changes: [change]
      };

    } catch (error: any) {
      logger.error('Failed to add Twitter source', { username, error: error.message });
      return {
        success: false,
        message: `Failed to add @${username}: ${error.message}`,
        validationErrors: [error.message]
      };
    }
  }

  /**
   * Remove Twitter source from configuration
   */
  async removeTwitterSource(username: string, changeId: string): Promise<ConfigOperationResult> {
    try {
      await this.createConfigBackup(changeId);
      
      const config = await this.readConfig();
      
      const index = config.twitter.accounts.indexOf(username);
      if (index === -1) {
        return {
          success: false,
          message: `@${username} is not in your Twitter sources`,
          validationErrors: ['Username not found']
        };
      }

      // Remove username
      config.twitter.accounts.splice(index, 1);
      
      await this.writeConfig(config);

      const change: ConfigurationChange = {
        id: changeId,
        type: 'REMOVE_TWITTER_SOURCE', 
        description: `Removed @${username} from Twitter sources`,
        parameters: { username },
        timestamp: new Date(),
        status: 'applied',
        rollbackData: { action: 'add', username }
      };

      return {
        success: true,
        changeId,
        message: `✅ Removed @${username} from Twitter sources`,
        changes: [change]
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Failed to remove @${username}: ${error.message}`,
        validationErrors: [error.message]
      };
    }
  }

  /**
   * Add RSS source to configuration
   */
  async addRSSSource(url: string, changeId: string): Promise<ConfigOperationResult> {
    try {
      await this.createConfigBackup(changeId);
      
      const config = await this.readConfig();
      
      if (config.rss.feeds.includes(url)) {
        return {
          success: false,
          message: `RSS feed ${url} is already configured`,
          validationErrors: ['RSS feed already exists']
        };
      }

      config.rss.feeds.push(url);
      await this.writeConfig(config);

      const change: ConfigurationChange = {
        id: changeId,
        type: 'ADD_RSS_SOURCE',
        description: `Added RSS feed: ${url}`,
        parameters: { url },
        timestamp: new Date(),
        status: 'applied',
        rollbackData: { action: 'remove', url }
      };

      return {
        success: true,
        changeId,
        message: `✅ Added RSS feed to sources`,
        changes: [change]
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Failed to add RSS feed: ${error.message}`,
        validationErrors: [error.message]
      };
    }
  }

  /**
   * Remove RSS source from configuration
   */
  async removeRSSSource(url: string, changeId: string): Promise<ConfigOperationResult> {
    try {
      await this.createConfigBackup(changeId);
      
      const config = await this.readConfig();
      
      const urlIndex = config.rss.feeds.indexOf(url);
      if (urlIndex === -1) {
        return {
          success: false,
          message: `RSS feed ${url} is not configured`,
          validationErrors: ['RSS feed not found']
        };
      }

      config.rss.feeds.splice(urlIndex, 1);
      await this.writeConfig(config);

      const change: ConfigurationChange = {
        id: changeId,
        type: 'REMOVE_RSS_SOURCE',
        description: `Removed RSS feed: ${url}`,
        parameters: { url },
        timestamp: new Date(),
        status: 'applied',
        rollbackData: { action: 'add', url }
      };

      return {
        success: true,
        changeId,
        message: `✅ Removed RSS feed from sources`,
        changes: [change]
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Failed to remove RSS feed: ${error.message}`,
        validationErrors: [error.message]
      };
    }
  }

  /**
   * Validate Twitter username exists and is accessible
   */
  async validateTwitterUsername(username: string): Promise<ConfigValidationResult> {
    try {
      // Basic format validation
      if (!/^[A-Za-z0-9_]{1,15}$/.test(username)) {
        return {
          valid: false,
          errors: ['Invalid Twitter username format'],
          warnings: []
        };
      }

      // Check if account exists (if we have API access)
      const twitterClient = new TwitterClient();
      if (await twitterClient.testConnection()) {
        try {
          await twitterClient.fetchUserTweets(username);
        } catch (error) {
          return {
            valid: false,
            errors: ['Twitter account does not exist or is private'],
            warnings: []
          };
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
        errors: [`Validation failed: ${error.message}`],
        warnings: ['Could not verify account exists - proceeding with caution']
      };
    }
  }

  /**
   * Validate RSS feed is accessible and valid
   */
  async validateRSSFeed(url: string): Promise<ConfigValidationResult> {
    try {
      // Basic URL validation
      new URL(url);

      // Try to fetch RSS feed
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeout);

      if (!response.ok) {
        return {
          valid: false,
          errors: [`RSS feed returned ${response.status}: ${response.statusText}`],
          warnings: []
        };
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('xml') && !contentType.includes('rss')) {
        return {
          valid: true,
          errors: [],
          warnings: ['Content type may not be RSS - proceeding anyway']
        };
      }

      return {
        valid: true,
        errors: [],
        warnings: []
      };

    } catch (error: any) {
      return {
        valid: false,
        errors: [`Invalid RSS URL: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Get current sources from configuration
   */
  async getCurrentSources(): Promise<{ twitter: string[], rss: string[], telegram: string[] }> {
    try {
      const config = await this.readConfig();
      return {
        twitter: config.twitter?.accounts || [],
        rss: config.rss?.feeds || [],
        telegram: config.telegram?.channels || []
      };
    } catch (error: any) {
      logger.error('Failed to get current sources', error);
      return { twitter: [], rss: [], telegram: [] };
    }
  }

  // Configuration file management
  private async readConfig(): Promise<any> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      
      // Extract configuration object from TypeScript file
      // This is a simplified parser - in production you might use AST parsing
      const configMatch = content.match(/export const (\w+Config) = \{([\s\S]*?)\};/g);
      
      if (!configMatch) {
        throw new Error('Could not parse configuration file');
      }

      // For demo purposes, return a simplified structure
      // In production, you'd want proper TypeScript AST parsing
      return {
        twitter: { accounts: this.extractTwitterAccounts(content) },
        rss: { feeds: this.extractRSSFeeds(content) },
        telegram: { channels: this.extractTelegramChannels(content) }
      };

    } catch (error: any) {
      throw new Error(`Failed to read config: ${error.message}`);
    }
  }

  private async writeConfig(config: any): Promise<void> {
    try {
      // Read original file
      const originalContent = await fs.readFile(this.configPath, 'utf-8');
      
      // Update Twitter accounts section
      let updatedContent = this.updateTwitterAccountsInContent(originalContent, config.twitter.accounts);
      
      // Update RSS feeds section  
      updatedContent = this.updateRSSFeedsInContent(updatedContent, config.rss.feeds);
      
      // Write back to file
      await fs.writeFile(this.configPath, updatedContent, 'utf-8');
      
      logger.info('Configuration file updated successfully');

    } catch (error: any) {
      throw new Error(`Failed to write config: ${error.message}`);
    }
  }

  private async createConfigBackup(changeId: string): Promise<void> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupPath, { recursive: true });
      
      // Copy current config to backup
      const backupFile = path.join(this.backupPath, `config-${changeId}-${Date.now()}.ts`);
      await fs.copyFile(this.configPath, backupFile);
      
      logger.info('Configuration backup created', { backupFile });

    } catch (error) {
      logger.warn('Failed to create config backup', error);
      // Don't fail the operation for backup issues
    }
  }

  // Simple content extraction methods (in production, use proper AST parsing)
  private extractTwitterAccounts(content: string): string[] {
    const accountsMatch = content.match(/accounts:\s*\[([\s\S]*?)\]/);
    if (!accountsMatch) return [];
    
    const accountsStr = accountsMatch[1];
    const accounts = accountsStr.match(/'([^']+)'/g) || [];
    return accounts.map(acc => acc.replace(/'/g, ''));
  }

  private extractRSSFeeds(content: string): string[] {
    // Extract RSS feed URLs from feedOverrides object
    const feedOverridesMatch = content.match(/feedOverrides:\s*\{([\s\S]*?)\}\s*as Record/);
    if (!feedOverridesMatch) return [];
    
    const overridesStr = feedOverridesMatch[1];
    const urlMatches = overridesStr.match(/'(https?:\/\/[^']+)'/g) || [];
    return urlMatches.map(url => url.replace(/'/g, ''));
  }

  private extractTelegramChannels(content: string): string[] {
    // Similar extraction logic for Telegram channels
    return [];
  }

  private updateTwitterAccountsInContent(content: string, accounts: string[]): string {
    const accountsArray = accounts.map(acc => `'${acc}'`).join(',\n    ');
    const replacement = `accounts: [\n    ${accountsArray}\n  ]`;
    
    return content.replace(/accounts:\s*\[([\s\S]*?)\]/, replacement);
  }

  private updateRSSFeedsInContent(content: string, feeds: string[]): string {
    // Generate feedOverrides object with all feeds
    const feedEntries = feeds.map(feed => `    '${feed}': { articlesPerFeed: 10 }`).join(',\n');
    const newFeedOverrides = `feedOverrides: {\n${feedEntries}\n  }`;
    
    // Replace the existing feedOverrides section
    return content.replace(
      /feedOverrides:\s*\{([\s\S]*?)\}\s*as Record/,
      `${newFeedOverrides} as Record`
    );
  }
}