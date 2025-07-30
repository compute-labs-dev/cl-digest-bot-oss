// lib/telegram/telegram-scraper.ts

import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { TelegramChannel, TelegramMessage, TelegramScrapeResult } from '../../types/telegram';
import { getTelegramChannelConfig } from '../../config/data-sources-config';
import { envConfig } from '../../config/environment';
import logger from '../logger';
import { ProgressTracker } from '../../utils/progress';

interface ScrapingOptions {
  maxMessages?: number;
  beforeDate?: Date;
  afterDate?: Date;
}

export class TelegramScraper {
  private readonly baseUrl = 'https://t.me';
  private readonly userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  private rateLimitDelay = envConfig.development ? 2000 : 5000; // More conservative in production

  /**
   * Scrape messages from a Telegram channel
   */
  async scrapeChannel(channelUsername: string, options: ScrapingOptions = {}): Promise<TelegramScrapeResult> {
    const config = getTelegramChannelConfig(channelUsername);
    const maxMessages = options.maxMessages || config.messagesPerChannel;
    
    const progress = new ProgressTracker({
      total: Math.ceil(maxMessages / 20), // Estimate pages (20 messages per page)
      label: `Scraping t.me/${channelUsername}`
    });

    try {
      // Step 1: Get channel info and first batch of messages
      progress.update(1, { step: 'Loading channel' });
      
      const channelUrl = `${this.baseUrl}/${channelUsername}`;
      const channelData = await this.fetchChannelPage(channelUrl);
      
      if (!channelData.channel) {
        throw new Error(`Channel @${channelUsername} not found or is private`);
      }

      let allMessages: TelegramMessage[] = [];
      let hasMore = true;
      let offset = 0;
      let pageCount = 0;

      // Step 2: Paginate through messages
      while (hasMore && allMessages.length < maxMessages && pageCount < 10) {
        pageCount++;
        progress.update(pageCount, { step: `Page ${pageCount}` });

        const pageMessages = await this.scrapeMessagesPage(
          channelUsername, 
          channelData.channel,
          offset
        );

        if (pageMessages.length === 0) {
          hasMore = false;
          break;
        }

        // Filter messages based on options
        const filteredMessages = this.filterMessages(pageMessages, options);
        allMessages.push(...filteredMessages);

        // Update offset for next page
        offset += pageMessages.length;

        // Rate limiting
        await this.respectRateLimit();

        // Check if we should continue
        if (pageMessages.length < 20) hasMore = false; // Telegram typically shows 20 per page
      }

      // Step 3: Process and enhance messages
      progress.update(pageCount + 1, { step: 'Processing messages' });
      
      const processedMessages = allMessages
        .slice(0, maxMessages) // Respect the limit
        .map(msg => this.enhanceMessage(msg))
        .filter(msg => this.passesQualityFilter(msg, config));

      progress.complete(`Scraped ${processedMessages.length} messages from t.me/${channelUsername}`);

      return {
        channel: channelData.channel,
        messages: processedMessages,
        total_scraped: processedMessages.length,
        has_more: hasMore,
        next_offset: offset
      };

    } catch (error: any) {
      progress.fail(`Failed to scrape t.me/${channelUsername}: ${error.message}`);
      logger.error(`Telegram scraping error for ${channelUsername}`, error);
      throw error;
    }
  }

  /**
   * Fetch and parse channel main page
   */
  private async fetchChannelPage(url: string): Promise<{ channel: TelegramChannel | null; html: string }> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        timeout: envConfig.apiTimeouts.telegram
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Channel not found or is private');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const channel = this.parseChannelInfo(html, url);

