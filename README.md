# Chapter 2: Building Your Data Foundation - Database & Core Structure

*"Data is the new oil, but like oil, it's only valuable when refined." - Clive Humby*

---

Now that we have our development environment set up, it's time to build the backbone of our system: the database layer and core data structures. Think of this chapter as constructing the foundation and plumbing for a skyscraper—not the most glamorous work, but absolutely critical for everything that follows.

In this chapter, we'll create a robust data layer that can handle thousands of tweets, Telegram messages, and RSS articles while maintaining lightning-fast query performance. We'll also build a professional logging system that will be your best friend when debugging issues at 2 AM.

## 🗄️ Setting Up Supabase: Your PostgreSQL Powerhouse

### Why Supabase Over Other Solutions?

Before we dive in, let's talk about why we chose Supabase:

- **PostgreSQL under the hood**: Real SQL, not a NoSQL compromise
- **Real-time subscriptions**: Watch data change live
- **Built-in authentication**: User management without the headache
- **Edge functions**: Serverless functions that scale
- **Generous free tier**: Perfect for development and small projects

### Creating Your Supabase Project

1. **Sign up at [supabase.com](https://supabase.com)**
2. **Create a new project:**
   - Name: `cl-digest-bot`
   - Database password: Generate a strong one (save it!)
   - Region: Choose the closest to your users

3. **Grab your credentials** from the project settings:
   - Project URL
   - Anon public key
   - Service role key (keep this secret!)

4. **Update your `.env.local`:**

```env
# Add these to your existing .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 🏗️ Database Schema: Designing for Scale

Let's create our database tables. We need to store:
- **Tweets** with engagement metrics
- **Telegram messages** from various channels
- **RSS articles** with metadata
- **Generated digests** and their configurations
- **Source accounts** for each platform

Create this file to define our schema:

```sql
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
```

### 🔧 Setting Up the Database

Now let's create a script to check and initialize our database. Due to Supabase's architecture, the most reliable way to set up tables is through their SQL Editor, but we'll create a helpful script that guides you through the process:

```typescript
// scripts/db/init-db.ts
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.log('\nPlease create .env.local with:');
  console.log('NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🚀 Supabase Database Setup Tool\n');
  
  // Check which tables exist
  const expectedTables = ['sources', 'tweets', 'telegram_messages', 'rss_articles', 'digests'];
  const existingTables: string[] = [];
  const missingTables: string[] = [];

  console.log('🔍 Checking for existing tables...\n');

  for (const tableName of expectedTables) {
    try {
      console.log(`Checking ${tableName}...`);
      const { error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);
      
      if (!error) {
        existingTables.push(tableName);
        console.log(`  ✅ ${tableName} exists`);
      } else {
        missingTables.push(tableName);
        console.log(`  ❌ ${tableName} missing`);
      }
    } catch (err) {
      missingTables.push(tableName);
      console.log(`  ❌ ${tableName} missing (connection error)`);
    }
  }

  console.log('\n📊 Database Status:');
  console.log(`  ✅ Existing tables: ${existingTables.length}/${expectedTables.length}`);
  console.log(`  ❌ Missing tables: ${missingTables.length}`);

  if (missingTables.length === 0) {
    console.log('\n🎉 All tables exist! Your database is ready.');
    
    // Quick test
    try {
      const { data, error } = await supabase
        .from('sources')
        .select('count');
      
      if (!error) {
        console.log('✅ Database operations are working correctly');
      }
    } catch (err) {
      console.log('⚠️  Tables exist but there might be permission issues');
    }
    
    return;
  }

  // Show setup instructions
  console.log('\n🔧 Setup Required!');
  console.log('\nTo create the missing tables:');
  console.log('\n📝 Method 1 - Supabase Dashboard (Recommended):');
  console.log('  1. Go to https://supabase.com/dashboard');
  console.log('  2. Select your project');
  console.log('  3. Click "SQL Editor" in the left sidebar');
  console.log('  4. Copy the SQL below and paste it');
  console.log('  5. Click "Run"');
  
  console.log('\n📄 SQL to copy and paste:');
  console.log('=' + '='.repeat(80));
  
  try {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    console.log(schema);
  } catch (err) {
    console.log('❌ Could not read schema.sql file');
    console.log('Make sure scripts/db/schema.sql exists');
  }
  
  console.log('=' + '='.repeat(80));
  
  console.log('\n✅ After running the SQL, run this script again to verify!');
}

