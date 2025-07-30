// lib/digest/digest-storage.ts

import { createClient } from '@supabase/supabase-js';
import { envConfig } from '../../config/environment';
import logger from '../logger';

export interface DigestData {
  title: string;
  summary: string;
  content: any;
  ai_model: string;
  ai_provider: string;
  token_usage: any;
  data_from: string;
  data_to: string;
  published_to_slack: boolean;
  created_at: string;
  updated_at: string;
}

export class DigestStorage {
  private supabase = createClient(envConfig.supabaseUrl, envConfig.supabaseServiceKey);

  /**
   * Store a new digest in the database
   */
  async storeDigest(digestData: DigestData): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('digests')
        .insert({
          ...digestData,
          id: this.generateDigestId()
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      logger.info('Digest stored successfully', { digest_id: data.id });
      return data.id;

    } catch (error) {
      logger.error('Failed to store digest', error);
      throw error;
    }
  }

  /**
   * Update an existing digest
   */
  async updateDigest(digestId: string, updates: Partial<DigestData>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('digests')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', digestId);

      if (error) {
        throw error;
      }

      logger.info('Digest updated successfully', { digest_id: digestId });

    } catch (error) {
      logger.error('Failed to update digest', error);
      throw error;
    }
  }

  /**
   * Get recent digests
   */
  async getRecentDigests(limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('digests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data || [];

    } catch (error) {
      logger.error('Failed to get recent digests', error);
      throw error;
    }
  }

  /**
   * Get digest by ID
   */
  async getDigest(digestId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('digests')
        .select('*')
        .eq('id', digestId)
        .single();

      if (error) {
        throw error;
      }

      return data;

    } catch (error) {
      logger.error('Failed to get digest', error);
      throw error;
    }
  }

  private generateDigestId(): string {
    return `digest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}