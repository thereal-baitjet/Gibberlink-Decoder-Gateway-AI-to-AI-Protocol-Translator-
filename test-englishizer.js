#!/usr/bin/env node

const { createEnglishizer } = require('./packages/englishizer/dist/index.js');

console.log('🎤 Testing Englishizer...');

// Create englishizer instance
const englishizer = createEnglishizer();

// Test handshake message
const handshakeEvent = {
  kind: 'handshake',
  payload: {
    hello: true,
    caps: {
      mtu: 16384,
      fec: true,
      compression: 'zstd'
    }
  },
  meta: {
    msgId: 'test-123',
    transport: 'WebSocket',
    codec: 'MessagePack',
    ts: Date.now()
  }
};

// Test compute request
const computeEvent = {
  kind: 'compute-request',
  payload: {
    op: 'sum',
    args: { a: 2, b: 3 },
    id: 'req-456'
  },
  meta: {
    msgId: 'test-124',
    transport: 'WebSocket',
    codec: 'MessagePack',
    ts: Date.now()
  }
};

// Test sensitive data redaction
const sensitiveEvent = {
  kind: 'compute-request',
  payload: {
    op: 'login',
    args: {
      username: 'john_doe',
      password: 'secret123',
      email: 'john@example.com'
    }
  },
  meta: {
    msgId: 'test-125',
    transport: 'WebSocket',
    codec: 'MessagePack',
    ts: Date.now()
  }
};

async function testEnglishizer() {
  try {
    console.log('\n1. Testing Handshake Translation:');
    console.log('=' .repeat(50));
    const handshakeResult = await englishizer.toPlainEnglish(handshakeEvent);
    console.log(handshakeResult.text);
    console.log(`Confidence: ${(handshakeResult.confidence * 100).toFixed(0)}%`);
    
    if (handshakeResult.glossary && Object.keys(handshakeResult.glossary).length > 0) {
      console.log('\nGlossary:');
      Object.entries(handshakeResult.glossary).forEach(([term, def]) => {
        console.log(`  ${term}: ${def}`);
      });
    }

    console.log('\n2. Testing Compute Request Translation:');
    console.log('=' .repeat(50));
    const computeResult = await englishizer.toPlainEnglish(computeEvent);
    console.log(computeResult.text);
    console.log(`Confidence: ${(computeResult.confidence * 100).toFixed(0)}%`);

    console.log('\n3. Testing Sensitive Data Redaction:');
    console.log('=' .repeat(50));
    const sensitiveResult = await englishizer.toPlainEnglish(sensitiveEvent);
    console.log(sensitiveResult.text);
    console.log(`Confidence: ${(sensitiveResult.confidence * 100).toFixed(0)}%`);
    
    if (sensitiveResult.redactions && sensitiveResult.redactions.length > 0) {
      console.log('\nRedacted Fields:');
      sensitiveResult.redactions.forEach(redaction => {
        console.log(`  • ${redaction}`);
      });
    }

    console.log('\n🎉 Englishizer tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testEnglishizer();