main().catch((error) => {
  console.error('\n❌ Script failed:', error.message);
  console.log('\nTroubleshooting:');
  console.log('1. Check your .env.local file has valid Supabase credentials');
  console.log('2. Verify your Supabase project is active');
  console.log('3. Make sure your service role key is correct');
  process.exit(1);
});
```

### 🚀 Database Setup Process

**Step 1: Run the setup script to check your database:**

```bash
npm run script scripts/db/init-db.ts
```

**Step 2: If tables are missing, use the Supabase SQL Editor:**

1. **Go to your Supabase dashboard** at [supabase.com/dashboard](https://supabase.com/dashboard)
2. **Select your project**
3. **Click "SQL Editor"** in the left sidebar
4. **Copy the SQL output** from the script above
5. **Paste it in the SQL Editor** and click "Run"

**Step 3: Verify the setup:**

```bash
npm run script scripts/db/init-db.ts
```

You should see: `🎉 All tables exist! Your database is ready.`

### 💡 Why This Approach?

**Supabase's architecture** makes direct SQL execution through their JavaScript client challenging for schema creation. The most reliable approach is:

- ✅ **SQL Editor**: Direct database access with full permissions
- ✅ **Verification Script**: Ensures everything is set up correctly  
- ✅ **Error-free**: No complex connection handling or permission issues
- ✅ **Reproducible**: Easy to re-run and verify

## 📝 TypeScript Types: Type Safety for Your Data

Now let's create TypeScript interfaces that match our database schema. This gives us compile-time safety and excellent IDE support:

```typescript
// types/database.ts

export interface Database {
  public: {
    Tables: {
      sources: {
        Row: Source;
        Insert: Omit<Source, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Source>;
      };
      tweets: {
        Row: Tweet;
        Insert: Omit<Tweet, 'processed_at'> & {
          processed_at?: string;
        };
        Update: Partial<Tweet>;
      };
      telegram_messages: {
        Row: TelegramMessage;
        Insert: Omit<TelegramMessage, 'id' | 'fetched_at'> & {
          id?: string;
          fetched_at?: string;
        };
        Update: Partial<TelegramMessage>;
      };
      rss_articles: {
        Row: RSSArticle;
        Insert: Omit<RSSArticle, 'id' | 'fetched_at'> & {
          id?: string;
          fetched_at?: string;
        };
        Update: Partial<RSSArticle>;
      };
      digests: {
        Row: Digest;
        Insert: Omit<Digest, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Digest>;
      };
    };
  };
}

// Individual table types
export interface Source {
  id: string;
  name: string;
  type: 'twitter' | 'telegram' | 'rss';
  url?: string;
  username?: string;
  is_active: boolean;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Tweet {
  id: string; // Twitter's tweet ID
  text: string;
  author_id: string;
  author_username: string;
  author_name?: string;
  created_at: string;
  
  // Engagement metrics
  retweet_count: number;
  like_count: number;
  reply_count: number;
  quote_count: number;
  
  // Computed fields
  engagement_score: number;
  quality_score: number;
  
  // Metadata
  source_url?: string;
  raw_data?: Record<string, any>;
  processed_at: string;
}

export interface TelegramMessage {
  id: string;
  message_id: string;
  channel_username: string;
  channel_title?: string;
  text: string;
  author?: string;
  message_date: string;
  
  // Engagement
  views: number;
  forwards: number;
  replies: number;
  
  // Processing
  quality_score: number;
  source_url?: string;
  raw_data?: Record<string, any>;
  fetched_at: string;
}

export interface RSSArticle {
  id: string;
  title: string;
  link: string;
  description?: string;
  content?: string;
  author?: string;
  published_at?: string;
  
  // Source
  feed_url: string;
  feed_title?: string;
  
  // Processing
  quality_score: number;
  word_count: number;
  raw_data?: Record<string, any>;
  fetched_at: string;
}

export interface Digest {
  id: string;
  title: string;
  summary: string;
  content: DigestContent;
  
  // AI metadata
  ai_model?: string;
  ai_provider?: string;
  token_usage?: TokenUsage;
  
  // Data scope
  data_from: string;
  data_to: string;
  
  // Publishing
  published_to_slack: boolean;
  slack_message_ts?: string;
  
  created_at: string;
  updated_at: string;
}

// Supporting types
export interface DigestContent {
  sections: DigestSection[];
  tweets: TweetDigestItem[];
  articles: ArticleDigestItem[];
  telegram_messages?: TelegramDigestItem[];
  metadata: {
    total_sources: number;
    processing_time_ms: number;
    model_config: any;
  };
}

export interface DigestSection {
  title: string;
  summary: string;
  key_points: string[];
  source_count: number;
}

export interface TweetDigestItem {
  id: string;
  text: string;
  author: string;
  url: string;
  engagement: {
    likes: number;
    retweets: number;
    replies: number;
  };
  relevance_score: number;
}

export interface ArticleDigestItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  published_at: string;
  relevance_score: number;
}

export interface TelegramDigestItem {
  text: string;
  channel: string;
  author?: string;
  url: string;
  date: string;
  relevance_score: number;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reasoning_tokens?: number;
}
```

## 🔌 Supabase Client Setup

Let's create our database client with proper configuration:

```typescript
// lib/supabase/supabase-client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create the client with proper typing
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false, // We're not using auth for now
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Client-Info': 'cl-digest-bot',
      },
    },
  }
);

