// utils/progress.ts
import cliProgress from 'cli-progress';
import logger from '../lib/logger';

export interface ProgressConfig {
  total: number;
  label: string;
  showPercentage?: boolean;
  showETA?: boolean;
}

export class ProgressTracker {
  private bar: cliProgress.SingleBar | null = null;
  private startTime: number = 0;
  private label: string = '';

  constructor(config: ProgressConfig) {
    this.label = config.label;
    this.startTime = Date.now();

    // Create progress bar with custom format
    this.bar = new cliProgress.SingleBar({
      format: `${config.label} [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}`,
      hideCursor: true,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      clearOnComplete: false,
      stopOnComplete: true,
    }, cliProgress.Presets.shades_classic);

    this.bar.start(config.total, 0);
    logger.info(`Started: ${config.label}`, { total: config.total });
  }

  update(current: number, data?: any): void {
    if (this.bar) {
      this.bar.update(current, data);
    }
  }

  increment(data?: any): void {
    if (this.bar) {
      this.bar.increment(data);
    }
  }

  complete(message?: string): void {
    if (this.bar) {
      this.bar.stop();
    }

    const duration = Date.now() - this.startTime;
    const completionMessage = message || `Completed: ${this.label}`;
    
    logger.info(completionMessage, { 
      duration_ms: duration,
      duration_formatted: `${(duration / 1000).toFixed(2)}s`
    });

    console.log(`✅ ${completionMessage} (${(duration / 1000).toFixed(2)}s)`);
  }

  fail(error: string): void {
    if (this.bar) {
      this.bar.stop();
    }

    const duration = Date.now() - this.startTime;
    logger.error(`Failed: ${this.label}`, { error, duration_ms: duration });
    console.log(`❌ Failed: ${this.label} - ${error}`);
  }
}

// Progress manager for multiple concurrent operations
export class ProgressManager {
  private trackers: Map<string, ProgressTracker> = new Map();

  create(id: string, config: ProgressConfig): ProgressTracker {
    const tracker = new ProgressTracker(config);
    this.trackers.set(id, tracker);
    return tracker;
  }

  get(id: string): ProgressTracker | undefined {
    return this.trackers.get(id);
  }

  complete(id: string, message?: string): void {
    const tracker = this.trackers.get(id);
    if (tracker) {
      tracker.complete(message);
      this.trackers.delete(id);
    }
  }

  fail(id: string, error: string): void {
    const tracker = this.trackers.get(id);
    if (tracker) {
      tracker.fail(error);
      this.trackers.delete(id);
    }
  }

  cleanup(): void {
    this.trackers.clear();
  }
}

// Global progress manager instance
export const progressManager = new ProgressManager();