      return { channel, html };

    } catch (error) {
      logger.error(`Failed to fetch Telegram channel page: ${url}`, error);
      throw error;
    }
  }

  /**
   * Parse channel information from HTML
   */
  private parseChannelInfo(html: string, url: string): TelegramChannel | null {
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Extract channel info from meta tags and page content
      const title = document.querySelector('.tgme_channel_info_header_title')?.textContent?.trim() ||
                   document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                   'Unknown Channel';

      const description = document.querySelector('.tgme_channel_info_description')?.textContent?.trim() ||
                         document.querySelector('meta[property="og:description"]')?.getAttribute('content');

      const username = url.split('/').pop() || '';

      // Try to extract subscriber count
      let subscribers: number | undefined;
      const subscriberText = document.querySelector('.tgme_channel_info_counter')?.textContent;
      if (subscriberText) {
        const match = subscriberText.match(/(\d+(?:\.\d+)?)\s*([KMB]?)/i);
        if (match) {
          const [, num, suffix] = match;
          const multipliers: { [key: string]: number } = { K: 1000, M: 1000000, B: 1000000000 };
          subscribers = Math.floor(parseFloat(num) * (multipliers[suffix.toUpperCase()] || 1));
        }
      }

      const photoUrl = document.querySelector('.tgme_channel_info_header_photo img')?.getAttribute('src');

      return {
        username,
        title,
        description: description || undefined,
        subscribers,
        photo_url: photoUrl || undefined
      };

    } catch (error) {
      logger.error('Failed to parse channel info', error);
      return null;
    }
  }

  /**
   * Scrape messages from a specific page/offset
   */
  private async scrapeMessagesPage(
    channelUsername: string, 
    channel: TelegramChannel,
    offset: number = 0
  ): Promise<TelegramMessage[]> {
    try {
      // Telegram uses different URLs for pagination
      const pageUrl = offset > 0 
        ? `${this.baseUrl}/${channelUsername}?before=${offset}`
        : `${this.baseUrl}/${channelUsername}`;

      const response = await fetch(pageUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: envConfig.apiTimeouts.telegram
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseMessages(html, channel);

    } catch (error) {
      logger.error(`Failed to scrape messages page for ${channelUsername}`, error);
      return [];
    }
  }

  /**
   * Parse messages from HTML
   */
  private parseMessages(html: string, channel: TelegramChannel): TelegramMessage[] {
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      const messageElements = document.querySelectorAll('.tgme_widget_message');
      const messages: TelegramMessage[] = [];

      messageElements.forEach(element => {
        try {
          const message = this.parseMessage(element as any, channel);
          if (message) {
            messages.push(message);
          }
        } catch (error) {
          logger.debug('Failed to parse individual message', error);
          // Continue with other messages
        }
      });

      return messages;

    } catch (error) {
      logger.error('Failed to parse messages from HTML', error);
      return [];
    }
  }

  /**
   * Parse individual message element
   */
  private parseMessage(element: any, channel: TelegramChannel): TelegramMessage | null {
    try {
      // Extract message ID
      const messageId = element.getAttribute('data-post')?.split('/')[1];
      if (!messageId) return null;

      // Extract text content
      const textElement = element.querySelector('.tgme_widget_message_text');
      const text = textElement?.textContent?.trim() || '';
      
      if (!text && !element.querySelector('.tgme_widget_message_photo, .tgme_widget_message_video')) {
        return null; // Skip empty messages without media
      }

      // Extract timestamp
      const timeElement = element.querySelector('.tgme_widget_message_date time');
      const datetime = timeElement?.getAttribute('datetime');
      const messageDate = datetime ? new Date(datetime).toISOString() : new Date().toISOString();

      // Extract author (if available)
      const authorElement = element.querySelector('.tgme_widget_message_from_author');
      const author = authorElement?.textContent?.trim();

      // Extract engagement metrics
      const views = this.extractNumber(element.querySelector('.tgme_widget_message_views')?.textContent) || 0;
      const forwards = this.extractNumber(element.querySelector('.tgme_widget_message_forwards')?.textContent) || 0;
      const replies = this.extractNumber(element.querySelector('.tgme_widget_message_replies')?.textContent) || 0;

      // Check for media
      const hasMedia = !!(
        element.querySelector('.tgme_widget_message_photo') ||
        element.querySelector('.tgme_widget_message_video') ||
        element.querySelector('.tgme_widget_message_document')
      );

      // Extract media description
      const mediaDescription = element.querySelector('.tgme_widget_message_photo_caption, .tgme_widget_message_video_caption')?.textContent?.trim();

      // Extract links
      const linkElements = element.querySelectorAll('a[href]');
      const links: string[] = [];
      linkElements.forEach((link: any) => {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
          links.push(href);
        }
      });

      // Generate source URL
      const sourceUrl = `${this.baseUrl}/${channel.username}/${messageId}`;

      return {
        id: `${channel.username}_${messageId}`,
        message_id: messageId,
        channel_username: channel.username,
        channel_title: channel.title,
        text: text + (mediaDescription ? `\n\n[Media: ${mediaDescription}]` : ''),
        author,
        message_date: messageDate,
        views,
        forwards,
        replies,
        has_media: hasMedia,
        media_description: mediaDescription,
        links,
        quality_score: 0, // Will be calculated in enhanceMessage
        source_url: sourceUrl,
        raw_html: element.outerHTML,
        fetched_at: new Date().toISOString()
      };

    } catch (error) {
      logger.debug('Failed to parse message element', error);
      return null;
    }
  }

  /**
   * Extract numeric value from text (handles K, M, B suffixes)
   */
  private extractNumber(text: string | null | undefined): number {
    if (!text) return 0;
    
    const match = text.match(/(\d+(?:\.\d+)?)\s*([KMB]?)/i);
    if (!match) return 0;

    const [, num, suffix] = match;
    const multipliers: { [key: string]: number } = { K: 1000, M: 1000000, B: 1000000000 };
    return Math.floor(parseFloat(num) * (multipliers[suffix.toUpperCase()] || 1));
  }

  /**
   * Filter messages based on options
   */
  private filterMessages(messages: TelegramMessage[], options: ScrapingOptions): TelegramMessage[] {
    return messages.filter(message => {
      const messageDate = new Date(message.message_date);

      // Date filters
      if (options.beforeDate && messageDate > options.beforeDate) return false;
      if (options.afterDate && messageDate < options.afterDate) return false;

      return true;
    });
  }

  /**
   * Enhance message with quality scoring
   */
  private enhanceMessage(message: TelegramMessage): TelegramMessage {
    const qualityScore = this.calculateQualityScore(message);
    return { ...message, quality_score: qualityScore };
  }

  /**
   * Calculate quality score for a message
   */
  private calculateQualityScore(message: TelegramMessage): number {
    let score = 0.5; // Base score

    // Text quality indicators
    const text = message.text.toLowerCase();
    const wordCount = text.split(/\s+/).length;

    // Length indicators
    if (wordCount >= 10) score += 0.1; // Substantial content
    if (wordCount >= 50) score += 0.1; // Long-form content
    if (wordCount > 200) score -= 0.1; // Too long might be spam

    // Content quality indicators
    if (message.links.length > 0 && message.links.length <= 3) score += 0.1; // Has relevant links
    if (message.has_media && message.media_description) score += 0.1; // Quality media
    if (text.includes('?')) score += 0.05; // Questions engage
    if (/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(text)) score += 0.05; // Contains dates (news-like)

    // Engagement indicators
    const totalEngagement = message.views + (message.forwards * 10) + (message.replies * 5);
    if (totalEngagement > 100) score += 0.1;
    if (totalEngagement > 1000) score += 0.1;
    if (totalEngagement > 10000) score += 0.1;

    // Negative indicators
    if (text.includes('subscribe') && text.includes('channel')) score -= 0.2; // Promotional
    if ((text.match(/[@#]\w+/g)?.length || 0) > 5) score -= 0.1; // Tag spam
    if (message.links.length > 5) score -= 0.2; // Link spam

    return Math.max(0, Math.min(1, score)); // Clamp between 0 and 1
  }

  /**
   * Check if message passes quality filters
   */
  private passesQualityFilter(message: TelegramMessage, config: any): boolean {
    // Length filter
    if (message.text.length < config.minMessageLength) {
      return false;
    }

    // Quality filter
    if (message.quality_score < 0.3) {
      return false;
    }

    return true;
  }

  /**
   * Rate limiting
   */
  private async respectRateLimit(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
  }

  /**
   * Test connection to Telegram
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://t.me/telegram', {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000
      });
      return response.ok;
    } catch (error) {
      logger.error('Telegram connection test failed', error);
      return false;
    }
  }
}