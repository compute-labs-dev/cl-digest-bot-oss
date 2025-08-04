// lib/rss/rss-processor.ts

import { XMLParser } from 'fast-xml-parser';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { RSSFeed, RSSArticle, RSSProcessingResult } from '../../types/rss';
import { getRssFeedConfig } from '../../config/data-sources-config';
import { envConfig } from '../../config/environment';
import logger from '../logger';
import { ProgressTracker } from '../../utils/progress';
import crypto from 'crypto';

interface RSSParseOptions {
  maxArticles?: number;
  extractFullContent?: boolean;
  includeOldArticles?: boolean;
  sinceDate?: Date;
}

export class RSSProcessor {
  private xmlParser: XMLParser;
  private readonly userAgent = 'Mozilla/5.0 (compatible; ContentBot/1.0; +https://yoursite.com/bot)';

  constructor() {
    // Configure XML parser for RSS feeds
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseTagValue: true,
      parseAttributeValue: true,
      trimValues: true,
    });
  }

  /**
   * Process RSS feed and extract articles
   */
  async processFeed(feedUrl: string, options: RSSParseOptions = {}): Promise<RSSProcessingResult> {
    const config = getRssFeedConfig(feedUrl);
    const maxArticles = options.maxArticles || config.articlesPerFeed;
    
    const progress = new ProgressTracker({
      total: 4, // Fetch, parse, extract content, process
      label: `Processing RSS feed: ${this.getFeedDisplayName(feedUrl)}`
    });

    const result: RSSProcessingResult = {
      feed: { url: feedUrl, title: 'Unknown Feed' },
      articles: [],
      total_processed: 0,
      successful_extractions: 0,
      errors: []
    };

    try {
      // Step 1: Fetch RSS XML
      progress.update(1, { step: 'Fetching RSS XML' });
      const xmlContent = await this.fetchFeedXML(feedUrl);

      // Step 2: Parse RSS structure
      progress.update(2, { step: 'Parsing RSS structure' });
      const parsedFeed = this.parseRSSXML(xmlContent);
      
      result.feed = this.extractFeedInfo(parsedFeed, feedUrl);
      const rawArticles = this.extractRawArticles(parsedFeed, result.feed);

      // Filter and limit articles
      const filteredArticles = this.filterArticles(rawArticles, options)
        .slice(0, maxArticles);

      result.total_processed = filteredArticles.length;

      if (filteredArticles.length === 0) {
        progress.complete('No new articles found');
        return result;
      }

      // Step 3: Extract full content (if requested)
      progress.update(3, { step: 'Extracting full content' });
      
      if (options.extractFullContent !== false) {
        await this.extractFullContent(filteredArticles, result.errors);
        result.successful_extractions = filteredArticles.filter(a => a.content_extracted).length;
      }

      // Step 4: Process and enhance articles
      progress.update(4, { step: 'Processing articles' });
      result.articles = filteredArticles
        .map(article => this.enhanceArticle(article, config))
        .filter(article => this.passesQualityFilter(article, config));

      progress.complete(`Processed ${result.articles.length} quality articles from RSS feed`);

      logger.info(`RSS processing completed for ${feedUrl}`, {
        total_articles: result.total_processed,
        quality_articles: result.articles.length,
        extraction_success_rate: result.successful_extractions / result.total_processed,
        errors: result.errors.length
      });

      return result;

    } catch (error: any) {
      progress.fail(`Failed to process RSS feed: ${error.message}`);
      logger.error(`RSS processing error for ${feedUrl}`, error);
      result.errors.push(error.message);
      throw error;
    }
  }

  /**
   * Fetch RSS XML from URL
   */
  private async fetchFeedXML(feedUrl: string): Promise<string> {
    try {
      const response = await fetch(feedUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Encoding': 'gzip, deflate',
        },
        timeout: envConfig.apiTimeouts.rss
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('xml') && !contentType.includes('rss')) {
        logger.warn(`Unexpected content type for RSS feed: ${contentType}`);
      }

      return await response.text();

    } catch (error: any) {
      logger.error(`Failed to fetch RSS feed: ${feedUrl}`, error);
      throw new Error(`Could not fetch RSS feed: ${error.message}`);
    }
  }

  /**
   * Parse RSS XML into structured data
   */
  private parseRSSXML(xmlContent: string): any {
    try {
      const parsed = this.xmlParser.parse(xmlContent);
      
      // Handle different RSS formats (RSS 2.0, Atom, etc.)
      if (parsed.rss && parsed.rss.channel) {
        return parsed.rss.channel; // RSS 2.0
      } else if (parsed.feed) {
        return this.convertAtomToRSS(parsed.feed); // Atom feed
      } else if (parsed.channel) {
        return parsed.channel; // RSS 1.0
      } else {
        throw new Error('Unrecognized RSS/XML format');
      }

    } catch (error: any) {
      logger.error('Failed to parse RSS XML', error);
      throw new Error(`XML parsing failed: ${error.message}`);
    }
  }

  /**
   * Convert Atom feed to RSS-like structure
   */
  private convertAtomToRSS(atomFeed: any): any {
    const entries = Array.isArray(atomFeed.entry) ? atomFeed.entry : [atomFeed.entry].filter(Boolean);
    
    return {
      title: atomFeed.title?.['#text'] || atomFeed.title,
      description: atomFeed.subtitle?.['#text'] || atomFeed.subtitle,
      link: atomFeed.link?.['@_href'] || atomFeed.link,
      item: entries.map((entry: any) => ({
        title: entry.title?.['#text'] || entry.title,
        link: entry.link?.['@_href'] || entry.link,
        description: entry.summary?.['#text'] || entry.summary,
        content: entry.content?.['#text'] || entry.content,
        pubDate: entry.published || entry.updated,
        author: entry.author?.name || entry.author,
        category: entry.category
      }))
    };
  }

  /**
   * Extract feed metadata
   */
  private extractFeedInfo(parsedFeed: any, feedUrl: string): RSSFeed {
    return {
      url: feedUrl,
      title: parsedFeed.title || 'Unknown Feed',
      description: parsedFeed.description,
      link: parsedFeed.link,
      language: parsedFeed.language,
      last_build_date: parsedFeed.lastBuildDate || parsedFeed.pubDate,
      image_url: parsedFeed.image?.url || parsedFeed.image?.['@_href'],
      category: Array.isArray(parsedFeed.category) 
        ? parsedFeed.category 
        : parsedFeed.category ? [parsedFeed.category] : []
    };
  }

  /**
   * Extract raw articles from parsed feed
   */
  private extractRawArticles(parsedFeed: any, feedInfo: RSSFeed): RSSArticle[] {
    const items = Array.isArray(parsedFeed.item) ? parsedFeed.item : [parsedFeed.item].filter(Boolean);
    
    return items.map((item: any) => {
      const link = item.link?.['#text'] || item.link || '';
      const id = this.generateArticleId(link, item.title);
      
      return {
        id,
        title: item.title || 'Untitled',
        link,
        description: item.description?.replace(/<[^>]*>/g, '').trim(), // Strip HTML
        content: item.content || item['content:encoded'], // Full content if available
        author: item.author || item['dc:creator'],
        published_at: this.parseDate(item.pubDate || item.published),
        
        feed_url: feedInfo.url,
        feed_title: feedInfo.title,
        
        word_count: 0, // Will be calculated
        quality_score: 0, // Will be calculated
        categories: this.extractCategories(item),
        
        content_extracted: !!item.content,
        extraction_method: item.content ? 'rss' : 'none',
        raw_data: item,
        fetched_at: new Date().toISOString()
      };
    });
  }

  /**
   * Generate unique ID for article
   */
  private generateArticleId(link: string, title: string): string {
    const source = link || title || Math.random().toString();
    return crypto.createHash('md5').update(source).digest('hex');
  }

  /**
   * Parse date from various RSS date formats
   */
  private parseDate(dateStr: string | undefined): string | undefined {
    if (!dateStr) return undefined;
    
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? undefined : date.toISOString();
    } catch {
      return undefined;
    }
  }

  /**
   * Extract categories/tags from RSS item
   */
  private extractCategories(item: any): string[] {
    const categories: string[] = [];
    
    if (item.category) {
      if (Array.isArray(item.category)) {
        categories.push(...item.category.map((cat: any) => cat['#text'] || cat).filter(Boolean));
      } else {
        const cat = item.category['#text'] || item.category;
        if (cat) categories.push(cat);
      }
    }
    
    // Also check for tags
    if (item.tag) {
      if (Array.isArray(item.tag)) {
        categories.push(...item.tag);
      } else {
        categories.push(item.tag);
      }
    }
    
    return Array.from(new Set(categories)); // Remove duplicates
  }

  /**
   * Filter articles based on options
   */
  private filterArticles(articles: RSSArticle[], options: RSSParseOptions): RSSArticle[] {
    return articles.filter(article => {
      // Date filter
      if (options.sinceDate && article.published_at) {
        const articleDate = new Date(article.published_at);
        if (articleDate < options.sinceDate) return false;
      }
      
      // Must have title and link
      if (!article.title.trim() || !article.link) return false;
      
      return true;
    });
  }

  /**
   * Extract full content from article URLs
   */
  private async extractFullContent(articles: RSSArticle[], errors: string[]): Promise<void> {
    const extractionPromises = articles
      .filter(article => !article.content_extracted && article.link)
      .map(article => this.extractSingleArticle(article, errors));

    await Promise.allSettled(extractionPromises);
  }

  /**
   * Extract content from a single article URL
   */
  private async extractSingleArticle(article: RSSArticle, errors: string[]): Promise<void> {
    try {
      const response = await fetch(article.link, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000 // 10 second timeout per article
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const content = this.extractContentFromHTML(html);
      
      if (content && content.length > 200) {
        article.content = content;
        article.content_extracted = true;
        article.extraction_method = 'web_scraping';
      }

      // Add small delay to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      errors.push(`Failed to extract content from ${article.link}: ${error.message}`);
      logger.debug(`Content extraction failed for ${article.link}`, error);
    }
  }

  /**
   * Extract main content from HTML using simple heuristics
   */
  private extractContentFromHTML(html: string): string | null {
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Remove script and style elements
      document.querySelectorAll('script, style, nav, header, footer, aside').forEach(el => el.remove());

      // Common content selectors (in order of preference)
      const contentSelectors = [
        'article',
        '[role="main"]',
        '.post-content',
        '.entry-content',
        '.article-content',
        '.content',
        'main',
        '.post-body'
      ];

      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim();
          if (text && text.length > 200) {
            return text;
          }
        }
      }

      // Fallback: look for the largest text block
      const paragraphs = Array.from(document.querySelectorAll('p'));
      const textBlocks = paragraphs
        .map(p => p.textContent?.trim() || '')
        .filter(text => text.length > 50);

      if (textBlocks.length > 0) {
        return textBlocks.join('\n\n');
      }

      return null;

    } catch (error) {
      logger.debug('HTML content extraction failed', error);
      return null;
    }
  }

  /**
   * Enhance article with computed fields
   */
  private enhanceArticle(article: RSSArticle, config: any): RSSArticle {
    // Calculate word count
    const content = article.content || article.description || '';
    article.word_count = content.split(/\s+/).length;

    // Trim content if too long
    if (article.content && article.content.length > config.maxArticleLength) {
      article.content = article.content.substring(0, config.maxArticleLength) + '...';
    }

    // Calculate quality score
    article.quality_score = this.calculateQualityScore(article);

    return article;
  }

  /**
   * Calculate quality score for article
   */
  private calculateQualityScore(article: RSSArticle): number {
    let score = 0.5; // Base score

    // Content availability
    if (article.content_extracted && article.content) score += 0.2;
    if (article.description && article.description.length > 100) score += 0.1;

    // Metadata completeness
    if (article.author) score += 0.1;
    if (article.published_at) score += 0.1;
    if (article.categories.length > 0) score += 0.1;

    // Content quality indicators
    if (article.word_count > 300) score += 0.1;
    if (article.word_count > 1000) score += 0.1;
    if (article.word_count < 100) score -= 0.2;

    // Title quality
    const title = article.title.toLowerCase();
    if (title.includes('?')) score += 0.05; // Questions are engaging
    if (title.length > 50 && title.length < 100) score += 0.05; // Good length
    if (title.includes('breaking') || title.includes('exclusive')) score += 0.05;

    // Negative indicators
    if (title.includes('advertisement') || title.includes('sponsored')) score -= 0.3;
    if (article.link.includes('ads.') || article.link.includes('promo.')) score -= 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check if article passes quality filters
   */
  private passesQualityFilter(article: RSSArticle, config: any): boolean {
    // Length filters
    if (article.word_count < config.minArticleLength / 5) return false; // Rough word estimate
    
    // Quality filter
    if (article.quality_score < 0.4) return false;

    // Must have meaningful content
    if (!article.title.trim()) return false;

    return true;
  }

  /**
   * Get display name for feed URL
   */
  private getFeedDisplayName(feedUrl: string): string {
    try {
      const url = new URL(feedUrl);
      return url.hostname.replace('www.', '');
    } catch {
      return feedUrl;
    }
  }

  /**
   * Test RSS feed accessibility
   */
  async testFeed(feedUrl: string): Promise<boolean> {
    try {
      const xmlContent = await this.fetchFeedXML(feedUrl);
      this.parseRSSXML(xmlContent);
      return true;
    } catch (error) {
      logger.error(`RSS feed test failed for ${feedUrl}`, error);
      return false;
    }
  }
}