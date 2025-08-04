// lib/agent/intent-parser.ts

import { AIService } from '../ai/ai-service';
import { ParsedIntent, ExtractedEntities, IntentRecognitionResult } from '../../types/agent';
import { EntityExtractor } from './entity-extractor';
import logger from '../logger';

export class IntentParser {
  private aiService: AIService;
  
  constructor() {
    this.aiService = AIService.getInstance();
    // Use a fast, cost-effective model for intent parsing
    this.aiService.useGemini('gemini-1.5-flash'); // Fast and cheap for this task
  }

  /**
   * Parse user message into structured intent
   */
  async parseIntent(userMessage: string): Promise<IntentRecognitionResult> {
    try {
      logger.info('Parsing user intent', { message: userMessage });

      // Build intent recognition prompt
      const prompt = this.buildIntentPrompt(userMessage);
      
      // Get AI analysis
      const response = await this.aiService.generateText({
        prompt,
        maxTokens: 1000,
        temperature: 0.3 // Low temperature for consistent parsing
      });

      // Parse AI response into structured intent
      const parsedIntent = this.parseAIResponse(response.text, userMessage);
      
      return {
        success: true,
        intent: parsedIntent
      };

    } catch (error: any) {
      logger.error('Intent parsing failed', { error: error.message, message: userMessage });
      
      return {
        success: false,
        error: 'Could not understand your request. Please try rephrasing.',
        needsClarification: {
          question: 'Could you please rephrase your request?',
          options: [
            'Add a Twitter account: "Add @username to Twitter sources"',
            'Change AI model: "Switch to Gemini model"',
            'Generate digest: "Create a digest about AI news"'
          ]
        }
      };
    }
  }

  /**
   * Build prompt for intent recognition
   */
  private buildIntentPrompt(userMessage: string): string {
    return `You are an expert at understanding user requests for a content digest system. 

USER MESSAGE: "${userMessage}"

Analyze this message and extract:
1. The primary intent (what the user wants to do)
2. Entities (usernames, URLs, parameters, etc.)
3. Confidence level (0.0 to 1.0)

SUPPORTED INTENTS:
- ADD_TWITTER_SOURCE: Add Twitter account to monitoring
- REMOVE_TWITTER_SOURCE: Remove Twitter account  
- ADD_RSS_SOURCE: Add RSS feed to monitoring
- REMOVE_RSS_SOURCE: Remove RSS feed
- ADD_TELEGRAM_SOURCE: Add Telegram channel
- REMOVE_TELEGRAM_SOURCE: Remove Telegram channel
- CHANGE_AI_MODEL: Switch AI provider (openai, anthropic, google, ollama)
- ADJUST_AI_SETTINGS: Modify AI parameters
- RUN_DIGEST: Generate a digest with specific parameters
- SCHEDULE_DIGEST: Set up automated digest generation
- GET_STATUS: Check system status
- GET_SOURCES: List current sources
- GET_RECENT_DIGESTS: Show recent digest history
- GET_DIGEST_BY_ID: Show specific digest by ID
- GET_HELP: Show all available commands and capabilities
- MULTI_ACTION: Multiple actions in one request
- UNKNOWN: Can't determine intent

ENTITY EXTRACTION RULES:
- Twitter usernames: Extract @username or just username
- RSS URLs: Extract complete feed URLs OR brand names like "TechCrunch", "Hacker News", "The Verge"
- Telegram channels: Extract channel names or @handles
- AI models: openai, anthropic, claude, google, gemini, ollama
- Time ranges: "last 24 hours", "past week", etc.
- Focus topics: Extract subject areas like "AI", "crypto", "tech", etc.
- Numbers: max articles, confidence thresholds, etc.
- Digest IDs: UUID format like "fee6c2b0-21b8-4fb6-a8b5-5277c344511d"

RSS BRAND EXAMPLES:
- "Subscribe to TechCrunch RSS" → extract "TechCrunch" as RSS brand
- "Add Hacker News feed" → extract "Hacker News" as RSS brand
- "Subscribe to The Verge" → extract "The Verge" as RSS brand

HELP REQUEST EXAMPLES:
- "What can I do?" → GET_HELP
- "Help" → GET_HELP  
- "Show me available commands" → GET_HELP
- "What are my options?" → GET_HELP
- "How do I use this?" → GET_HELP

OUTPUT FORMAT (JSON):
{
  "intent_type": "ADD_RSS_SOURCE",
  "entities": {
    "twitter_usernames": ["sama", "elonmusk"],
    "rss_urls": ["https://techcrunch.com/feed/"],
    "rss_brands": ["TechCrunch", "Hacker News"],
    "ai_model": "gemini",
    "time_range": "24 hours",
    "focus_topics": ["AI", "crypto"],
    "max_sources": 50,
    "digest_id": "fee6c2b0-21b8-4fb6-a8b5-5277c344511d"
  },
  "confidence": 0.95,
  "requires_confirmation": false,
  "suggested_actions": [
    {
      "action": "add_rss_source",
      "description": "Add TechCrunch RSS feed",
      "parameters": {"brand": "TechCrunch"}
    }
  ]
}

Be precise with entity extraction and conservative with confidence scores.`;
  }

