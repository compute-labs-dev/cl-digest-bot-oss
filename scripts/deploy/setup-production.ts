// scripts/deploy/setup-production.ts

import { config } from 'dotenv';
import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface DeploymentConfig {
  environment: 'staging' | 'production';
  nodeEnv: string;
  port: number;
  logLevel: string;
  enableHealthCheck: boolean;
  enableMetrics: boolean;
  cronJobs: {
    digestPipeline: string;
    cacheCleanup: string;
    healthCheck: string;
  };
}

class ProductionSetup {
  private deployConfig: DeploymentConfig;

  constructor(environment: 'staging' | 'production' = 'production') {
    this.deployConfig = {
      environment,
      nodeEnv: environment,
      port: environment === 'production' ? 3000 : 3001,
      logLevel: environment === 'production' ? 'info' : 'debug',
      enableHealthCheck: true,
      enableMetrics: true,
      cronJobs: {
        digestPipeline: environment === 'production' ? '0 9 * * *' : '0 */2 * * *', // 9 AM daily vs every 2 hours
        cacheCleanup: '0 2 * * *', // 2 AM daily
        healthCheck: '*/5 * * * *' // Every 5 minutes
      }
    };
  }

  async setupProduction(): Promise<void> {
    console.log(`🚀 Setting up ${this.deployConfig.environment} environment...\n`);

    try {
      // Step 1: Environment validation
      console.log('1. Validating environment...');
      this.validateEnvironment();
      console.log('   ✅ Environment validation passed');

      // Step 2: Create necessary directories
      console.log('\n2. Creating directory structure...');
      this.createDirectories();
      console.log('   ✅ Directories created');

      // Step 3: Generate production configuration
      console.log('\n3. Generating production configuration...');
      this.generateProductionConfig();
      console.log('   ✅ Configuration generated');

      // Step 4: Setup logging
      console.log('\n4. Setting up logging...');
      this.setupLogging();
      console.log('   ✅ Logging configured');

      // Step 5: Create systemd service (Linux only)
      if (process.platform === 'linux') {
        console.log('\n5. Creating systemd service...');
        this.createSystemdService();
        console.log('   ✅ Systemd service created');
      }

      // Step 6: Setup monitoring
      console.log('\n6. Setting up monitoring...');
      this.setupMonitoring();
      console.log('   ✅ Monitoring configured');

      // Step 7: Create startup script
      console.log('\n7. Creating startup script...');
      this.createStartupScript();
      console.log('   ✅ Startup script created');

      // Step 8: Setup cron jobs
      console.log('\n8. Setting up cron jobs...');
      this.setupCronJobs();
      console.log('   ✅ Cron jobs configured');

      console.log('\n🎉 Production setup completed successfully!');
      this.printNextSteps();

    } catch (error: any) {
      console.error('\n❌ Production setup failed:', error.message);
      throw error;
    }
  }

  private validateEnvironment(): void {
    const requiredEnvVars = [
      'NODE_ENV',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Check optional but recommended
    const recommended = ['SLACK_BOT_TOKEN', 'SLACK_CHANNEL_ID'];
    const missingRecommended = recommended.filter(envVar => !process.env[envVar]);
    
    if (missingRecommended.length > 0) {
      console.log(`   ⚠️  Recommended environment variables missing: ${missingRecommended.join(', ')}`);
    }
  }

  private createDirectories(): void {
    const dirs = [
      'logs',
      'config',
      'data',
      'scripts/deploy',
      'monitoring'
    ];

    dirs.forEach(dir => {
      const fullPath = join(process.cwd(), dir);
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
      }
    });
  }