// Utility function to check connection
export async function testConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('sources')
      .select('count')
      .limit(1);
    
    return !error;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
```

## 📊 Professional Logging: Your Debugging Superpower

Now let's create a robust logging system using Winston. This will be invaluable for monitoring our system in production:

```typescript
// lib/logger/index.ts
import winston from 'winston';
import { join } from 'path';

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow', 
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston about our colors
winston.addColors(logColors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Format for file output (JSON for easier parsing)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels: logLevels,
  format: fileFormat,
  defaultMeta: { service: 'cl-digest-bot' },
  transports: [
    // Write all logs with importance level of 'error' or less to error.log
    new winston.transports.File({
      filename: join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: join(process.cwd(), 'logs', 'combined.log'),
    }),
  ],
});

// Add console output for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync(join(process.cwd(), 'logs'), { recursive: true });
} catch (error) {
  // Directory already exists, ignore
}

export default logger;

// Helper functions for common log patterns
export const logError = (message: string, error?: any, metadata?: any) => {
  logger.error(message, { error: error?.message || error, stack: error?.stack, ...metadata });
};

export const logInfo = (message: string, metadata?: any) => {
  logger.info(message, metadata);
};

export const logDebug = (message: string, metadata?: any) => {
  logger.debug(message, metadata);
};

export const logWarning = (message: string, metadata?: any) => {
  logger.warn(message, metadata);
};
```

## 📈 Progress Tracking: Visual Feedback for Long Operations

Let's create a progress tracking system that integrates with our logging:

```typescript
// utils/progress.ts
import cliProgress from 'cli-progress';
import logger from '../lib/logger';

export interface ProgressConfig {
  total: number;
  label: string;
  showPercentage?: boolean;
  showETA?: boolean;
}

export class ProgressTracker {
  private bar: cliProgress.SingleBar | null = null;
  private startTime: number = 0;
  private label: string = '';

  constructor(config: ProgressConfig) {
    this.label = config.label;
    this.startTime = Date.now();

    // Create progress bar with custom format
    this.bar = new cliProgress.SingleBar({
      format: `${config.label} [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}`,
      hideCursor: true,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      clearOnComplete: false,
      stopOnComplete: true,
    }, cliProgress.Presets.shades_classic);

    this.bar.start(config.total, 0);
    logger.info(`Started: ${config.label}`, { total: config.total });
  }

  update(current: number, data?: any): void {
    if (this.bar) {
      this.bar.update(current, data);
    }
  }

  increment(data?: any): void {
    if (this.bar) {
      this.bar.increment(data);
    }
  }

  complete(message?: string): void {
    if (this.bar) {
      this.bar.stop();
    }

    const duration = Date.now() - this.startTime;
    const completionMessage = message || `Completed: ${this.label}`;
    
    logger.info(completionMessage, { 
      duration_ms: duration,
      duration_formatted: `${(duration / 1000).toFixed(2)}s`
    });

    console.log(`✅ ${completionMessage} (${(duration / 1000).toFixed(2)}s)`);
  }

  fail(error: string): void {
    if (this.bar) {
      this.bar.stop();
    }

    const duration = Date.now() - this.startTime;
    logger.error(`Failed: ${this.label}`, { error, duration_ms: duration });
    console.log(`❌ Failed: ${this.label} - ${error}`);
  }
}

// Progress manager for multiple concurrent operations
export class ProgressManager {
  private trackers: Map<string, ProgressTracker> = new Map();

  create(id: string, config: ProgressConfig): ProgressTracker {
    const tracker = new ProgressTracker(config);
    this.trackers.set(id, tracker);
    return tracker;
  }

  get(id: string): ProgressTracker | undefined {
    return this.trackers.get(id);
  }

  complete(id: string, message?: string): void {
    const tracker = this.trackers.get(id);
    if (tracker) {
      tracker.complete(message);
      this.trackers.delete(id);
    }
  }

  fail(id: string, error: string): void {
    const tracker = this.trackers.get(id);
    if (tracker) {
      tracker.fail(error);
      this.trackers.delete(id);
    }
  }

  cleanup(): void {
    this.trackers.clear();
  }
}

// Global progress manager instance
export const progressManager = new ProgressManager();
```

## 🧪 Testing Your Database Setup

Let's create a comprehensive test to verify everything is working:

```typescript
// scripts/db/test-connection.ts
import { config } from 'dotenv';
import { supabase, testConnection } from '../../lib/supabase/supabase-client';
import logger, { logInfo, logError } from '../../lib/logger';
import { ProgressTracker } from '../../utils/progress';

// Load environment variables
config({ path: '.env.local' });