  /**
   * Parse AI response into structured intent
   */
  private parseAIResponse(aiResponse: string, originalMessage: string): ParsedIntent {
    try {
      // Extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      

      
      // Convert to our internal format
      return {
        type: parsed.intent_type,
        entities: this.normalizeEntities(parsed.entities, originalMessage),
        confidence: parsed.confidence,
        originalMessage,
        suggestedActions: parsed.suggested_actions,
        requiresConfirmation: parsed.requires_confirmation || false
      };

    } catch (error: any) {
      logger.error('Failed to parse AI response', { error: error.message, response: aiResponse });
      
      // Fallback to unknown intent
      return {
        type: 'UNKNOWN',
        entities: {},
        confidence: 0.0,
        originalMessage,
        requiresConfirmation: true
      };
    }
  }

  /**
   * Normalize entities to consistent format
   */
  private normalizeEntities(rawEntities: any, originalMessage?: string): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Normalize Twitter usernames (remove @ prefix, lowercase)
    if (rawEntities.twitter_usernames && Array.isArray(rawEntities.twitter_usernames)) {
      entities.twitterUsernames = rawEntities.twitter_usernames.map((username: string) => 
        username.replace('@', '').toLowerCase()
      );
    }

    // Validate RSS URLs
    if (rawEntities.rss_urls && Array.isArray(rawEntities.rss_urls)) {
      entities.rssUrls = rawEntities.rss_urls.filter((url: string) => 
        this.isValidUrl(url)
      );
    }

    // Handle RSS brand names (AI-extracted)
    if (rawEntities.rss_brands && Array.isArray(rawEntities.rss_brands)) {
      entities.rssBrands = rawEntities.rss_brands;
    }

    // Normalize Telegram channels
    if (rawEntities.telegram_channels && Array.isArray(rawEntities.telegram_channels)) {
      entities.telegramChannels = rawEntities.telegram_channels.map((channel: string) =>
        channel.replace('@', '').toLowerCase()
      );
    }

    // AI model validation and mapping
    if (rawEntities.ai_model && typeof rawEntities.ai_model === 'string') {
      const modelMapping: Record<string, 'openai' | 'anthropic' | 'google' | 'ollama'> = {
        'openai': 'openai',
        'gpt': 'openai',
        'anthropic': 'anthropic',
        'claude': 'anthropic',
        'google': 'google',
        'gemini': 'google',
        'ollama': 'ollama'
      };
      
      const normalizedModel = rawEntities.ai_model.toLowerCase();
      if (modelMapping[normalizedModel]) {
        entities.aiModel = modelMapping[normalizedModel];
      }
    }

