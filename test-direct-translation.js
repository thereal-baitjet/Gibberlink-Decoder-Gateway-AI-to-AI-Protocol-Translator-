#!/usr/bin/env node

/**
 * Direct Translation Test
 * Tests the audio.frame message processing directly
 */

const WebSocket = require('ws');

async function testDirectTranslation() {
  console.log('🎯 Direct Translation Test...');
  console.log('============================\n');

  // Connect directly to WebSocket
  const ws = new WebSocket('ws://localhost:8080/v1/messages');
  
  await new Promise((resolve) => {
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Send a test audio frame directly
      const testFrame = {
        type: 'audio.frame',
        msgId: `direct_test_${Date.now()}`,
        payload: {
          op: 'sensor_read',
          sensor: 'temperature',
          value: 23.5,
          unit: 'celsius',
          location: 'test_room'
        },
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 Sending test frame:', testFrame);
      ws.send(JSON.stringify(testFrame));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('📨 Received:', message.type, message);
      
      if (message.type === 'recv.plain') {
        console.log('\n🎉 Translation received!');
        console.log('Text:', message.text);
        console.log('Confidence:', message.confidence);
        console.log('SNR:', message.snrDb, 'dB');
        
        console.log('\n✅ Translation pipeline is working!');
        ws.close();
      }
    });

    ws.on('close', (code, reason) => {
      console.log('🔌 WebSocket closed:', code, reason.toString());
      resolve();
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      resolve();
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      console.log('⏰ Timeout - closing connection');
      ws.close();
      resolve();
    }, 10000);
  });
}

testDirectTranslation().catch(console.error);
