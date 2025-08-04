// lib/agent/change-tracker.ts

import fs from 'fs/promises';
import path from 'path';
import { ConfigurationChange } from '../../types/config-agent';
import logger from '../logger';

export class ChangeTracker {
  private changesFile: string;
  private changes: ConfigurationChange[] = [];

  constructor() {
    this.changesFile = path.join(process.cwd(), '.agent-changes.json');
    this.loadChanges();
  }

  /**
   * Log a configuration change
   */
  async logChange(change: ConfigurationChange): Promise<void> {
    try {
      this.changes.unshift(change); // Add to beginning
      
      // Keep only last 100 changes
      if (this.changes.length > 100) {
        this.changes = this.changes.slice(0, 100);
      }

      await this.saveChanges();
      logger.info('Configuration change logged', { changeId: change.id, type: change.type });

    } catch (error) {
      logger.error('Failed to log configuration change', error);
    }
  }

  /**
   * Get recent configuration changes
   */
  async getRecentChanges(limit: number = 10): Promise<ConfigurationChange[]> {
    return this.changes.slice(0, limit);
  }

  /**
   * Rollback a specific change
   */
  async rollbackChange(changeId: string): Promise<{ success: boolean; error?: string; changes?: ConfigurationChange[] }> {
    try {
      const change = this.changes.find(c => c.id === changeId);
      if (!change) {
        return { success: false, error: 'Change not found' };
      }

      if (change.status === 'rolled_back') {
        return { success: false, error: 'Change already rolled back' };
      }

      if (!change.rollbackData) {
        return { success: false, error: 'No rollback data available' };
      }

      // Execute rollback based on change type
      const rollbackResult = await this.executeRollback(change);
      
      if (rollbackResult.success) {
        // Mark as rolled back
        change.status = 'rolled_back';
        await this.saveChanges();
        
        return {
          success: true,
          changes: [change]
        };
      } else {
        return rollbackResult;
      }

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeRollback(change: ConfigurationChange): Promise<{ success: boolean; error?: string }> {
    // This would integrate with SourceManager and AIModelManager to actually rollback changes
    // For now, we'll just mark it as rolled back
    
    logger.info('Executing rollback', { changeId: change.id, type: change.type });
    
    try {
      switch (change.type) {
        case 'ADD_TWITTER_SOURCE':
          // Would call sourceManager.removeTwitterSource(rollbackData.username)
          break;
        case 'REMOVE_TWITTER_SOURCE':
          // Would call sourceManager.addTwitterSource(rollbackData.username)
          break;
        case 'CHANGE_AI_MODEL':
          // Would restore previous AI model configuration
          break;
      }
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async loadChanges(): Promise<void> {
    try {
      const content = await fs.readFile(this.changesFile, 'utf-8');
      this.changes = JSON.parse(content);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty array
      this.changes = [];
    }
  }

  private async saveChanges(): Promise<void> {
    try {
      await fs.writeFile(this.changesFile, JSON.stringify(this.changes, null, 2));
    } catch (error) {
      logger.error('Failed to save changes file', error);
    }
  }
}