  private generateProductionConfig(): void {
    const productionConfig = {
      environment: this.deployConfig.environment,
      scheduling: {
        digest_pipeline: {
          enabled: true,
          cron_pattern: this.deployConfig.cronJobs.digestPipeline,
          timezone: 'UTC',
          max_concurrent_runs: 1,
          retry_attempts: 3,
          retry_delay_ms: 300000 // 5 minutes
        },
        cache_cleanup: {
          enabled: true,
          cron_pattern: this.deployConfig.cronJobs.cacheCleanup,
          retention_days: 7
        },
        health_check: {
          enabled: this.deployConfig.enableHealthCheck,
          interval_minutes: 5
        }
      },
      data_sources: {
        twitter: {
          enabled: !!process.env.X_API_KEY,
          accounts: ['openai', 'anthropicai', 'elonmusk'],
          api_rate_limit_buffer: 10000
        },
        telegram: {
          enabled: true,
          channels: ['telegram', 'durov'],
          scraping_delay_ms: 5000
        },
        rss: {
          enabled: true,
          feeds: [
            'https://techcrunch.com/feed/',
            'https://www.theverge.com/rss/index.xml',
            'https://feeds.feedburner.com/venturebeat/SZYF'
          ],
          timeout_ms: 30000
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
            max_tokens: 2500,
            temperature: 0.7
          },
          critical: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            temperature: 0.3
          }
        },
        cost_limits: {
          daily_budget: this.deployConfig.environment === 'production' ? 25.0 : 5.0,
          per_analysis_limit: this.deployConfig.environment === 'production' ? 5.0 : 1.0
        }
      },
      quality: {
        min_quality_threshold: 0.7,
        max_content_age_hours: 24,
        min_engagement_threshold: 10
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
        health_checks: this.deployConfig.enableHealthCheck,
        alert_webhooks: [],
        log_level: this.deployConfig.logLevel,
        metrics_retention_days: 30
      }
    };

    const configPath = join(process.cwd(), 'config', 'automation.json');
    writeFileSync(configPath, JSON.stringify(productionConfig, null, 2));
  }

  private setupLogging(): void {
    const logConfig = {
      level: this.deployConfig.logLevel,
      format: 'json',
      transports: [
        {
          type: 'file',
          filename: 'logs/application.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        },
        {
          type: 'file',
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 10485760,
          maxFiles: 5
        }
      ]
    };

    if (this.deployConfig.environment !== 'production') {
      logConfig.transports.push({
        type: 'console',
        format: 'simple'
      } as any);
    }

    const configPath = join(process.cwd(), 'config', 'logging.json');
    writeFileSync(configPath, JSON.stringify(logConfig, null, 2));
  }

  private createSystemdService(): void {
    const serviceName = `cl-digest-bot-${this.deployConfig.environment}`;
    const serviceFile = `[Unit]
Description=CL Digest Bot ${this.deployConfig.environment}
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=${process.cwd()}
Environment=NODE_ENV=${this.deployConfig.nodeEnv}
Environment=PORT=${this.deployConfig.port}
ExecStart=/usr/bin/node scripts/deploy/start-production.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${serviceName}

[Install]
WantedBy=multi-user.target`;

    const servicePath = join(process.cwd(), 'scripts', 'deploy', `${serviceName}.service`);
    writeFileSync(servicePath, serviceFile);

    console.log(`   📄 Systemd service file created: ${serviceName}.service`);
    console.log(`   💡 Copy to /etc/systemd/system/ and run:`);
    console.log(`      sudo systemctl daemon-reload`);
    console.log(`      sudo systemctl enable ${serviceName}`);
    console.log(`      sudo systemctl start ${serviceName}`);
  }

  private setupMonitoring(): void {
    // Create a simple health check endpoint
    const healthCheckScript = `#!/usr/bin/env node
const http = require('http');

const options = {
  hostname: 'localhost',
  port: ${this.deployConfig.port},
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('Health check passed');
    process.exit(0);
  } else {
    console.log(\`Health check failed: \${res.statusCode}\`);
    process.exit(1);
  }
});

req.on('error', (err) => {
  console.log(\`Health check error: \${err.message}\`);
  process.exit(1);
});

req.on('timeout', () => {
  console.log('Health check timeout');
  req.destroy();
  process.exit(1);
});

req.end();`;

    const healthCheckPath = join(process.cwd(), 'scripts', 'deploy', 'health-check.js');
    writeFileSync(healthCheckPath, healthCheckScript);
    
    // Make it executable
    try {
      execSync(`chmod +x ${healthCheckPath}`);
    } catch (error) {
      // Ignore on Windows
    }
  }

  private createStartupScript(): void {
    const startupScript = `#!/usr/bin/env node

// Production startup script
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting CL Digest Bot in production mode...');

// Set production environment
process.env.NODE_ENV = '${this.deployConfig.nodeEnv}';
process.env.PORT = '${this.deployConfig.port}';

// Start the application
const appProcess = spawn('node', ['scripts/automation/start-automation.js'], {
  stdio: 'inherit',
  cwd: process.cwd()
});

appProcess.on('error', (error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

appProcess.on('exit', (code) => {
  console.log(\`Application exited with code \${code}\`);
  process.exit(code);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  appProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  appProcess.kill('SIGINT');
});`;

    const startupPath = join(process.cwd(), 'scripts', 'deploy', 'start-production.js');
    writeFileSync(startupPath, startupScript);
    
    try {
      execSync(`chmod +x ${startupPath}`);
    } catch (error) {
      // Ignore on Windows
    }
  }

  private setupCronJobs(): void {
    const cronEntries = [
      `# CL Digest Bot - ${this.deployConfig.environment}`,
      `${this.deployConfig.cronJobs.digestPipeline} cd ${process.cwd()} && node scripts/automation/run-digest.js >> logs/cron.log 2>&1`,
      `${this.deployConfig.cronJobs.cacheCleanup} cd ${process.cwd()} && node scripts/automation/cleanup-cache.js >> logs/cron.log 2>&1`,
      `${this.deployConfig.cronJobs.healthCheck} cd ${process.cwd()} && node scripts/deploy/health-check.js >> logs/health.log 2>&1`,
      '' // Empty line at end
    ];

    const crontabPath = join(process.cwd(), 'scripts', 'deploy', 'crontab');
    writeFileSync(crontabPath, cronEntries.join('\n'));

    console.log('   📄 Crontab file created');
    console.log('   💡 Install with: crontab scripts/deploy/crontab');
  }

  private printNextSteps(): void {
    console.log('\n📋 Next Steps:');
    console.log('==============');
    console.log('1. Review configuration files in config/');
    console.log('2. Test the setup: npm run test:automation-complete');
    console.log('3. Start the application: node scripts/deploy/start-production.js');
    
    if (process.platform === 'linux') {
      console.log('4. Install systemd service (optional):');
      console.log('   sudo cp scripts/deploy/*.service /etc/systemd/system/');
      console.log('   sudo systemctl daemon-reload');
      console.log('   sudo systemctl enable cl-digest-bot-production');
      console.log('   sudo systemctl start cl-digest-bot-production');
    }
    
    console.log('5. Install cron jobs: crontab scripts/deploy/crontab');
    console.log('6. Monitor logs: tail -f logs/application.log');
    console.log('7. Check health: node scripts/deploy/health-check.js');
    
    console.log('\n🔧 Useful Commands:');
    console.log('==================');
    console.log('• Check status: npm run test:automation-complete');
    console.log('• View logs: tail -f logs/application.log');
    console.log('• Health check: node scripts/deploy/health-check.js');
    console.log('• Stop safely: pkill -SIGTERM -f "start-production"');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const environment = args[0] === 'staging' ? 'staging' : 'production';
  
  const setup = new ProductionSetup(environment);
  await setup.setupProduction();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}