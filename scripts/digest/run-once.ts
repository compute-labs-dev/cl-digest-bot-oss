// scripts/automation/run-once.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { DigestPipeline } from '../../lib/automation/digest-pipeline';
import logger from '../../lib/logger';

async function runDigest() {
  logger.info('Starting one-time digest execution');

  try {
    const pipeline = new DigestPipeline({
      enableTwitter: true,
      enableTelegram: true,
      enableRSS: true,
      aiModel: 'anthropic',
      analysisType: 'digest',
      postToSlack: false,
      minQualityThreshold: 0.7,
      maxContentAge: 24
    });

    await pipeline.execute();
    logger.info('Digest execution completed successfully');
    process.exit(0);

  } catch (error) {
    logger.error('Digest execution failed', error);
    process.exit(1);
  }
}

runDigest();