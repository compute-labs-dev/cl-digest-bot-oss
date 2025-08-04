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