// lib/slack/slack-notifier.ts

import { WebClient } from '@slack/web-api';
import logger from '../logger';

export interface SlackNotification {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  twitterUrl?: string;
  error?: string;
  metadata?: {
    digest_id?: string;
    sources_count?: number;
    processing_time?: number;
  };
}

export class SlackNotifier {
  private client!: WebClient;
  private channelId!: string;
  private isConfigured: boolean = false;

  constructor() {
    try {
      const botToken = process.env.SLACK_BOT_TOKEN;
      this.channelId = process.env.SLACK_CHANNEL_ID || '#general';

      if (botToken) {
        this.client = new WebClient(botToken);
        this.isConfigured = true;
        logger.info('Slack notifier initialized');
      } else {
        logger.warn('Slack bot token not configured - notifications disabled');
        this.isConfigured = false;
      }
    } catch (error) {
      logger.error('Failed to initialize Slack notifier', error);
      this.isConfigured = false;
    }
  }

  /**
   * Send digest completion notification
   */
  async notifyDigestComplete(
    digestTitle: string, 
    twitterUrl?: string, 
    metadata?: any
  ): Promise<void> {
    if (!this.isConfigured) return;

    const notification: SlackNotification = {
      type: 'success',
      title: 'Digest Published Successfully! 🚀',
      message: `New digest "${digestTitle}" has been generated and posted to Twitter.`,
      twitterUrl,
      metadata
    };

    await this.sendNotification(notification);
  }

  /**
   * Send digest failure notification
   */
  async notifyDigestError(error: string, step?: string): Promise<void> {
    if (!this.isConfigured) return;

    const notification: SlackNotification = {
      type: 'error',
      title: 'Digest Pipeline Failed ❌',
      message: `The digest pipeline failed${step ? ` during ${step}` : ''}.`,
      error
    };

    await this.sendNotification(notification);
  }

  /**
   * Send general info notification
   */
  async notifyInfo(title: string, message: string, metadata?: any): Promise<void> {
    if (!this.isConfigured) return;

    const notification: SlackNotification = {
      type: 'info',
      title,
      message,
      metadata
    };

    await this.sendNotification(notification);
  }

  /**
   * Send notification to Slack
   */
  private async sendNotification(notification: SlackNotification): Promise<void> {
    try {
      const blocks = this.buildNotificationBlocks(notification);

      await this.client.chat.postMessage({
        channel: this.channelId,
        text: notification.title,
        blocks: blocks
      });

      logger.info('Slack notification sent', { type: notification.type });

    } catch (error) {
      logger.error('Failed to send Slack notification', error);
    }
  }

  /**
   * Build Slack message blocks
   */
  private buildNotificationBlocks(notification: SlackNotification): any[] {
    const blocks = [];

    // Header
    const emoji = notification.type === 'success' ? '✅' : 
                  notification.type === 'error' ? '❌' : 'ℹ️';
    
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${notification.title}`
      }
    });

    // Main message
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: notification.message
      }
    });

    // Twitter link if available
    if (notification.twitterUrl) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🐦 *Twitter Post:* <${notification.twitterUrl}|View Tweet>`
        }
      });
    }

    // Error details if available
    if (notification.error) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error:* \`${notification.error}\``
        }
      });
    }

    // Metadata if available
    if (notification.metadata) {
      const metadataText = Object.entries(notification.metadata)
        .map(([key, value]) => `• ${key}: ${value}`)
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Details:*\n${metadataText}`
        }
      });
    }

    // Footer
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `🤖 CL Digest Bot • ${new Date().toLocaleString()}`
      }]
    });

    return blocks;
  }

  /**
   * Test Slack connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured) return false;

    try {
      await this.client.auth.test();
      await this.notifyInfo('Connection Test', 'Slack integration is working correctly! 🎉');
      return true;
    } catch (error) {
      logger.error('Slack connection test failed', error);
      return false;
    }
  }

  public isReady(): boolean {
    return this.isConfigured;
  }
}