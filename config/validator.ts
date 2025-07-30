// config/validator.ts

import { XAccountConfig, TelegramChannelConfig, RssFeedConfig } from './types';
import { xConfig, telegramConfig, rssConfig } from './data-sources-config';

interface ValidationError {
  source: string;
  field: string;
  value: any;
  message: string;
}

export class ConfigValidator {
  private errors: ValidationError[] = [];

  validateXConfig(): ValidationError[] {
    this.errors = [];
    
    // Validate defaults
    this.validateXAccountConfig('defaults', xConfig.defaults);
    
    // Validate all overrides
    Object.entries(xConfig.accountOverrides).forEach(([account, config]) => {
      const fullConfig = { ...xConfig.defaults, ...config };
      this.validateXAccountConfig(`account:${account}`, fullConfig);
    });
    
    return this.errors;
  }

  private validateXAccountConfig(source: string, config: XAccountConfig): void {
    // Twitter API limits
    if (config.tweetsPerRequest < 5 || config.tweetsPerRequest > 100) {
      this.addError(source, 'tweetsPerRequest', config.tweetsPerRequest, 
        'Must be between 5 and 100 (Twitter API limit)');
    }
    
    // Reasonable pagination limits
    if (config.maxPages < 1 || config.maxPages > 10) {
      this.addError(source, 'maxPages', config.maxPages, 
        'Must be between 1 and 10 (avoid excessive API calls)');
    }
    
    // Cache duration sanity check
    if (config.cacheHours < 1 || config.cacheHours > 24) {
      this.addError(source, 'cacheHours', config.cacheHours, 
        'Must be between 1 and 24 hours');
    }
    
    // Text length validation
    if (config.minTweetLength < 1 || config.minTweetLength > 280) {
      this.addError(source, 'minTweetLength', config.minTweetLength, 
        'Must be between 1 and 280 characters');
    }
  }

  validateTelegramConfig(): ValidationError[] {
    this.errors = [];
    
    // Validate defaults
    this.validateTelegramChannelConfig('defaults', telegramConfig.defaults);
    
    // Validate overrides
    Object.entries(telegramConfig.channelOverrides).forEach(([channel, config]) => {
      const fullConfig = { ...telegramConfig.defaults, ...config };
      this.validateTelegramChannelConfig(`channel:${channel}`, fullConfig);
    });
    
    return this.errors;
  }

  private validateTelegramChannelConfig(source: string, config: TelegramChannelConfig): void {
    if (config.messagesPerChannel < 1 || config.messagesPerChannel > 500) {
      this.addError(source, 'messagesPerChannel', config.messagesPerChannel, 
        'Must be between 1 and 500');
    }
    
    if (config.cacheHours < 1 || config.cacheHours > 24) {
      this.addError(source, 'cacheHours', config.cacheHours, 
        'Must be between 1 and 24 hours');
    }
  }

  validateRssConfig(): ValidationError[] {
    this.errors = [];
    
    this.validateRssFeedConfig('defaults', rssConfig.defaults);
    
    Object.entries(rssConfig.feedOverrides).forEach(([feed, config]) => {
      const fullConfig = { ...rssConfig.defaults, ...config };
      this.validateRssFeedConfig(`feed:${feed}`, fullConfig);
    });
    
    return this.errors;
  }

  private validateRssFeedConfig(source: string, config: RssFeedConfig): void {
    if (config.articlesPerFeed < 1 || config.articlesPerFeed > 100) {
      this.addError(source, 'articlesPerFeed', config.articlesPerFeed, 
        'Must be between 1 and 100');
    }
    
    if (config.maxArticleLength <= config.minArticleLength) {
      this.addError(source, 'maxArticleLength', config.maxArticleLength, 
        'Must be greater than minArticleLength');
    }
  }

  private addError(source: string, field: string, value: any, message: string): void {
    this.errors.push({ source, field, value, message });
  }

  // Validate all configurations
  validateAll(): ValidationError[] {
    const allErrors = [
      ...this.validateXConfig(),
      ...this.validateTelegramConfig(),
      ...this.validateRssConfig()
    ];
    
    return allErrors;
  }
}

// Export a singleton validator
export const configValidator = new ConfigValidator();