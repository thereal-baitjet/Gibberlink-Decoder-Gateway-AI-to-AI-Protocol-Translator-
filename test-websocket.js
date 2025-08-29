#!/usr/bin/env node

/**
 * Simple WebSocket Test
 */

const WebSocket = require('ws');

async function testWebSocket() {
  console.log('🔌 Testing WebSocket Connection...');
  console.log('==================================\n');

  const sessionId = `test_${Date.now()}`;
  const ws = new WebSocket(`ws://localhost:8080/v1/messages?sessionId=${sessionId}`);
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected successfully');
    
    // Send a simple handshake
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
    console.log('📨 Received message:', message);
    
    if (message.type === 'handshake.ack') {
      console.log('✅ Handshake acknowledged');
      
      // Send a test message
      const testMessage = {
        type: 'audio.frame',
        msgId: `test_${Date.now()}`,
        payload: { test: true },
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 Sending test message:', testMessage);
      ws.send(JSON.stringify(testMessage));
    }
  });

  ws.on('close', (code, reason) => {
    console.log('🔌 WebSocket closed:', code, reason.toString());
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });

  // Close after 5 seconds
  setTimeout(() => {
    console.log('⏰ Closing connection after timeout');
    ws.close();
  }, 5000);
}

testWebSocket().catch(console.error);
