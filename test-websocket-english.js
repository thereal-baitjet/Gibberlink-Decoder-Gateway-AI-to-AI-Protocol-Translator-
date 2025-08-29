#!/usr/bin/env node

const WebSocket = require('ws');

console.log('🔗 Testing WebSocket with English Translation...');

// Create WebSocket connection
const ws = new WebSocket('ws://localhost:8080/v1/messages?sessionId=W4hG1cD57f6i0hDoc5VgX');

ws.on('open', function open() {
  console.log('✅ WebSocket connected!');
  
  // Send a test message
  const testMessage = {
    type: 'send',
    payload: {
      op: 'sum',
      args: { a: 5, b: 9 },
      id: 'test-123'
    }
  };
  
  console.log('📤 Sending message:', JSON.stringify(testMessage, null, 2));
  ws.send(JSON.stringify(testMessage));
});

ws.on('message', function message(data) {
  const parsed = JSON.parse(data.toString());
  console.log('\n📥 Received message:');
  console.log('Type:', parsed.type);
  console.log('Message ID:', parsed.msgId);
  
  if (parsed.type === 'recv') {
    console.log('Payload:', JSON.stringify(parsed.payload, null, 2));
    
    if (parsed.english) {
      console.log('\n🇬🇧 English Translation:');
      console.log('Text:', parsed.english.text);
      console.log('Confidence:', (parsed.english.confidence * 100).toFixed(0) + '%');
      
      if (parsed.english.glossary && Object.keys(parsed.english.glossary).length > 0) {
        console.log('Glossary Terms:', Object.keys(parsed.english.glossary).join(', '));
      }
      
      if (parsed.english.redactions && parsed.english.redactions.length > 0) {
        console.log('Redacted Fields:', parsed.english.redactions.join(', '));
      }
    }
  } else if (parsed.type === 'recv.plain') {
    console.log('\n📝 Plain English:');
    console.log('Text:', parsed.text);
    console.log('Confidence:', (parsed.confidence * 100).toFixed(0) + '%');
  } else if (parsed.type === 'error') {
    console.log('❌ Error:', parsed.message);
  }
  
  // Close connection after receiving response
  setTimeout(() => {
    console.log('\n🔌 Closing connection...');
    ws.close();
  }, 1000);
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close() {
  console.log('✅ WebSocket connection closed');
  process.exit(0);
});
