// lib/automation/health-monitor.ts

import { EventEmitter } from 'events';
import logger from '../logger';

export interface HealthMetric {
  name: string;
  value: number;
  threshold: number;
  status: 'healthy' | 'warning' | 'critical';
  lastUpdated: Date;
  trend: 'improving' | 'stable' | 'degrading';
}

export interface SystemHealth {
  overall_status: 'healthy' | 'warning' | 'critical';
  metrics: HealthMetric[];
  last_successful_run?: Date;
  uptime_hours: number;
  error_rate: number;
}

export interface AlertRule {
  metricName: string;
  condition: 'above' | 'below' | 'equals';
  threshold: number;
  severity: 'warning' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
}

export class HealthMonitor extends EventEmitter {
  private metrics: Map<string, HealthMetric> = new Map();
  private alertRules: AlertRule[] = [];
  private alertHistory: Map<string, Date> = new Map();
  private startTime: Date = new Date();
  private errorCount: number = 0;
  private totalRuns: number = 0;

  constructor() {
    super();
    this.initializeDefaultMetrics();
    this.initializeDefaultAlerts();
    this.startPeriodicHealthCheck();
  }

  /**
   * Initialize default health metrics
   */
  private initializeDefaultMetrics(): void {
    const defaultMetrics = [
      { name: 'pipeline_success_rate', value: 100, threshold: 90 },
      { name: 'avg_execution_time_minutes', value: 0, threshold: 10 },
      { name: 'twitter_api_calls_per_hour', value: 0, threshold: 100 },
      { name: 'ai_token_usage_per_day', value: 0, threshold: 50000 },
      { name: 'cache_hit_rate', value: 0, threshold: 70 },
      { name: 'error_rate_percentage', value: 0, threshold: 5 },
      { name: 'data_freshness_hours', value: 0, threshold: 6 }
    ];

    defaultMetrics.forEach(metric => {
      this.updateMetric(metric.name, metric.value, metric.threshold);
    });
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlerts(): void {
    this.alertRules = [
      {
        metricName: 'pipeline_success_rate',
        condition: 'below',
        threshold: 80,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 60
      },
      {
        metricName: 'avg_execution_time_minutes',
        condition: 'above',
        threshold: 15,
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 30
      },
      {
        metricName: 'ai_token_usage_per_day',
        condition: 'above',
        threshold: 75000,
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 240
      },
      {
        metricName: 'error_rate_percentage',
        condition: 'above',
        threshold: 10,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 30
      }
    ];
  }

  /**
   * Update a health metric
   */
  updateMetric(name: string, value: number, threshold?: number): void {
    const existing = this.metrics.get(name);
    const now = new Date();

    // Calculate trend
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (existing) {
      const diff = value - existing.value;
      const isPositiveMetric = ['success_rate', 'cache_hit_rate'].some(pos => name.includes(pos));
      
      if (Math.abs(diff) > existing.value * 0.1) { // 10% change threshold
        if (isPositiveMetric) {
          trend = diff > 0 ? 'improving' : 'degrading';
        } else {
          trend = diff < 0 ? 'improving' : 'degrading';
        }
      }
    }

    // Determine status
    const metricThreshold = threshold || existing?.threshold || 0;
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (name.includes('rate') || name.includes('percentage')) {
      // For rates/percentages, lower values might be bad
      if (name.includes('success') || name.includes('hit')) {
        if (value < metricThreshold * 0.8) status = 'critical';
        else if (value < metricThreshold) status = 'warning';
      } else {
        if (value > metricThreshold * 1.5) status = 'critical';
        else if (value > metricThreshold) status = 'warning';
      }
    } else {
      // For other metrics, higher values are usually bad
      if (value > metricThreshold * 1.5) status = 'critical';
      else if (value > metricThreshold) status = 'warning';
    }

    const metric: HealthMetric = {
      name,
      value,
      threshold: metricThreshold,
      status,
      lastUpdated: now,
      trend
    };

    this.metrics.set(name, metric);

    // Check for alerts
    this.checkAlerts(metric);

    logger.debug(`Health metric updated: ${name} = ${value} (${status})`);
  }

  /**
   * Check alert rules for a metric
   */
  private checkAlerts(metric: HealthMetric): void {
    const applicableRules = this.alertRules.filter(rule => 
      rule.metricName === metric.name && rule.enabled
    );

    for (const rule of applicableRules) {
      const shouldAlert = this.evaluateAlertCondition(metric.value, rule);
      
      if (shouldAlert && this.canSendAlert(rule)) {
        this.sendAlert(rule, metric);
      }
    }
  }

  /**
   * Evaluate if alert condition is met
   */
  private evaluateAlertCondition(value: number, rule: AlertRule): boolean {
    switch (rule.condition) {
      case 'above':
        return value > rule.threshold;
      case 'below':
        return value < rule.threshold;
      case 'equals':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  /**
   * Check if we can send alert (cooldown logic)
   */
  private canSendAlert(rule: AlertRule): boolean {
    const alertKey = `${rule.metricName}_${rule.severity}`;
    const lastAlert = this.alertHistory.get(alertKey);
    
    if (!lastAlert) return true;
    
    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    return (Date.now() - lastAlert.getTime()) > cooldownMs;
  }

  /**
   * Send alert
   */
  private sendAlert(rule: AlertRule, metric: HealthMetric): void {
    const alertKey = `${rule.metricName}_${rule.severity}`;
    this.alertHistory.set(alertKey, new Date());

    const alertData = {
      severity: rule.severity,
      metric: metric.name,
      value: metric.value,
      threshold: rule.threshold,
      condition: rule.condition,
      status: metric.status,
      trend: metric.trend
    };

    // Emit alert event
    this.emit('alert', alertData);

    logger.warn(`Health alert: ${rule.severity.toUpperCase()}`, alertData);

    // You could integrate with external services here:
    // - Send to Slack
    // - Send email
    // - Post to monitoring service (DataDog, New Relic, etc.)
  }

  /**
   * Record pipeline execution
   */
  recordPipelineExecution(success: boolean, durationMs: number, tokenUsage?: number): void {
    this.totalRuns++;
    if (!success) this.errorCount++;

    // Update success rate
    const successRate = ((this.totalRuns - this.errorCount) / this.totalRuns) * 100;
    this.updateMetric('pipeline_success_rate', successRate, 90);

    // Update average execution time
    const durationMinutes = durationMs / (1000 * 60);
    this.updateMetric('avg_execution_time_minutes', durationMinutes, 10);

    // Update error rate
    const errorRate = (this.errorCount / this.totalRuns) * 100;
    this.updateMetric('error_rate_percentage', errorRate, 5);

    // Update token usage if provided
    if (tokenUsage) {
      // This would typically be accumulated over time
      this.updateMetric('ai_token_usage_per_day', tokenUsage, 50000);
    }
  }

  /**
   * Get current system health
   */
  getSystemHealth(): SystemHealth {
    const metrics = Array.from(this.metrics.values());
    
    // Determine overall status
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    const criticalMetrics = metrics.filter(m => m.status === 'critical');
    const warningMetrics = metrics.filter(m => m.status === 'warning');
    
    if (criticalMetrics.length > 0) {
      overallStatus = 'critical';
    } else if (warningMetrics.length > 0) {
      overallStatus = 'warning';
    }

    // Calculate uptime
    const uptimeMs = Date.now() - this.startTime.getTime();
    const uptimeHours = uptimeMs / (1000 * 60 * 60);

    return {
      overall_status: overallStatus,
      metrics: metrics.sort((a, b) => a.name.localeCompare(b.name)),
      uptime_hours: Math.round(uptimeHours * 100) / 100,
      error_rate: this.totalRuns > 0 ? (this.errorCount / this.totalRuns) * 100 : 0
    };
  }

  /**
   * Start periodic health checks
   */
  private startPeriodicHealthCheck(): void {
    setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Perform comprehensive health check
   */
  private performHealthCheck(): void {
    // Check data freshness
    this.checkDataFreshness();
    
    // Check system resources if possible
    this.checkSystemResources();
    
    // Emit health check complete event
    this.emit('healthcheck', this.getSystemHealth());
  }

  /**
   * Check data freshness across sources
   */
  private async checkDataFreshness(): Promise<void> {
    try {
      // This would check when data was last updated
      // For now, we'll simulate
      const hoursOld = Math.random() * 12; // 0-12 hours
      this.updateMetric('data_freshness_hours', hoursOld, 6);
    } catch (error) {
      logger.error('Data freshness check failed', error);
    }
  }

  /**
   * Check system resources
   */
  private checkSystemResources(): void {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      const memUsedMB = memUsage.heapUsed / 1024 / 1024;
      this.updateMetric('memory_usage_mb', Math.round(memUsedMB), 500);

      // CPU usage would require additional libraries
      // For now, we'll use a placeholder
      this.updateMetric('cpu_usage_percentage', Math.random() * 30, 80);
      
    } catch (error) {
      logger.error('System resource check failed', error);
    }
  }

  /**
   * Get metrics history (for trending)
   */
  getMetricsHistory(metricName: string, hours: number = 24): any[] {
    // In a real implementation, you'd store historical data
    // For now, return mock data
    const history = [];
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    
    for (let i = hours; i >= 0; i--) {
      history.push({
        timestamp: new Date(now - (i * hourMs)),
        value: Math.random() * 100 // Mock data
      });
    }
    
    return history;
  }
}

// Global health monitor instance
export const healthMonitor = new HealthMonitor();