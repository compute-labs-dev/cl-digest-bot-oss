// lib/automation/scheduler.ts

import { CronJob } from 'cron';
import logger from '../logger';
import { ProgressTracker } from '../../utils/progress';

export interface ScheduleConfig {
  name: string;
  cronPattern: string;
  enabled: boolean;
  timezone?: string;
  maxConcurrentRuns?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface ScheduledTask {
  execute(): Promise<void>;
  getName(): string;
  getEstimatedDuration(): number; // milliseconds
}

export interface TaskExecution {
  taskName: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'retrying';
  error?: string;
  retryCount: number;
  executionId: string;
}

export class TaskScheduler {
  private jobs: Map<string, CronJob> = new Map();
  private runningTasks: Map<string, TaskExecution> = new Map();
  private taskHistory: TaskExecution[] = [];
  private maxHistoryItems = 100;

  /**
   * Schedule a task with cron pattern
   */
  scheduleTask(config: ScheduleConfig, task: ScheduledTask): void {
    if (this.jobs.has(config.name)) {
      logger.warn(`Task ${config.name} is already scheduled, updating...`);
      this.unscheduleTask(config.name);
    }

    if (!config.enabled) {
      logger.info(`Task ${config.name} is disabled, skipping schedule`);
      return;
    }

    const job = new CronJob(
      config.cronPattern,
      () => this.executeTask(config, task),
      null,
      true, // Start immediately
      config.timezone || 'UTC'
    );

    this.jobs.set(config.name, job);
    logger.info(`Scheduled task: ${config.name} with pattern: ${config.cronPattern}`);
  }

  /**
   * Execute a task with error handling and retries
   */
  private async executeTask(config: ScheduleConfig, task: ScheduledTask): Promise<void> {
    const executionId = this.generateExecutionId();
    const taskName = config.name;

    // Check for concurrent runs
    if (config.maxConcurrentRuns && config.maxConcurrentRuns <= 1) {
      if (this.runningTasks.has(taskName)) {
        logger.warn(`Task ${taskName} is already running, skipping execution`);
        return;
      }
    }

    const execution: TaskExecution = {
      taskName,
      startTime: new Date(),
      status: 'running',
      retryCount: 0,
      executionId
    };

    this.runningTasks.set(taskName, execution);
    logger.info(`Starting task execution: ${taskName} (${executionId})`);

    try {
      const progress = new ProgressTracker({
        total: 1,
        label: `Executing ${taskName}`
      });

      await task.execute();

      execution.status = 'completed';
      execution.endTime = new Date();
      
      const duration = execution.endTime.getTime() - execution.startTime.getTime();
      progress.complete(`Task completed in ${(duration / 1000).toFixed(2)}s`);
      
      logger.info(`Task completed successfully: ${taskName} (${executionId})`, {
        duration_ms: duration
      });

    } catch (error: any) {
      execution.error = error.message;
      logger.error(`Task failed: ${taskName} (${executionId})`, error);

      // Retry logic
      const maxRetries = config.retryAttempts || 0;
      if (execution.retryCount < maxRetries) {
        execution.status = 'retrying';
        execution.retryCount++;
        
        const retryDelay = config.retryDelayMs || 60000; // 1 minute default
        logger.info(`Retrying task ${taskName} in ${retryDelay}ms (attempt ${execution.retryCount}/${maxRetries})`);
        
        setTimeout(() => {
          this.executeTask(config, task);
        }, retryDelay);
        
        return;
      } else {
        execution.status = 'failed';
        execution.endTime = new Date();
      }
    } finally {
      // Clean up running tasks (unless retrying)
      if (execution.status !== 'retrying') {
        this.runningTasks.delete(taskName);
        
        // Add to history
        this.taskHistory.unshift(execution);
        if (this.taskHistory.length > this.maxHistoryItems) {
          this.taskHistory = this.taskHistory.slice(0, this.maxHistoryItems);
        }
      }
    }
  }

  /**
   * Unschedule a task
   */
  unscheduleTask(taskName: string): void {
    const job = this.jobs.get(taskName);
    if (job) {
      job.stop();
      this.jobs.delete(taskName);
      logger.info(`Unscheduled task: ${taskName}`);
    }
  }

  /**
   * Get running tasks
   */
  getRunningTasks(): TaskExecution[] {
    return Array.from(this.runningTasks.values());
  }

  /**
   * Get task history
   */
  getTaskHistory(limit?: number): TaskExecution[] {
    return limit ? this.taskHistory.slice(0, limit) : this.taskHistory;
  }

  /**
   * Get task statistics
   */
  getTaskStats(taskName?: string): any {
    const history = taskName 
      ? this.taskHistory.filter(exec => exec.taskName === taskName)
      : this.taskHistory;

    if (history.length === 0) {
      return { total_executions: 0 };
    }

    const completed = history.filter(exec => exec.status === 'completed');
    const failed = history.filter(exec => exec.status === 'failed');
    
    const completedDurations = completed
      .filter(exec => exec.endTime)
      .map(exec => exec.endTime!.getTime() - exec.startTime.getTime());

    return {
      total_executions: history.length,
      completed: completed.length,
      failed: failed.length,
      success_rate: completed.length / history.length,
      average_duration_ms: completedDurations.length > 0 
        ? completedDurations.reduce((sum, dur) => sum + dur, 0) / completedDurations.length
        : 0,
      last_execution: history[0]
    };
  }

  /**
   * Stop all scheduled tasks
   */
  stopAll(): void {
    for (const [taskName, job] of Array.from(this.jobs.entries())) {
      job.stop();
      logger.info(`Stopped task: ${taskName}`);
    }
    this.jobs.clear();
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global scheduler instance
export const taskScheduler = new TaskScheduler();