async function testDatabaseSetup() {
  const progress = new ProgressTracker({
    total: 6,
    label: 'Testing Database Setup'
  });

  try {
    // Test 1: Connection
    progress.update(1, { test: 'Connection' });
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }
    logInfo('✅ Database connection successful');

    // Test 2: Tables exist
    progress.update(2, { test: 'Tables' });
    const expectedTables = ['sources', 'tweets', 'telegram_messages', 'rss_articles', 'digests'];
    const foundTables: string[] = [];
    
    for (const tableName of expectedTables) {
      const { error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);
      
      if (!error) {
        foundTables.push(tableName);
      }
    }
    
    if (expectedTables.every(table => foundTables.includes(table))) {
      logInfo('✅ All required tables exist', { tables: foundTables });
    } else {
      throw new Error(`Missing tables: ${expectedTables.filter(t => !foundTables.includes(t))}`);
    }

    // Test 3: Insert test data
    progress.update(3, { test: 'Insert' });
    const { data: sourceData, error: insertError } = await supabase
      .from('sources')
      .insert({
        name: 'test_source',
        type: 'twitter',
        username: 'test_user',
        config: { test: true }
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Insert failed: ${insertError.message}`);
    }
    logInfo('✅ Test insert successful', { id: sourceData.id });

    // Test 4: Query test data
    progress.update(4, { test: 'Query' });
    const { data: queryData, error: queryError } = await supabase
      .from('sources')
      .select('*')
      .eq('name', 'test_source')
      .single();

    if (queryError || !queryData) {
      throw new Error(`Query failed: ${queryError?.message}`);
    }
    logInfo('✅ Test query successful', { name: queryData.name });

    // Test 5: Update test data
    progress.update(5, { test: 'Update' });
    const { error: updateError } = await supabase
      .from('sources')
      .update({ is_active: false })
      .eq('id', sourceData.id);

    if (updateError) {
      throw new Error(`Update failed: ${updateError.message}`);
    }
    logInfo('✅ Test update successful');

    // Test 6: Clean up
    progress.update(6, { test: 'Cleanup' });
    const { error: deleteError } = await supabase
      .from('sources')
      .delete()
      .eq('id', sourceData.id);

    if (deleteError) {
      throw new Error(`Cleanup failed: ${deleteError.message}`);
    }
    logInfo('✅ Test cleanup successful');

    progress.complete('Database setup test completed successfully!');

  } catch (error) {
    logError('Database test failed', error);
    progress.fail(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the test
testDatabaseSetup();
```

Run the database test:

```bash
npm run test:db
```

## 🎯 What We've Accomplished

Incredible work! You've just built the data foundation for a production-ready system:

✅ **Supabase database** with optimized schema design  
✅ **Type-safe database interfaces** with full TypeScript support  
✅ **Professional logging system** with multiple transports  
✅ **Progress tracking** for long-running operations  
✅ **Comprehensive testing** to verify everything works  

### 🔍 Pro Tips & Common Pitfalls

**💡 Pro Tip:** Always use database indexes on columns you'll query frequently. We've added indexes for `created_at`, `author_username`, and `engagement_score`.

**⚠️ Common Pitfall:** Don't store your service role key in client-side code! It has admin privileges. Use the anon key for frontend operations.

**🔧 Performance Tip:** PostgreSQL's JSONB type is incredibly powerful for storing metadata while maintaining query performance.

---

### 📋 Complete Code Summary - Chapter 2

Here are all the files you should have created:

**Database Schema:**
```bash
# Created: scripts/db/schema.sql (database tables and indexes)
# Created: scripts/db/init-db.ts (database initialization script)
```

**TypeScript Types:** 
```bash
# Created: types/database.ts (complete type definitions)
```

**Core Infrastructure:**
```bash
# Created: lib/supabase/supabase-client.ts (database client)
# Created: lib/logger/index.ts (Winston logging setup)
# Created: utils/progress.ts (progress tracking utilities)
```

**Testing:**
```bash
# Created: scripts/db/test-connection.ts (comprehensive database test)
```

**Package.json scripts to add:**
```json
{
  "scripts": {
    "test:db": "npm run script scripts/db/test-connection.ts",
    "init:db": "npm run script scripts/db/init-db.ts"
  }
}
```

**Your database is now ready to handle:**
- 📊 Thousands of tweets with engagement metrics
- 💬 Telegram messages from multiple channels  
- 📰 RSS articles with content analysis
- 🤖 AI-generated digests with metadata
- 📈 Performance monitoring through logs

**Next up:** In Chapter 3, we'll create the centralized configuration system that makes managing multiple data sources effortless. We'll build type-safe configs that let you fine-tune everything from API rate limits to content quality thresholds—all from one place!

---

*Ready to continue? The next chapter will show you how to build configuration that scales as your system grows. No more hunting through code to change settings! 🚀*# Chapter 2: Building Your Data Foundation - Database & Core Structure

*"Data is the new oil, but like oil, it's only valuable when refined." - Clive Humby*

---

Now that we have our development environment set up, it's time to build the backbone of our system: the database layer and core data structures. Think of this chapter as constructing the foundation and plumbing for a skyscraper—not the most glamorous work, but absolutely critical for everything that follows.

In this chapter, we'll create a robust data layer that can handle thousands of tweets, Telegram messages, and RSS articles while maintaining lightning-fast query performance. We'll also build a professional logging system that will be your best friend when debugging issues at 2 AM.

## 🗄️ Setting Up Supabase: Your PostgreSQL Powerhouse

### Why Supabase Over Other Solutions?

Before we dive in, let's talk about why we chose Supabase:

- **PostgreSQL under the hood**: Real SQL, not a NoSQL compromise
- **Real-time subscriptions**: Watch data change live
- **Built-in authentication**: User management without the headache
- **Edge functions**: Serverless functions that scale
- **Generous free tier**: Perfect for development and small projects

### Creating Your Supabase Project

1. **Sign up at [supabase.com](https://supabase.com)**
2. **Create a new project:**
   - Name: `cl-digest-bot`
   - Database password: Generate a strong one (save it!)
   - Region: Choose the closest to your users

3. **Grab your credentials** from the project settings:
   - Project URL
   - Anon public key
   - Service role key (keep this secret!)

4. **Update your `.env.local`:**

```env
# Add these to your existing .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 🏗️ Database Schema: Designing for Scale

Let's create our database tables. We need to store:
- **Tweets** with engagement metrics
- **Telegram messages** from various channels
- **RSS articles** with metadata
- **Generated digests** and their configurations
- **Source accounts** for each platform

Create this file to define our schema:

```sql
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
```

### 🔧 Setting Up the Database

Now let's create a script to check and initialize our database. Due to Supabase's architecture, the most reliable way to set up tables is through their SQL Editor, but we'll create a helpful script that guides you through the process:

```typescript
// scripts/db/init-db.ts
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.log('\nPlease create .env.local with:');
  console.log('NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🚀 Supabase Database Setup Tool\n');
  
  // Check which tables exist
  const expectedTables = ['sources', 'tweets', 'telegram_messages', 'rss_articles', 'digests'];
  const existingTables: string[] = [];
  const missingTables: string[] = [];

  console.log('🔍 Checking for existing tables...\n');

  for (const tableName of expectedTables) {
    try {
      console.log(`Checking ${tableName}...`);
      const { error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);
      
      if (!error) {
        existingTables.push(tableName);
        console.log(`  ✅ ${tableName} exists`);
      } else {
        missingTables.push(tableName);
        console.log(`  ❌ ${tableName} missing`);
      }
    } catch (err) {
      missingTables.push(tableName);
      console.log(`  ❌ ${tableName} missing (connection error)`);
    }
  }

  console.log('\n📊 Database Status:');
  console.log(`  ✅ Existing tables: ${existingTables.length}/${expectedTables.length}`);
  console.log(`  ❌ Missing tables: ${missingTables.length}`);

  if (missingTables.length === 0) {
    console.log('\n🎉 All tables exist! Your database is ready.');
    
    // Quick test
    try {
      const { data, error } = await supabase
        .from('sources')
        .select('count');
      
      if (!error) {
        console.log('✅ Database operations are working correctly');
      }
    } catch (err) {
      console.log('⚠️  Tables exist but there might be permission issues');
    }
    
    return;
  }

  // Show setup instructions
  console.log('\n🔧 Setup Required!');
  console.log('\nTo create the missing tables:');
  console.log('\n📝 Method 1 - Supabase Dashboard (Recommended):');
  console.log('  1. Go to https://supabase.com/dashboard');
  console.log('  2. Select your project');
  console.log('  3. Click "SQL Editor" in the left sidebar');
  console.log('  4. Copy the SQL below and paste it');
  console.log('  5. Click "Run"');
  
  console.log('\n📄 SQL to copy and paste:');
  console.log('=' + '='.repeat(80));
  
  try {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    console.log(schema);
  } catch (err) {
    console.log('❌ Could not read schema.sql file');
    console.log('Make sure scripts/db/schema.sql exists');
  }
  
  console.log('=' + '='.repeat(80));
  
  console.log('\n✅ After running the SQL, run this script again to verify!');
}

main().catch((error) => {
  console.error('\n❌ Script failed:', error.message);
  console.log('\nTroubleshooting:');
  console.log('1. Check your .env.local file has valid Supabase credentials');
  console.log('2. Verify your Supabase project is active');
  console.log('3. Make sure your service role key is correct');
  process.exit(1);
});
```

### 🚀 Database Setup Process

**Step 1: Run the setup script to check your database:**

```bash
npm run script scripts/db/init-db.ts
```

**Step 2: If tables are missing, use the Supabase SQL Editor:**

1. **Go to your Supabase dashboard** at [supabase.com/dashboard](https://supabase.com/dashboard)
2. **Select your project**
3. **Click "SQL Editor"** in the left sidebar
4. **Copy the SQL output** from the script above
5. **Paste it in the SQL Editor** and click "Run"

**Step 3: Verify the setup:**

```bash
npm run script scripts/db/init-db.ts
```

You should see: `🎉 All tables exist! Your database is ready.`

### 💡 Why This Approach?

**Supabase's architecture** makes direct SQL execution through their JavaScript client challenging for schema creation. The most reliable approach is:

- ✅ **SQL Editor**: Direct database access with full permissions
- ✅ **Verification Script**: Ensures everything is set up correctly  
- ✅ **Error-free**: No complex connection handling or permission issues
- ✅ **Reproducible**: Easy to re-run and verify

## 📝 TypeScript Types: Type Safety for Your Data

Now let's create TypeScript interfaces that match our database schema. This gives us compile-time safety and excellent IDE support:

```typescript
// types/database.ts

export interface Database {
  public: {
    Tables: {
      sources: {
        Row: Source;
        Insert: Omit<Source, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Source>;
      };
      tweets: {
        Row: Tweet;
        Insert: Omit<Tweet, 'processed_at'> & {
          processed_at?: string;
        };
        Update: Partial<Tweet>;
      };
      telegram_messages: {
        Row: TelegramMessage;
        Insert: Omit<TelegramMessage, 'id' | 'fetched_at'> & {
          id?: string;
          fetched_at?: string;
        };
        Update: Partial<TelegramMessage>;
      };
      rss_articles: {
        Row: RSSArticle;
        Insert: Omit<RSSArticle, 'id' | 'fetched_at'> & {
          id?: string;
          fetched_at?: string;
        };
        Update: Partial<RSSArticle>;
      };
      digests: {
        Row: Digest;
        Insert: Omit<Digest, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Digest>;
      };
    };
  };
}

// Individual table types
export interface Source {
  id: string;
  name: string;
  type: 'twitter' | 'telegram' | 'rss';
  url?: string;
  username?: string;
  is_active: boolean;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Tweet {
  id: string; // Twitter's tweet ID
  text: string;
  author_id: string;
  author_username: string;
  author_name?: string;
  created_at: string;
  
  // Engagement metrics
  retweet_count: number;
  like_count: number;
  reply_count: number;
  quote_count: number;
  
  // Computed fields
  engagement_score: number;
  quality_score: number;
  
  // Metadata
  source_url?: string;
  raw_data?: Record<string, any>;
  processed_at: string;
}

export interface TelegramMessage {
  id: string;
  message_id: string;
  channel_username: string;
  channel_title?: string;
  text: string;
  author?: string;
  message_date: string;
  
  // Engagement
  views: number;
  forwards: number;
  replies: number;
  
  // Processing
  quality_score: number;
  source_url?: string;
  raw_data?: Record<string, any>;
  fetched_at: string;
}

export interface RSSArticle {
  id: string;
  title: string;
  link: string;
  description?: string;
  content?: string;
  author?: string;
  published_at?: string;
  
  // Source
  feed_url: string;
  feed_title?: string;
  
  // Processing
  quality_score: number;
  word_count: number;
  raw_data?: Record<string, any>;
  fetched_at: string;
}

export interface Digest {
  id: string;
  title: string;
  summary: string;
  content: DigestContent;
  
  // AI metadata
  ai_model?: string;
  ai_provider?: string;
  token_usage?: TokenUsage;
  
  // Data scope
  data_from: string;
  data_to: string;
  
  // Publishing
  published_to_slack: boolean;
  slack_message_ts?: string;
  
  created_at: string;
  updated_at: string;
}

// Supporting types
export interface DigestContent {
  sections: DigestSection[];
  tweets: TweetDigestItem[];
  articles: ArticleDigestItem[];
  telegram_messages?: TelegramDigestItem[];
  metadata: {
    total_sources: number;
    processing_time_ms: number;
    model_config: any;
  };
}

export interface DigestSection {
  title: string;
  summary: string;
  key_points: string[];
  source_count: number;
}

export interface TweetDigestItem {
  id: string;
  text: string;
  author: string;
  url: string;
  engagement: {
    likes: number;
    retweets: number;
    replies: number;
  };
  relevance_score: number;
}

export interface ArticleDigestItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  published_at: string;
  relevance_score: number;
}

export interface TelegramDigestItem {
  text: string;
  channel: string;
  author?: string;
  url: string;
  date: string;
  relevance_score: number;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reasoning_tokens?: number;
}
```

## 🔌 Supabase Client Setup

Let's create our database client with proper configuration:

```typescript
// lib/supabase/supabase-client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create the client with proper typing
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false, // We're not using auth for now
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Client-Info': 'cl-digest-bot',
      },
    },
  }
);

