#!/usr/bin/env node

/**
 * Test OpenAI Integration with Englishizer
 * Demonstrates enhanced translations with AI assistance
 */

// Load environment variables
require('dotenv').config();

const WebSocket = require('ws');

async function testOpenAIIntegration() {
  console.log('🤖 Testing OpenAI-Enhanced Englishizer Integration...');
  console.log('==================================================\n');

  // Test 1: Without OpenAI API Key (fallback to templates)
  console.log('📋 Test 1: Template-based Translation (No OpenAI)');
  console.log('------------------------------------------------');
  
  const sessionId = `test_${Date.now()}`;
  const ws = new WebSocket('ws://localhost:8080/v1/messages');
  
  await new Promise((resolve) => {
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Send handshake
      ws.send(JSON.stringify({
        type: 'handshake',
        sessionId,
        timestamp: new Date().toISOString()
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'handshake.ack') {
        console.log('✅ Session established:', message.sessionId);
        
        // Test enhanced sensor message
        const testPayload = {
          op: 'sensor_read',
          sensor: 'temperature',
          value: 23.5,
          unit: 'celsius',
          location: 'server_room_1',
          timestamp: new Date().toISOString()
        };
        
        console.log('📤 Sending enhanced sensor message...');
        ws.send(JSON.stringify({
          type: 'audio.frame',
          msgId: `msg_${Date.now()}`,
          payload: testPayload,
          timestamp: new Date().toISOString()
        }));
      } else if (message.type === 'recv.plain') {
        console.log('🇬🇧 Enhanced Translation:');
        console.log('Text:', message.text);
        console.log('Confidence:', message.confidence);
        console.log('SNR:', message.snrDb, 'dB');
        console.log('Timestamp:', message.timestamp);
        console.log('');
        
        // Test 2: With OpenAI API Key (if available)
        if (process.env.OPENAI_API_KEY) {
          console.log('🤖 Test 2: OpenAI-Enhanced Translation');
          console.log('--------------------------------------');
          
          const complexPayload = {
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
              user_id: 'user_12345',
              session_id: sessionId
            }
          };
          
          console.log('📤 Sending complex compute request...');
          ws.send(JSON.stringify({
            type: 'audio.frame',
            msgId: `msg_${Date.now()}_complex`,
            payload: complexPayload,
            timestamp: new Date().toISOString()
          }));
        } else {
          console.log('🔑 No OPENAI_API_KEY found - skipping AI enhancement test');
          console.log('💡 Set OPENAI_API_KEY environment variable to test AI enhancement');
          ws.close();
        }
      } else if (message.type === 'recv.plain' && message.msgId?.includes('complex')) {
        console.log('🤖 OpenAI-Enhanced Translation:');
        console.log('Text:', message.text);
        console.log('Confidence:', message.confidence);
        console.log('SNR:', message.snrDb, 'dB');
        console.log('Timestamp:', message.timestamp);
        
        // Check for OpenAI-specific metadata
        if (message.sourceMapping?.openaiEnhanced) {
          console.log('🤖 OpenAI Enhancement Details:');
          console.log('Reasoning:', message.sourceMapping.openaiReasoning);
          if (message.sourceMapping.openaiSuggestions?.length > 0) {
            console.log('Suggestions:', message.sourceMapping.openaiSuggestions);
          }
          if (message.sourceMapping.openaiContextInsights?.length > 0) {
            console.log('Context Insights:', message.sourceMapping.openaiContextInsights);
          }
        }
        
        console.log('\n🎉 OpenAI integration test completed!');
        ws.close();
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
      resolve();
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      resolve();
    });
  });
}

// Run the test
testOpenAIIntegration().catch(console.error);
