// scripts/test/test-setup.ts
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

console.log('🚀 Testing CL Digest Bot Setup...\n');

// Test environment variables
const requiredEnvVars = [
  'OPENAI_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL'
];

let allGood = true;

for (const envVar of requiredEnvVars) {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}: Configured`);
  } else {
    console.log(`❌ ${envVar}: Missing`);
    allGood = false;
  }
}

// Test TypeScript compilation
try {
  const testData: { message: string; success: boolean } = {
    message: "TypeScript is working!",
    success: true
  };
  console.log(`✅ TypeScript: ${testData.message}`);
} catch (error) {
  console.log(`❌ TypeScript: Error`);
  allGood = false;
}

console.log('\n' + (allGood ? '🎉 Setup complete! Ready to build.' : '🔧 Please fix the issues above.'));