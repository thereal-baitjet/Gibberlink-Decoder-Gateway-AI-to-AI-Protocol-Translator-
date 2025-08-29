#!/usr/bin/env node

const WebSocket = require('ws');

console.log('🔒 Testing WebSocket with Sensitive Data Redaction...');

// Create WebSocket connection
const ws = new WebSocket('ws://localhost:8080/v1/messages?sessionId=W4hG1cD57f6i0hDoc5VgX');

ws.on('open', function open() {
  console.log('✅ WebSocket connected!');
  
  // Send a test message with sensitive data
  const testMessage = {
    type: 'send',
    payload: {
      op: 'login',
      args: {
        username: 'john_doe',
        password: 'secret123',
        email: 'john@example.com',
        creditCard: '4111-1111-1111-1111'
      }
    }
  };
  
  console.log('📤 Sending sensitive message:', JSON.stringify(testMessage, null, 2));
  ws.send(JSON.stringify(testMessage));
});

ws.on('message', function message(data) {
  const parsed = JSON.parse(data.toString());
  console.log('\n📥 Received message:');
  console.log('Type:', parsed.type);
  console.log('Message ID:', parsed.msgId);
  
  if (parsed.type === 'recv') {
    console.log('Original Payload:', JSON.stringify(parsed.payload, null, 2));
    
    if (parsed.english) {
      console.log('\n🇬🇧 English Translation (with redaction):');
      console.log('Text:', parsed.english.text);
      console.log('Confidence:', (parsed.english.confidence * 100).toFixed(0) + '%');
      
      if (parsed.english.redactions && parsed.english.redactions.length > 0) {
        console.log('\n🔒 Redacted Fields:');
        parsed.english.redactions.forEach(redaction => {
          console.log('  •', redaction);
        });
      }
    }
  } else if (parsed.type === 'recv.plain') {
    console.log('\n📝 Plain English (redacted):');
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