// Utility function to check connection
export async function testConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('sources')
      .select('count')
      .limit(1);
    
    return !error;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
```

## 📊 Professional Logging: Your Debugging Superpower

Now let's create a robust logging system using Winston. This will be invaluable for monitoring our system in production:

```typescript
// lib/logger/index.ts
import winston from 'winston';
import { join } from 'path';

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow', 
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston about our colors
winston.addColors(logColors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Format for file output (JSON for easier parsing)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels: logLevels,
  format: fileFormat,
  defaultMeta: { service: 'cl-digest-bot' },
  transports: [
    // Write all logs with importance level of 'error' or less to error.log
    new winston.transports.File({
      filename: join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: join(process.cwd(), 'logs', 'combined.log'),
    }),
  ],
});

// Add console output for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync(join(process.cwd(), 'logs'), { recursive: true });
} catch (error) {
  // Directory already exists, ignore
}

export default logger;

// Helper functions for common log patterns
export const logError = (message: string, error?: any, metadata?: any) => {
  logger.error(message, { error: error?.message || error, stack: error?.stack, ...metadata });
};

export const logInfo = (message: string, metadata?: any) => {
  logger.info(message, metadata);
};

export const logDebug = (message: string, metadata?: any) => {
  logger.debug(message, metadata);
};

