# Build an AI-Powered Digest Bot: A Step-by-Step Tutorial

Learn to build a production-ready AI digest bot from scratch in this comprehensive tutorial series. We'll create a system that aggregates content from Twitter/X, Telegram, and RSS feeds, then uses AI to generate intelligent summaries and insights.

## What You'll Build

By the end of this tutorial, you'll have created:

- **Multi-source content aggregation** - Collect data from social media, messaging platforms, and RSS feeds
- **AI-powered summarization** - Generate concise, actionable insights using multiple AI providers (OpenAI, Anthropic, Gemini, Ollama)
- **Flexible output formats** - Support for Slack, Discord, email, and more
- **Production deployment** - Deploy your bot with proper error handling, logging, and monitoring

## Tutorial Structure

This tutorial is organized into chapters, each building upon the previous:

1. **Chapter 1**: Introduction and setup
2. **Chapter 2**: Database and core structure
3. **Chapter 3**: Configuration system
4. **Chapter 4**: Twitter data collection
5. **Chapter 5**: Telegram mining
6. **Chapter 6**: RSS feed processing
7. **Chapter 7**: AI integration
8. **Chapter 8**: Advanced AI techniques
9a. **Chapter 9a**: Automation foundation
9b. **Chapter 9b**: Monitoring and config
9c. **Chapter 9c**: Testing and optimization
10. **Chapter 10**: Social media distribution
11. **Chapter 11**: Automation and deployment
12a. **Chapter 12a**: Natural language intent recognition
12b. **Chapter 12b**: Configuration management agent
12c. **Chapter 12c**: Turning your Bot into an Agent 

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- API keys for your chosen services (Twitter, Telegram, AI providers)
- Basic knowledge of TypeScript/JavaScript

### Quick Start

1. Clone this repository:
```bash
git clone <repository-url>
cd cl-digest-bot-oss
```

2. Start from the beginning:
```bash
git checkout chpt_1
```

3. Install dependencies:
```bash
npm install
```

4. Copy the environment template:
```bash
cp .example.env .env
```

5. Follow along with the [detailed tutorial series](https://www.news.computelabs.ai/)

### Running the Current Version

To see the completed bot in action:

```bash
git checkout chpt_12
npm install
# Fill out your API keys in .env
npm run dev
```

## About Compute Labs

This tutorial is brought to you by [Compute Labs](https://www.computelabs.ai/en), where we're democratizing access to AI infrastructure and building the financial ecosystem for compute as an emerging asset class.

Through our Compute Tokenization Protocol (CTP), we're transforming physical GPUs into digital assets, enabling fractional ownership and optimizing resource allocation across the AI ecosystem.