    // Time range parsing
    if (rawEntities.time_range && typeof rawEntities.time_range === 'string') {
      entities.timeRange = this.parseTimeRange(rawEntities.time_range);
    }

    // Numeric parameters
    if (rawEntities.max_sources && typeof rawEntities.max_sources === 'number') {
      entities.maxSources = Math.max(1, Math.min(1000, rawEntities.max_sources));
    }

    // Digest ID extraction
    if (rawEntities.digest_id && typeof rawEntities.digest_id === 'string' && rawEntities.digest_id.length > 0) {
      entities.digestId = rawEntities.digest_id;
    }

    // Focus topics extraction
    if (rawEntities.focus_topics && Array.isArray(rawEntities.focus_topics) && rawEntities.focus_topics.length > 0) {
      entities.focusTopics = rawEntities.focus_topics;
    }

    // Merge with regex-based entity extraction (includes RSS brand mapping)
    if (originalMessage) {
      const regexExtracted = EntityExtractor.extractEntities(originalMessage, rawEntities);
      

      
      // Merge results intelligently - only use AI entities when they have actual values
      const mergedEntities = { ...regexExtracted };
      
      // Only override with AI entities that have actual values
      if (entities.twitterUsernames && entities.twitterUsernames.length > 0) {
        mergedEntities.twitterUsernames = entities.twitterUsernames;
      }
      if (entities.rssUrls && entities.rssUrls.length > 0) {
        mergedEntities.rssUrls = entities.rssUrls;
      }
      if (entities.telegramChannels && entities.telegramChannels.length > 0) {
        mergedEntities.telegramChannels = entities.telegramChannels;
      }
      if (entities.aiModel) {
        mergedEntities.aiModel = entities.aiModel;
      }
      if (entities.timeRange) {
        mergedEntities.timeRange = entities.timeRange;
      }
      if (entities.maxSources) {
        mergedEntities.maxSources = entities.maxSources;
      }
      if (entities.focusTopics && entities.focusTopics.length > 0) {
        mergedEntities.focusTopics = entities.focusTopics;
      }
      if (entities.digestId) {
        mergedEntities.digestId = entities.digestId;
      }
      
      return mergedEntities;
    }

    return entities;
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return url.includes('rss') || url.includes('feed') || url.includes('xml');
    } catch {
      return false;
    }
  }

  /**
   * Parse natural language time ranges into standard format
   */
  private parseTimeRange(timeRange: string): string {
    const lower = timeRange.toLowerCase();
    
    if (lower.includes('hour')) {
      const hours = this.extractNumber(lower) || 24;
      return `${hours}h`;
    }
    
    if (lower.includes('day')) {
      const days = this.extractNumber(lower) || 1;
      return `${days}d`;
    }
    
    if (lower.includes('week')) {
      const weeks = this.extractNumber(lower) || 1;
      return `${weeks}w`;
    }
    
    return '24h'; // Default fallback
  }

  /**
   * Extract first number from string
   */
  private extractNumber(text: string): number | null {
    const match = text.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }

  /**
   * Test intent parsing with multiple examples
   */
  async testIntentParsing(): Promise<void> {
    const testCases = [
      "Add @elonmusk and @sama to Twitter sources",
      "Remove TechCrunch RSS feed", 
      "Switch to Gemini model to save costs",
      "Generate a digest about AI news from the last 12 hours",
      "Show me the recent digests and their performance",
      "Add https://feeds.feedburner.com/TechCrunch to RSS feeds",
      "Set up automated digests every 3 hours",
      "What sources are currently configured?"
    ];

    console.log('🧪 Testing Intent Recognition\n');

    for (const testCase of testCases) {
      console.log(`Input: "${testCase}"`);
      
      const result = await this.parseIntent(testCase);
      
      if (result.success && result.intent) {
        console.log(`✅ Intent: ${result.intent.type}`);
        console.log(`📊 Confidence: ${result.intent.confidence}`);
        console.log(`🎯 Entities:`, result.intent.entities);
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }
      
      console.log('---\n');
    }
  }
}