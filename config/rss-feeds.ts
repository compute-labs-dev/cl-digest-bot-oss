// config/rss-feeds.ts

export const popularFeeds = {
    // Tech & AI
    tech: [
      'https://techcrunch.com/feed/',
      'https://www.theverge.com/rss/index.xml',
      'https://arstechnica.com/feeds/rss/',
      'https://www.wired.com/feed/rss',
      'https://feeds.feedburner.com/venturebeat/SZYF', // VentureBeat AI
    ],
  
    // Finance & Crypto
    finance: [
      'https://www.coindesk.com/arc/outboundfeeds/rss/',
      'https://cointelegraph.com/rss',
      'https://www.bloomberg.com/feeds/markets.rss',
      'https://feeds.a16z.com/a16z.rss', // Andreessen Horowitz
    ],
  
    // News & Analysis
    news: [
      'https://feeds.reuters.com/reuters/technologyNews',
      'https://rss.cnn.com/rss/edition.rss',
      'https://feeds.bbci.co.uk/news/technology/rss.xml',
      'https://www.ft.com/technology?format=rss',
    ],
  
    // Research & Academic
    research: [
      'https://arxiv.org/rss/cs.AI', // AI Research
      'https://arxiv.org/rss/cs.LG', // Machine Learning
      'https://feeds.feedburner.com/oreilly/ideas', // O'Reilly Ideas
    ],
  
    // Blogs & Analysis
    blogs: [
      'https://stratechery.com/feed/',
      'https://blog.openai.com/rss/',
      'https://ai.googleblog.com/feeds/posts/default',
      'https://blog.anthropic.com/rss.xml',
    ]
  };
  
  // Feed configuration with custom settings
  export const feedConfigs = {
    'https://techcrunch.com/feed/': {
      articlesPerFeed: 10, // High volume
      extractFullContent: true
    },
    'https://arxiv.org/rss/cs.AI': {
      cacheHours: 12, // Academic content updates less frequently
      minArticleLength: 500 // Research abstracts are longer
    },
    'https://stratechery.com/feed/': {
      articlesPerFeed: 5, // Quality over quantity
      extractFullContent: true // Long-form analysis
    }
  };