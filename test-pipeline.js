#!/usr/bin/env node

// Quick test to verify the deployed firecrawl-extract function with UI improvements
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uaqcehoocecvihubnbhp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhcWNlaG9vY2VjdmlodWJuYmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3MjA1OTMsImV4cCI6MjA2NjI5NjU5M30.kMkQqOqYAM4lopFBl7wVpff2F_tIzI24eGSHZ1eU3z4';

console.log('🧪 Testing deployed firecrawl-extract function with customer reviews cleanup...');

async function testExtract() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Test a product page that might have customer reviews pollution
  const testUrl = 'https://quattronutrition.com/products/whey';
  
  console.log(`📋 Testing URL: ${testUrl}`);
  
  try {
    const { data, error } = await supabase.functions.invoke('firecrawl-extract', {
      body: { url: testUrl }
    });
    
    if (error) {
      console.error('❌ Extract function error:', error);
      return;
    }
    
    if (!data) {
      console.error('❌ No data returned from extract function');
      return;
    }
    
    console.log('✅ Extract function response:');
    console.log(`   Title: ${data.title || 'N/A'}`);
    console.log(`   Ingredients: ${data.ingredients?.length || 0} items`);
    console.log(`   Facts length: ${data.supplementFacts?.raw?.length || 0} chars`);
    console.log(`   Facts source: ${data._meta?.factsSource || 'N/A'}`);
    console.log(`   Facts tokens: ${data._meta?.factsTokens || 0}`);
    
    // Check if customer reviews were cleaned up
    const hasReviewsInTitle = /customer reviews/i.test(data.title || '');
    const hasReviewsInFacts = /customer reviews/i.test(data.supplementFacts?.raw || '');
    
    console.log(`   Reviews in title: ${hasReviewsInTitle ? '❌ FOUND' : '✅ CLEAN'}`);
    console.log(`   Reviews in facts: ${hasReviewsInFacts ? '❌ FOUND' : '✅ CLEAN'}`);
    
    // Test the score function too
    console.log('\n🧪 Testing score function with extracted data...');
    
    const { data: scoreData, error: scoreError } = await supabase.functions.invoke('score-supplement', {
      body: {
        title: data.title,
        ingredients: data.ingredients,
        supplementFacts: data.supplementFacts?.raw,
        warnings: data.warnings
      }
    });
    
    if (scoreError) {
      console.error('❌ Score function error:', scoreError);
      return;
    }
    
    if (!scoreData) {
      console.error('❌ No data returned from score function');
      return;
    }
    
    console.log('✅ Score function response:');
    console.log(`   Score: ${scoreData.score || 'N/A'}`);
    console.log(`   Highlights: ${scoreData.highlights?.length || 0} items`);
    console.log(`   Concerns: ${scoreData.concerns?.length || 0} items`);
    
    console.log('\n🎉 Pipeline test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testExtract();