export const logWarning = (message: string, metadata?: any) => {
  logger.warn(message, metadata);
};
```

## 📈 Progress Tracking: Visual Feedback for Long Operations

Let's create a progress tracking system that integrates with our logging:

```typescript
// utils/progress.ts
import cliProgress from 'cli-progress';
import logger from '../lib/logger';

export interface ProgressConfig {
  total: number;
  label: string;
  showPercentage?: boolean;
  showETA?: boolean;
}

export class ProgressTracker {
  private bar: cliProgress.SingleBar | null = null;
  private startTime: number = 0;
  private label: string = '';

  constructor(config: ProgressConfig) {
    this.label = config.label;
    this.startTime = Date.now();

    // Create progress bar with custom format
    this.bar = new cliProgress.SingleBar({
      format: `${config.label} [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}`,
      hideCursor: true,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      clearOnComplete: false,
      stopOnComplete: true,
    }, cliProgress.Presets.shades_classic);

    this.bar.start(config.total, 0);
    logger.info(`Started: ${config.label}`, { total: config.total });
  }

  update(current: number, data?: any): void {
    if (this.bar) {
      this.bar.update(current, data);
    }
  }

  increment(data?: any): void {
    if (this.bar) {
      this.bar.increment(data);
    }
  }

  complete(message?: string): void {
    if (this.bar) {
      this.bar.stop();
    }

    const duration = Date.now() - this.startTime;
    const completionMessage = message || `Completed: ${this.label}`;
    
    logger.info(completionMessage, { 
      duration_ms: duration,
      duration_formatted: `${(duration / 1000).toFixed(2)}s`
    });

    console.log(`✅ ${completionMessage} (${(duration / 1000).toFixed(2)}s)`);
  }

