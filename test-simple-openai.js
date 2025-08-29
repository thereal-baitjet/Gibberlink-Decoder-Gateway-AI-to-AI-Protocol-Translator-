#!/usr/bin/env node

/**
 * Simple Test for OpenAI Integration
 */

// Load environment variables
require('dotenv').config();

const { Englishizer } = require('./packages/englishizer/dist/index.js');

async function testSimpleOpenAI() {
  console.log('🤖 Simple OpenAI Integration Test...');
  console.log('====================================\n');

  // Test without OpenAI (should work)
  console.log('📋 Test 1: Template-based Translation (No OpenAI)');
  const englishizer1 = new Englishizer();
  
  const testEvent = {
    payload: {
      op: 'sensor_read',
      sensor: 'temperature',
      value: 23.5,
      unit: 'celsius'
    },
    meta: {
      msgId: 'test_001',
      timestamp: new Date().toISOString()
    }
  };

  try {
    const result1 = await englishizer1.toPlainEnglish(testEvent);
    console.log('✅ Template Translation:');
    console.log('Text:', result1.text);
    console.log('Confidence:', result1.confidence);
    console.log('Kind:', testEvent.kind);
    console.log('');
  } catch (error) {
    console.error('❌ Template translation failed:', error.message);
  }

  // Test with OpenAI config (if API key available)
  if (process.env.OPENAI_API_KEY) {
    console.log('🤖 Test 2: OpenAI-Enhanced Translation');
    const openaiConfig = {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      maxTokens: 500,
      temperature: 0.3
    };
    
    const englishizer2 = new Englishizer({}, undefined, openaiConfig);
    
    try {
      const result2 = await englishizer2.toPlainEnglish(testEvent);
      console.log('✅ OpenAI-Enhanced Translation:');
      console.log('Text:', result2.text);
      console.log('Confidence:', result2.confidence);
      console.log('Kind:', testEvent.kind);
      
      if (result2.sourceMapping?.openaiEnhanced) {
        console.log('🤖 OpenAI Enhancement Active');
        console.log('Reasoning:', result2.sourceMapping.openaiReasoning);
      }
    } catch (error) {
      console.error('❌ OpenAI translation failed:', error.message);
    }
  } else {
    console.log('🔑 No OPENAI_API_KEY found - skipping AI enhancement test');
    console.log('💡 Set OPENAI_API_KEY environment variable to test AI enhancement');
  }

  console.log('\n🎉 Test completed!');
}

testSimpleOpenAI().catch(console.error);
