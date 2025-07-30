// types/telegram.ts

export interface TelegramChannel {
    username: string;      // Channel username (without @)
    title: string;         // Display name
    description?: string;  // Channel description
    subscribers?: number;  // Subscriber count
    photo_url?: string;   // Channel avatar
  }
  
  export interface TelegramMessage {
    id: string;                    // Unique message ID
    message_id: string;            // Telegram's internal ID
    channel_username: string;      // Source channel
    channel_title: string;        // Channel display name
    text: string;                  // Message content
    author?: string;               // Message author (if available)
    message_date: string;          // When posted
    
    // Engagement metrics
    views: number;                 // View count
    forwards: number;              // Forward count
    replies: number;               // Reply count
    
    // Content analysis
    has_media: boolean;            // Contains photos/videos
    media_description?: string;    // Alt text for media
    links: string[];               // Extracted URLs
    
    // Processing metadata
    quality_score: number;         // Our quality assessment
    source_url: string;           // Direct link to message
    raw_html?: string;            // Original HTML (for debugging)
    fetched_at: string;           // When we scraped it
  }
  
  export interface TelegramScrapeResult {
    channel: TelegramChannel;
    messages: TelegramMessage[];
    total_scraped: number;
    has_more: boolean;
    next_offset?: number;
  }