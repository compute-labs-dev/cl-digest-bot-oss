// lib/supabase/supabase-client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
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