// lib/automation/config-manager.ts

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import logger from '../logger';

export interface AutomationConfig {
  environment: 'development' | 'staging' | 'production';
  
  // Scheduling configuration
  scheduling: {
    digest_pipeline: {
      enabled: boolean;
      cron_pattern: string;
      timezone: string;
      max_concurrent_runs: number;
      retry_attempts: number;
      retry_delay_ms: number;
    };
    cache_cleanup: {
      enabled: boolean;
      cron_pattern: string;
      retention_days: number;
    };
    health_check: {
      enabled: boolean;
      interval_minutes: number;
    };
  };

  // Data source configuration
  data_sources: {
    twitter: {
      enabled: boolean;
      accounts: string[];
      api_rate_limit_buffer: number;
    };
    telegram: {
      enabled: boolean;
      channels: string[];
      scraping_delay_ms: number;
    };
    rss: {
      enabled: boolean;
      feeds: string[];
      timeout_ms: number;
    };
  };

  // AI configuration
  ai: {
    default_provider: 'openai' | 'anthropic';
    model_configs: {
      routine: {
        provider: 'openai' | 'anthropic';
        model: string;
        max_tokens: number;
        temperature: number;
      };
      important: {
        provider: 'openai' | 'anthropic';
        model: string;
        max_tokens: number;
        temperature: number;
      };
      critical: {
        provider: 'openai' | 'anthropic';
        model: string;
        max_tokens: number;
        temperature: number;
      };
    };
    cost_limits: {
      daily_budget: number;
      per_analysis_limit: number;
    };
  };

  // Quality and filtering
  quality: {
    min_quality_threshold: number;
    max_content_age_hours: number;
    min_engagement_threshold: number;
  };

  // Distribution configuration
  distribution: {
    slack: {
      enabled: boolean;
      channel_id: string;
      webhook_url?: string;
    };
    webhook_notifications: {
      enabled: boolean;
      endpoints: string[];
    };
  };

  // Monitoring and alerts
  monitoring: {
    health_checks: boolean;
    alert_webhooks: string[];
    log_level: 'debug' | 'info' | 'warn' | 'error';
    metrics_retention_days: number;
  };
}

