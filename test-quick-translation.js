#!/usr/bin/env node

/**
 * Quick Translation Test
 * Sends a test message and verifies translation is returned
 */

const WebSocket = require('ws');

async function establishSession() {
  try {
    const response = await fetch('http://localhost:8080/v1/handshake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'devkey'
      },
      body: JSON.stringify({
        clientFeatures: {
          compression: 'zstd',
          fec: true,
          maxMtu: 16384
        },
        peerAddress: {
          protocol: 'ws',
          host: 'localhost',
          port: 8080
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.sessionId;
    } else {
      throw new Error('Failed to establish session');
    }
  } catch (error) {
    console.error('Session establishment failed:', error);
    return null;
  }
}

async function testQuickTranslation() {
  console.log('⚡ Quick Translation Test...');
  console.log('===========================\n');

  const sessionId = await establishSession();
  if (!sessionId) {
    console.error('❌ Failed to establish session');
    return;
  }

  const ws = new WebSocket(`ws://localhost:8080/v1/messages?sessionId=${sessionId}`);
  
  await new Promise((resolve) => {
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Send handshake
      ws.send(JSON.stringify({
        type: 'handshake',
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'handshake.ack') {
        console.log('✅ Handshake acknowledged');
        
        // Send test message immediately
        const testMessage = {
          type: 'audio.frame',
          msgId: `quick_test_${Date.now()}`,
          payload: {
            op: 'sensor_read',
            sensor: 'temperature',
            value: 23.5,
            unit: 'celsius',
            location: 'test_room'
          },
          timestamp: new Date().toISOString()
        };
        
        console.log('📤 Sending test message...');
        ws.send(JSON.stringify(testMessage));
        
      } else if (message.type === 'recv.plain') {
        console.log('\n🎉 Translation received!');
        console.log('Text:', message.text);
        console.log('Confidence:', message.confidence);
        console.log('SNR:', message.snrDb, 'dB');
        
        console.log('\n✅ Translation pipeline is working!');
        ws.close();
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket closed');
      resolve();
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      resolve();
    });
  });
}

testQuickTranslation().catch(console.error);
