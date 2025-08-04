// types/rss.ts

export interface RSSFeed {
    url: string;
    title: string;
    description?: string;
    link?: string;
    language?: string;
    last_build_date?: string;
    image_url?: string;
    category?: string[];
}

export interface RSSArticle {
    id: string;                    // Generated unique ID
    title: string;                 // Article headline
    link: string;                  // Original article URL
    description?: string;          // Article summary/excerpt
    content?: string;              // Full article content
    author?: string;               // Article author
    published_at?: string;         // Publication date
    
    // Feed metadata
    feed_url: string;              // Source feed URL
    feed_title?: string;           // Source publication name
    
    // Content analysis
    word_count: number;            // Article length
    quality_score: number;         // Our quality assessment
    categories: string[];          // Article tags/categories
    
    // Processing metadata
    content_extracted: boolean;    // Whether we got full content
    extraction_method?: string;    // How we got the content
    raw_data: any;                // Original RSS item data
    fetched_at: string;           // When we processed it
}

export interface RSSProcessingResult {
    feed: RSSFeed;
    articles: RSSArticle[];
    total_processed: number;
    successful_extractions: number;
    errors: string[];
}