export class ConfigManager {
  private config!: AutomationConfig;
  private configPath: string;
  private watchers: ((config: AutomationConfig) => void)[] = [];

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), 'config', 'automation.json');
    this.loadConfig();
  }

  /**
   * Load configuration from file
   */
  private loadConfig(): void {
    try {
      const configData = readFileSync(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
      this.validateConfig();
      logger.info(`Configuration loaded from ${this.configPath}`);
    } catch (error) {
      logger.warn(`Failed to load config from ${this.configPath}, using defaults`);
      this.config = this.getDefaultConfig();
      this.saveConfig(); // Create default config file
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AutomationConfig {
    const isDev = process.env.NODE_ENV === 'development';
    
    return {
      environment: isDev ? 'development' : 'production',
      
      scheduling: {
        digest_pipeline: {
          enabled: true,
          cron_pattern: isDev ? '*/15 * * * *' : '0 9 * * *', // Every 15 min in dev, 9 AM in prod
          timezone: 'UTC',
          max_concurrent_runs: 1,
          retry_attempts: 3,
          retry_delay_ms: 60000
        },
        cache_cleanup: {
          enabled: true,
          cron_pattern: '0 2 * * *', // 2 AM daily
          retention_days: 7
        },
        health_check: {
          enabled: true,
          interval_minutes: 5
        }
      },

      data_sources: {
        twitter: {
          enabled: !!process.env.X_API_KEY,
          accounts: ['openai', 'anthropicai'],
          api_rate_limit_buffer: 5000
        },
        telegram: {
          enabled: true,
          channels: ['telegram', 'durov'],
          scraping_delay_ms: isDev ? 2000 : 5000
        },
        rss: {
          enabled: true,
          feeds: [
            'https://techcrunch.com/feed/',
            'https://www.theverge.com/rss/index.xml'
          ],
          timeout_ms: 15000
        }
      },

      ai: {
        default_provider: 'anthropic',
        model_configs: {
          routine: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            max_tokens: 1500,
            temperature: 0.7
          },
          important: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2000,
            temperature: 0.7
          },
          critical: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 3000,
            temperature: 0.3
          }
        },
        cost_limits: {
          daily_budget: isDev ? 1.0 : 10.0,
          per_analysis_limit: isDev ? 0.25 : 2.0
        }
      },

      quality: {
        min_quality_threshold: 0.6,
        max_content_age_hours: 24,
        min_engagement_threshold: 5
      },

      distribution: {
        slack: {
          enabled: !!process.env.SLACK_BOT_TOKEN,
          channel_id: process.env.SLACK_CHANNEL_ID || ''
        },
        webhook_notifications: {
          enabled: false,
          endpoints: []
        }
      },

      monitoring: {
        health_checks: true,
        alert_webhooks: [],
        log_level: isDev ? 'debug' : 'info',
        metrics_retention_days: 30
      }
    };
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    const requiredPaths = [
      'environment',
      'scheduling.digest_pipeline.cron_pattern',
      'ai.default_provider',
      'quality.min_quality_threshold'
    ];

    for (const path of requiredPaths) {
      if (!this.getNestedValue(this.config, path)) {
        throw new Error(`Missing required configuration: ${path}`);
      }
    }

    // Validate cron patterns
    const cronPatterns = [
      this.config.scheduling.digest_pipeline.cron_pattern,
      this.config.scheduling.cache_cleanup.cron_pattern
    ];

    for (const pattern of cronPatterns) {
      if (!this.isValidCronPattern(pattern)) {
        logger.warn(`Invalid cron pattern: ${pattern}`);
      }
    }

    logger.debug('Configuration validation passed');
  }

  /**
   * Get nested configuration value
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Basic cron pattern validation
   */
  private isValidCronPattern(pattern: string): boolean {
    const parts = pattern.split(' ');
    return parts.length === 5 || parts.length === 6; // 5 for standard, 6 with seconds
  }

  /**
   * Get current configuration
   */
  getConfig(): AutomationConfig {
    return { ...this.config }; // Return copy to prevent mutations
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AutomationConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfig();
    this.saveConfig();
    this.notifyWatchers();
  }

  /**
   * Save configuration to file
   */
  private saveConfig(): void {
    try {
      const configData = JSON.stringify(this.config, null, 2);
      writeFileSync(this.configPath, configData, 'utf-8');
      logger.info(`Configuration saved to ${this.configPath}`);
    } catch (error) {
      logger.error('Failed to save configuration', error);
    }
  }

  /**
   * Watch for configuration changes
   */
  watch(callback: (config: AutomationConfig) => void): void {
    this.watchers.push(callback);
  }

  /**
   * Notify watchers of configuration changes
   */
  private notifyWatchers(): void {
    for (const watcher of this.watchers) {
      try {
        watcher(this.getConfig());
      } catch (error) {
        logger.error('Configuration watcher error', error);
      }
    }
  }

  /**
   * Get environment-specific settings
   */
  getEnvironmentConfig(): any {
    const env = this.config.environment;
    
    return {
      isDevelopment: env === 'development',
      isProduction: env === 'production',
      logLevel: this.config.monitoring.log_level,
      enableDebugFeatures: env === 'development',
      enablePerformanceMetrics: env === 'production',
      strictErrorHandling: env === 'production'
    };
  }

  /**
   * Validate required environment variables
   */
  validateEnvironment(): { valid: boolean; missing: string[] } {
    const required: { [key: string]: string[] } = {
      all: ['NODE_ENV'],
      twitter: ['X_API_KEY', 'X_API_SECRET'],
      ai: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
      slack: ['SLACK_BOT_TOKEN', 'SLACK_CHANNEL_ID']
    };

    const missing: string[] = [];

    // Check all environments
    for (const envVar of required.all) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }

    // Check conditionally required
    if (this.config.data_sources.twitter.enabled) {
      for (const envVar of required.twitter) {
        if (!process.env[envVar]) {
          missing.push(envVar);
        }
      }
    }

    if (this.config.distribution.slack.enabled) {
      for (const envVar of required.slack) {
        if (!process.env[envVar]) {
          missing.push(envVar);
        }
      }
    }

    // Check AI keys (at least one required)
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    
    if (!hasOpenAI && !hasAnthropic) {
      missing.push('OPENAI_API_KEY or ANTHROPIC_API_KEY');
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }
}

// Global configuration manager
export const configManager = new ConfigManager();