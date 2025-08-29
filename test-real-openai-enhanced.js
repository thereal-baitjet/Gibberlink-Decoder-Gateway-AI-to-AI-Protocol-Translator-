#!/usr/bin/env node

/**
 * Real OpenAI Enhanced Translation Test
 * Demonstrates the full power of AI-enhanced translations
 */

// Load environment variables
require('dotenv').config();

const { Englishizer } = require('./packages/englishizer/dist/index.js');

async function testRealOpenAIEnhanced() {
  console.log('🤖 Real OpenAI Enhanced Translation Test...');
  console.log('===========================================\n');

  // Initialize Englishizer with OpenAI
  const openaiConfig = {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3')
  };
  
  const englishizer = new Englishizer({}, undefined, openaiConfig);
  
  const testCases = [
    {
      name: '🌡️ Temperature Sensor (Server Room)',
      payload: {
        op: 'sensor_read',
        sensor: 'temperature',
        value: 23.5,
        unit: 'celsius',
        location: 'server_room_1',
        timestamp: new Date().toISOString()
      }
    },
    {
      name: '🔋 Battery Status (Critical)',
      payload: {
        op: 'status_check',
        component: 'battery',
        level: 15,
        charging: false,
        voltage: 11.2,
        critical: true
      }
    },
    {
      name: '🧠 Complex AI Compute Request',
      payload: {
        op: 'compute_request',
        task: 'image_processing',
        parameters: {
          algorithm: 'convolutional_neural_network',
          model: 'resnet50',
          input_size: [224, 224, 3],
          batch_size: 32,
          learning_rate: 0.001
        },
        priority: 'high',
        timeout: 30000,
        metadata: {
          source: 'edge_device_001',
          user_id: 'user_12345'
        }
      }
    },
    {
      name: '🎵 Audio Processing Error',
      payload: {
        error: 'AUDIO_ERROR',
        message: 'Signal quality below threshold',
        code: 400,
        details: {
          snr: 8.5,
          threshold: 12.0,
          frequency: 2400,
          sample_rate: 44100
        }
      }
    },
    {
      name: '🤝 Handshake Protocol',
      payload: {
        op: 'handshake',
        version: '1.0.0',
        capabilities: ['audio', 'video', 'data'],
        session_id: 'session_abc123',
        timestamp: new Date().toISOString()
      }
    }
  ];

  console.log('🚀 Testing Enhanced Translations with OpenAI...\n');

  for (const testCase of testCases) {
    console.log(`📋 ${testCase.name}`);
    console.log('─'.repeat(50));
    
    const testEvent = {
      payload: testCase.payload,
      meta: {
        msgId: `test_${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    };

    try {
      const result = await englishizer.toPlainEnglish(testEvent);
      
      console.log('🇬🇧 Enhanced Translation:');
      console.log(`"${result.text}"`);
      console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`Detected Kind: ${testEvent.kind || 'unknown'}`);
      
      if (result.sourceMapping?.openaiEnhanced) {
        console.log('\n🤖 OpenAI Enhancement Details:');
        console.log(`Reasoning: ${result.sourceMapping.openaiReasoning}`);
        
        if (result.sourceMapping.openaiSuggestions?.length > 0) {
          console.log('💡 Suggestions:');
          result.sourceMapping.openaiSuggestions.forEach((suggestion, i) => {
            console.log(`   ${i + 1}. ${suggestion}`);
          });
        }
        
        if (result.sourceMapping.openaiContextInsights?.length > 0) {
          console.log('🔍 Context Insights:');
          result.sourceMapping.openaiContextInsights.forEach((insight, i) => {
            console.log(`   ${i + 1}. ${insight}`);
          });
        }
      }
      
      if (result.glossary && Object.keys(result.glossary).length > 0) {
        console.log('\n📚 Glossary Terms:');
        Object.entries(result.glossary).forEach(([term, definition]) => {
          console.log(`   ${term}: ${definition}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Translation failed:', error.message);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  }

  console.log('🎉 Real OpenAI Enhanced Translation Test Completed!');
  console.log('\n💡 Key Benefits of OpenAI Enhancement:');
  console.log('   • More natural and context-aware language');
  console.log('   • Better technical explanations');
  console.log('   • Adaptive complexity based on message type');
  console.log('   • Improved confidence scoring');
  console.log('   • Context insights and suggestions');
}

testRealOpenAIEnhanced().catch(console.error);