  fail(error: string): void {
    if (this.bar) {
      this.bar.stop();
    }

    const duration = Date.now() - this.startTime;
    logger.error(`Failed: ${this.label}`, { error, duration_ms: duration });
    console.log(`❌ Failed: ${this.label} - ${error}`);
  }
}

// Progress manager for multiple concurrent operations
export class ProgressManager {
  private trackers: Map<string, ProgressTracker> = new Map();

  create(id: string, config: ProgressConfig): ProgressTracker {
    const tracker = new ProgressTracker(config);
    this.trackers.set(id, tracker);
    return tracker;
  }

  get(id: string): ProgressTracker | undefined {
    return this.trackers.get(id);
  }

  complete(id: string, message?: string): void {
    const tracker = this.trackers.get(id);
    if (tracker) {
      tracker.complete(message);
      this.trackers.delete(id);
    }
  }

  fail(id: string, error: string): void {
    const tracker = this.trackers.get(id);
    if (tracker) {
      tracker.fail(error);
      this.trackers.delete(id);
    }
  }

  cleanup(): void {
    this.trackers.clear();
  }
}

// Global progress manager instance
export const progressManager = new ProgressManager();
```

## 🧪 Testing Your Database Setup

Let's create a comprehensive test to verify everything is working:

```typescript
// scripts/db/test-connection.ts
import { config } from 'dotenv';
import { supabase, testConnection } from '../../lib/supabase/supabase-client';
import logger, { logInfo, logError } from '../../lib/logger';
import { ProgressTracker } from '../../utils/progress';

// Load environment variables
config({ path: '.env.local' });

