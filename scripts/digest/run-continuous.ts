// scripts/digest/run-continuous.ts

import { DigestPipeline } from '../../lib/automation/digest-pipeline';
import { SlackNotifier } from '../../lib/slack/slack-notifier';
import logger from '../../lib/logger';

class ContinuousRunner {
  private pipeline: DigestPipeline;
  private slackNotifier: SlackNotifier;
  private intervalMinutes: number;
  private isRunning: boolean = false;

  constructor(intervalMinutes: number = 60) { // Default: run every hour
    this.intervalMinutes = intervalMinutes;
    this.pipeline = new DigestPipeline({
      enableTwitter: true,
      enableTelegram: true,
      enableRSS: true,
      aiModel: 'anthropic',
      analysisType: 'digest',
      postToSlack: false, // We handle notifications separately
      minQualityThreshold: 0.5,
      maxContentAge: 24
    });
    this.slackNotifier = new SlackNotifier();
  }

  /**
   * Start the continuous runner
   */
  async start(): Promise<void> {
    logger.info('Starting continuous digest runner', { 
      intervalMinutes: this.intervalMinutes 
    });

    // Send startup notification (don't block on this)
    this.sendSlackNotificationSafely(
      () => this.slackNotifier.notifyInfo(
        'Digest Bot Started 🤖',
        `Continuous runner started. Will generate digests every ${this.intervalMinutes} minutes.`
      )
    );

    this.isRunning = true;

    // Run immediately on startup
    await this.runPipeline();

    // Then run on interval
    const intervalMs = this.intervalMinutes * 60 * 1000;
    setInterval(async () => {
      if (this.isRunning) {
        await this.runPipeline();
      }
    }, intervalMs);

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Run the digest pipeline
   */
  private async runPipeline(): Promise<void> {
    try {
      logger.info('Running scheduled digest pipeline');
      await this.pipeline.execute();
    } catch (error) {
      logger.error('Scheduled pipeline execution failed', error);
      // Error notification is handled by the pipeline itself
    }
  }

  /**
   * Send Slack notification safely without blocking execution
   */
  private sendSlackNotificationSafely(notificationFn: () => Promise<void>): void {
    // Set a reasonable timeout for Slack notifications
    const timeoutMs = 10000; // 10 seconds
    
    Promise.race([
      notificationFn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Slack notification timeout')), timeoutMs)
      )
    ]).catch(error => {
      // Log error but don't throw - we don't want Slack issues to break the pipeline
      logger.warn('Slack notification failed (continuing anyway)', error);
    });
  }

  /**
   * Shutdown gracefully
   */
  private async shutdown(): Promise<void> {
    logger.info('Shutting down continuous runner');
    this.isRunning = false;

    // Send shutdown notification (don't block on this)
    this.sendSlackNotificationSafely(
      () => this.slackNotifier.notifyInfo(
        'Digest Bot Stopped 🛑',
        'Continuous runner has been stopped.'
      )
    );

    process.exit(0);
  }
}

// Start the runner
async function main() {
  const intervalMinutes = parseInt(process.env.RUN_INTERVAL_MINUTES || '60');
  const runner = new ContinuousRunner(intervalMinutes);
  await runner.start();
}

main().catch(error => {
  console.error('Failed to start continuous runner:', error);
  process.exit(1);
});