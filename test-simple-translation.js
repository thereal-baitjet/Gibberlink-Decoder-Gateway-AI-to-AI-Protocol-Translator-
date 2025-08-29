#!/usr/bin/env node

/**
 * Simple Translation Test
 * Tests the basic translation pipeline with simulated audio frames
 */

const WebSocket = require('ws');

async function testSimpleTranslation() {
  console.log('🧪 Testing Simple Translation Pipeline...');
  console.log('=========================================\n');

  const ws = new WebSocket('ws://localhost:8080/v1/messages');
  
  await new Promise((resolve) => {
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Send handshake
      ws.send(JSON.stringify({
        type: 'handshake',
        sessionId: `test_${Date.now()}`,
        timestamp: new Date().toISOString()
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('📨 Received:', message.type);
      
      if (message.type === 'handshake.ack') {
        console.log('✅ Session established:', message.sessionId);
        
        // Send a simple audio frame for translation
        const testFrame = {
          type: 'audio.frame',
          msgId: `test_${Date.now()}`,
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
        
      } else if (message.type === 'recv.plain') {
        console.log('\n🎉 Translation received!');
        console.log('Text:', message.text);
        console.log('Confidence:', message.confidence);
        console.log('SNR:', message.snrDb, 'dB');
        console.log('Timestamp:', message.timestamp);
        
        console.log('\n✅ Translation pipeline is working correctly!');
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

testSimpleTranslation().catch(console.error);
