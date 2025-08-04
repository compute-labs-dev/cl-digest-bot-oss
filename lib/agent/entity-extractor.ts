// lib/agent/entity-extractor.ts

import { ExtractedEntities } from '../../types/agent';
import logger from '../logger';

export class EntityExtractor {
  /**
   * Extract entities from user message using regex patterns and AI
   */
  static extractEntities(message: string, aiExtractedEntities: any): ExtractedEntities {
    const entities: ExtractedEntities = {};
    
    // Twitter username patterns
    const twitterPatterns = [
      /@(\w+)/g, // @username
      /twitter\.com\/(\w+)/g, // twitter.com/username
      /add.*?(\w+).*?twitter/gi // "add sama to twitter"
    ];
    
    entities.twitterUsernames = this.extractWithPatterns(message, twitterPatterns)
      .map(username => username.toLowerCase());

    // RSS URL patterns  
    const rssPatterns = [
      /https?:\/\/[^\s]+(?:rss|feed|xml)/gi,
      /[^\s]+\.(?:rss|xml)/gi
    ];
    
    entities.rssUrls = this.extractWithPatterns(message, rssPatterns)
      .filter(url => this.isValidRssUrl(url));

    // Check for RSS brand names and map to actual URLs
    const rssBrandUrls = this.extractRSSBrandUrls(message);
    if (rssBrandUrls.length > 0) {
      entities.rssUrls = [...(entities.rssUrls || []), ...rssBrandUrls];
    }

    // Also map AI-extracted RSS brands to URLs
    if (aiExtractedEntities.rss_brands) {
      const brandUrls: string[] = [];
      const brands = Array.isArray(aiExtractedEntities.rss_brands) 
        ? aiExtractedEntities.rss_brands 
        : [aiExtractedEntities.rss_brands];
      
      for (const brand of brands) {
        const urls = this.extractRSSBrandUrls(brand);
        brandUrls.push(...urls);
      }
      
      if (brandUrls.length > 0) {
        entities.rssUrls = [...(entities.rssUrls || []), ...brandUrls];
      }
    }

    // AI model mentions
    const modelPatterns = [
      /\b(openai|gpt|claude|anthropic|gemini|google|ollama|llama)\b/gi
    ];
    
    const modelMentions = this.extractWithPatterns(message, modelPatterns);
    if (modelMentions.length > 0) {
      entities.aiModel = this.normalizeModelName(modelMentions[0]);
    }

    // Time range extraction
    const timePatterns = [
      /(?:last|past)\s+(\d+)\s+(hour|day|week)s?/gi,
      /(\d+)h/gi,
      /(\d+)\s*hours?/gi
    ];
    
    const timeMatches = this.extractWithPatterns(message, timePatterns);
    if (timeMatches.length > 0) {
      entities.timeRange = this.parseTimeExpression(timeMatches[0]);
    }


    
    // Deduplicate RSS URLs
    if (entities.rssUrls && entities.rssUrls.length > 0) {
      entities.rssUrls = [...new Set(entities.rssUrls)];
    }

    // Extract digest ID (UUID format)
    const digestIdMatch = message.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (digestIdMatch) {
      entities.digestId = digestIdMatch[0];
    }

    return entities;
  }

  private static extractWithPatterns(text: string, patterns: RegExp[]): string[] {
    const results: string[] = [];
    
    patterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern));
      for (const match of matches) {
        if (match[1]) {
          results.push(match[1]);
        }
      }
    });
    
    return Array.from(new Set(results)); // Remove duplicates
  }

  private static isValidRssUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol.startsWith('http') && 
             (url.includes('rss') || url.includes('feed') || url.includes('xml'));
    } catch {
      return false;
    }
  }

  private static normalizeModelName(model: string): 'openai' | 'anthropic' | 'google' | 'ollama' {
    const lower = model.toLowerCase();
    
    if (lower.includes('gpt') || lower.includes('openai')) return 'openai';
    if (lower.includes('claude') || lower.includes('anthropic')) return 'anthropic';  
    if (lower.includes('gemini') || lower.includes('google')) return 'google';
    if (lower.includes('ollama') || lower.includes('llama')) return 'ollama';
    
    return 'openai'; // Default fallback
  }

  private static parseTimeExpression(timeExpr: string): string {
    const lower = timeExpr.toLowerCase();
    const numberMatch = lower.match(/\d+/);
    const number = numberMatch ? parseInt(numberMatch[0]) : 1;
    
    if (lower.includes('hour')) return `${number}h`;
    if (lower.includes('day')) return `${number}d`;  
    if (lower.includes('week')) return `${number}w`;
    
    return '24h';
  }

  /**
   * Extract RSS URLs from brand names mentioned in the message
   */
  private static extractRSSBrandUrls(message: string): string[] {
    const rssBrandMap: Record<string, string> = {
      'techcrunch': 'https://techcrunch.com/feed/',
      'tech crunch': 'https://techcrunch.com/feed/',
      'hacker news': 'https://feeds.feedburner.com/ycombinator',
      'hackernews': 'https://feeds.feedburner.com/ycombinator',
      'hn': 'https://feeds.feedburner.com/ycombinator',
      'ycombinator': 'https://feeds.feedburner.com/ycombinator',
      'engadget': 'https://www.engadget.com/rss.xml',
      'the verge': 'https://www.theverge.com/rss/index.xml',
      'theverge': 'https://www.theverge.com/rss/index.xml',
      'verge': 'https://www.theverge.com/rss/index.xml',
      'wired': 'https://www.wired.com/feed/rss',
      'ars technica': 'https://feeds.arstechnica.com/arstechnica/index',
      'arstechnica': 'https://feeds.arstechnica.com/arstechnica/index',
      'reddit': 'https://www.reddit.com/.rss',
      'bbc news': 'https://feeds.bbci.co.uk/news/rss.xml',
      'bbc': 'https://feeds.bbci.co.uk/news/rss.xml',
      'cnn': 'http://rss.cnn.com/rss/edition.rss',
      'reuters': 'https://feeds.reuters.com/reuters/topNews'
    };

    const urls: string[] = [];
    const lowerMessage = message.toLowerCase();

    for (const [brand, url] of Object.entries(rssBrandMap)) {
      if (lowerMessage.includes(brand)) {
        urls.push(url);
      }
    }
    return urls;
  }
}