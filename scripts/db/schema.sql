-- scripts/db/schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sources table: Track all our data sources
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('twitter', 'telegram', 'rss')),
    url VARCHAR(500),
    username VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tweets table: Store Twitter/X data with engagement metrics
CREATE TABLE tweets (
    id VARCHAR(255) PRIMARY KEY, -- Twitter's tweet ID
    text TEXT NOT NULL,
    author_id VARCHAR(255) NOT NULL,
    author_username VARCHAR(255) NOT NULL,
    author_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Engagement metrics
    retweet_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    quote_count INTEGER DEFAULT 0,
    
    -- Our computed fields
    engagement_score INTEGER DEFAULT 0,
    quality_score FLOAT DEFAULT 0,
    
    -- Metadata
    source_url VARCHAR(500),
    raw_data JSONB,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT tweets_engagement_score_check CHECK (engagement_score >= 0)
);

-- Telegram messages table
CREATE TABLE telegram_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(255) NOT NULL,
    channel_username VARCHAR(255) NOT NULL,
    channel_title VARCHAR(255),
    text TEXT NOT NULL,
    author VARCHAR(255),
    message_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Message metadata
    views INTEGER DEFAULT 0,
    forwards INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    
    -- Our processing
    quality_score FLOAT DEFAULT 0,
    source_url VARCHAR(500),
    raw_data JSONB,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicates
    UNIQUE(message_id, channel_username)
);

-- RSS articles table
CREATE TABLE rss_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    link VARCHAR(500) NOT NULL UNIQUE,
    description TEXT,
    content TEXT,
    author VARCHAR(255),
    published_at TIMESTAMP WITH TIME ZONE,
    
    -- Source information
    feed_url VARCHAR(500) NOT NULL,
    feed_title VARCHAR(255),
    
    -- Our processing
    quality_score FLOAT DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    raw_data JSONB,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Digests table: Store generated summaries
CREATE TABLE digests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    summary TEXT NOT NULL,
    content JSONB NOT NULL, -- Structured digest data
    
    -- Generation metadata
    ai_model VARCHAR(100),
    ai_provider VARCHAR(50),
    token_usage JSONB,
    
    -- Source data window
    data_from TIMESTAMP WITH TIME ZONE NOT NULL,
    data_to TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Publishing
    published_to_slack BOOLEAN DEFAULT false,
    slack_message_ts VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_tweets_created_at ON tweets(created_at DESC);
CREATE INDEX idx_tweets_author_username ON tweets(author_username);
CREATE INDEX idx_tweets_engagement_score ON tweets(engagement_score DESC);

CREATE INDEX idx_telegram_messages_channel ON telegram_messages(channel_username);
CREATE INDEX idx_telegram_messages_date ON telegram_messages(message_date DESC);

CREATE INDEX idx_rss_articles_published ON rss_articles(published_at DESC);
CREATE INDEX idx_rss_articles_feed ON rss_articles(feed_url);

CREATE INDEX idx_digests_created ON digests(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to tables that need it
CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_digests_updated_at BEFORE UPDATE ON digests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();