async function testDatabaseSetup() {
  const progress = new ProgressTracker({
    total: 6,
    label: 'Testing Database Setup'
  });

  try {
    // Test 1: Connection
    progress.update(1, { test: 'Connection' });
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }
    logInfo('✅ Database connection successful');

    // Test 2: Tables exist
    progress.update(2, { test: 'Tables' });
    const expectedTables = ['sources', 'tweets', 'telegram_messages', 'rss_articles', 'digests'];
    const foundTables: string[] = [];
    
    for (const tableName of expectedTables) {
      const { error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);
      
      if (!error) {
        foundTables.push(tableName);
      }
    }
    
    if (expectedTables.every(table => foundTables.includes(table))) {
      logInfo('✅ All required tables exist', { tables: foundTables });
    } else {
      throw new Error(`Missing tables: ${expectedTables.filter(t => !foundTables.includes(t))}`);
    }

    // Test 3: Insert test data
    progress.update(3, { test: 'Insert' });
    const { data: sourceData, error: insertError } = await supabase
      .from('sources')
      .insert({
        name: 'test_source',
        type: 'twitter',
        username: 'test_user',
        config: { test: true }
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Insert failed: ${insertError.message}`);
    }
    logInfo('✅ Test insert successful', { id: sourceData.id });

    // Test 4: Query test data
    progress.update(4, { test: 'Query' });
    const { data: queryData, error: queryError } = await supabase
      .from('sources')
      .select('*')
      .eq('name', 'test_source')
      .single();

    if (queryError || !queryData) {
      throw new Error(`Query failed: ${queryError?.message}`);
    }
    logInfo('✅ Test query successful', { name: queryData.name });

    // Test 5: Update test data
    progress.update(5, { test: 'Update' });
    const { error: updateError } = await supabase
      .from('sources')
      .update({ is_active: false })
      .eq('id', sourceData.id);

    if (updateError) {
      throw new Error(`Update failed: ${updateError.message}`);
    }
    logInfo('✅ Test update successful');

    // Test 6: Clean up
    progress.update(6, { test: 'Cleanup' });
    const { error: deleteError } = await supabase
      .from('sources')
      .delete()
      .eq('id', sourceData.id);

    if (deleteError) {
      throw new Error(`Cleanup failed: ${deleteError.message}`);
    }
    logInfo('✅ Test cleanup successful');

    progress.complete('Database setup test completed successfully!');

  } catch (error) {
    logError('Database test failed', error);
    progress.fail(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the test
testDatabaseSetup();
```

Run the database test:

```bash
npm run test:db
```

## 🎯 What We've Accomplished

Incredible work! You've just built the data foundation for a production-ready system:

✅ **Supabase database** with optimized schema design  
✅ **Type-safe database interfaces** with full TypeScript support  
✅ **Professional logging system** with multiple transports  
✅ **Progress tracking** for long-running operations  
✅ **Comprehensive testing** to verify everything works  

### 🔍 Pro Tips & Common Pitfalls

**💡 Pro Tip:** Always use database indexes on columns you'll query frequently. We've added indexes for `created_at`, `author_username`, and `engagement_score`.

**⚠️ Common Pitfall:** Don't store your service role key in client-side code! It has admin privileges. Use the anon key for frontend operations.

**🔧 Performance Tip:** PostgreSQL's JSONB type is incredibly powerful for storing metadata while maintaining query performance.

---

### 📋 Complete Code Summary - Chapter 2

Here are all the files you should have created:

**Database Schema:**
```bash
# Created: scripts/db/schema.sql (database tables and indexes)
# Created: scripts/db/init-db.ts (database initialization script)
```

**TypeScript Types:** 
```bash
# Created: types/database.ts (complete type definitions)
```

**Core Infrastructure:**
```bash
# Created: lib/supabase/supabase-client.ts (database client)
# Created: lib/logger/index.ts (Winston logging setup)
# Created: utils/progress.ts (progress tracking utilities)
```

**Testing:**
```bash
# Created: scripts/db/test-connection.ts (comprehensive database test)
```

**Package.json scripts to add:**
```json
{
  "scripts": {
    "test:db": "npm run script scripts/db/test-connection.ts",
    "init:db": "npm run script scripts/db/init-db.ts"
  }
}
```

**Your database is now ready to handle:**
- 📊 Thousands of tweets with engagement metrics
- 💬 Telegram messages from multiple channels  
- 📰 RSS articles with content analysis
- 🤖 AI-generated digests with metadata
- 📈 Performance monitoring through logs

**Next up:** In Chapter 3, we'll create the centralized configuration system that makes managing multiple data sources effortless. We'll build type-safe configs that let you fine-tune everything from API rate limits to content quality thresholds—all from one place!

---

*Ready to continue? The next chapter will show you how to build configuration that scales as your system grows. No more hunting through code to change settings! 🚀*