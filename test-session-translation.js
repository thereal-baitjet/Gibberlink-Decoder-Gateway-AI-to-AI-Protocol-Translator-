#!/usr/bin/env node

/**
 * Session-based Translation Test
 * Properly establishes a session and tests the translation pipeline
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

async function testSessionTranslation() {
  console.log('🔐 Testing Session-based Translation...');
  console.log('=======================================\n');

  // First establish a session
  console.log('📡 Establishing session...');
  const sessionId = await establishSession();
  
  if (!sessionId) {
    console.error('❌ Failed to establish session');
    return;
  }
  
  console.log('✅ Session established:', sessionId);

  // Now connect WebSocket with session ID
  const ws = new WebSocket(`ws://localhost:8080/v1/messages?sessionId=${sessionId}`);
  
  await new Promise((resolve) => {
    ws.on('open', () => {
      console.log('✅ WebSocket connected with session');
      
      // Send handshake
      const handshake = {
        type: 'handshake',
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 Sending handshake:', handshake);
      ws.send(JSON.stringify(handshake));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('📨 Received:', message.type);
      
      if (message.type === 'handshake.ack') {
        console.log('✅ Handshake acknowledged');
        
        // Send a test audio frame for translation
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
        
        console.log('📤 Sending test frame for translation:', testFrame);
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

    ws.on('close', (code, reason) => {
      console.log('🔌 WebSocket closed:', code, reason.toString());
      resolve();
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      resolve();
    });
  });
}

testSessionTranslation().catch(console.error);
