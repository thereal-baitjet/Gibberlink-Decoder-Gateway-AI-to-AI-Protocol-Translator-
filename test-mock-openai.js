#!/usr/bin/env node

/**
 * Mock OpenAI Integration Test
 * Demonstrates the enhanced translation capabilities
 */

// Load environment variables
require('dotenv').config();

const { Englishizer } = require('./packages/englishizer/dist/index.js');

async function testMockOpenAI() {
  console.log('🤖 Mock OpenAI Integration Test...');
  console.log('==================================\n');

  // Test with mock OpenAI config
  console.log('🤖 Test: OpenAI-Enhanced Translation (Mock)');
  const openaiConfig = {
    apiKey: 'mock-api-key-for-demo',
    model: 'gpt-4o-mini',
    maxTokens: 500,
    temperature: 0.3
  };
  
  const englishizer = new Englishizer({}, undefined, openaiConfig);
  
  const testCases = [
    {
      name: 'Temperature Sensor',
      payload: {
        op: 'sensor_read',
        sensor: 'temperature',
        value: 23.5,
        unit: 'celsius',
        location: 'server_room_1'
      }
    },
    {
      name: 'Battery Status',
      payload: {
        op: 'status_check',
        component: 'battery',
        level: 75,
        charging: true,
        voltage: 12.6
      }
    },
    {
      name: 'Complex Compute Request',
      payload: {
        op: 'compute_request',
        task: 'image_processing',
        parameters: {
          algorithm: 'convolutional_neural_network',
          model: 'resnet50',
          input_size: [224, 224, 3],
          batch_size: 32
        },
        priority: 'high',
        timeout: 30000
      }
    },
    {
      name: 'Audio Error',
      payload: {
        error: 'AUDIO_ERROR',
        message: 'Signal quality below threshold',
        code: 400,
        details: {
          snr: 8.5,
          threshold: 12.0
        }
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log('Payload:', JSON.stringify(testCase.payload, null, 2));
    
    const testEvent = {
      payload: testCase.payload,
      meta: {
        msgId: `test_${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    };

    try {
      const result = await englishizer.toPlainEnglish(testEvent);
      console.log('✅ Translation:');
      console.log('Text:', result.text);
      console.log('Confidence:', result.confidence);
      console.log('Kind:', testEvent.kind);
      
      if (result.sourceMapping?.openaiEnhanced) {
        console.log('🤖 OpenAI Enhancement Active');
        console.log('Reasoning:', result.sourceMapping.openaiReasoning);
        if (result.sourceMapping.openaiSuggestions?.length > 0) {
          console.log('Suggestions:', result.sourceMapping.openaiSuggestions);
        }
        if (result.sourceMapping.openaiContextInsights?.length > 0) {
          console.log('Context Insights:', result.sourceMapping.openaiContextInsights);
        }
      } else {
        console.log('📝 Using template-based translation (OpenAI not available)');
      }
    } catch (error) {
      console.error('❌ Translation failed:', error.message);
    }
  }

  console.log('\n🎉 Mock OpenAI test completed!');
  console.log('\n💡 To test with real OpenAI:');
  console.log('1. Get an API key from https://platform.openai.com/');
  console.log('2. Set environment variable: export OPENAI_API_KEY="your-key-here"');
  console.log('3. Run: node test-simple-openai.js');
}

testMockOpenAI().catch(console.error);
