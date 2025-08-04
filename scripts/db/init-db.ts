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
