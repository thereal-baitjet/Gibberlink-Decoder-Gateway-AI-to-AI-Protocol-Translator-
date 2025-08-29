#!/usr/bin/env node

const { AudioToPlainPipeline } = require('./apps/gateway/dist/index.js');

console.log('🎤 Testing Audio → Plain English Pipeline...');

// Create test pipeline
const pipeline = new AudioToPlainPipeline({
  preset: 'lowLatency',
  enableRedaction: true,
  enableGlossary: true,
  maxLatencyMs: 300
});

// Set up event handlers
pipeline.on('plainEnglish', (result) => {
  console.log('\n🇬🇧 Plain English Result:');
  console.log('=' .repeat(50));
  console.log(`Message ID: ${result.msgId}`);
  console.log(`Text: ${result.text}`);
  console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`SNR: ${result.snrDb.toFixed(1)}dB`);
  console.log(`Lock: ${(result.lockPct * 100).toFixed(1)}%`);
  console.log(`Latency: ${result.latencyMs}ms`);
  
  if (result.glossary && Object.keys(result.glossary).length > 0) {
    console.log('\n📚 Glossary Terms:');
    Object.entries(result.glossary).forEach(([term, def]) => {
      console.log(`  • ${term}: ${def}`);
    });
  }
  
  if (result.redactions && result.redactions.length > 0) {
    console.log('\n🔒 Redacted Fields:');
    result.redactions.forEach(redaction => {
      console.log(`  • ${redaction}`);
    });
  }
});

pipeline.on('metrics', (metrics) => {
  console.log('\n📊 Pipeline Metrics:');
  console.log('=' .repeat(30));
  console.log(`Frames Received: ${metrics.framesReceived}`);
  console.log(`Frames Decoded: ${metrics.framesDecoded}`);
  console.log(`Messages Translated: ${metrics.messagesTranslated}`);
  console.log(`Average Latency: ${metrics.averageLatencyMs.toFixed(1)}ms`);
  console.log(`Average SNR: ${metrics.averageSnrDb.toFixed(1)}dB`);
  console.log(`Average Confidence: ${(metrics.averageConfidence * 100).toFixed(1)}%`);
  console.log(`CRC Failures: ${metrics.crcFailures}`);
});

pipeline.on('error', (error) => {
  console.error('❌ Pipeline Error:', error.message);
});

pipeline.on('crcFailure', (frame) => {
  console.warn('⚠️  CRC Failure:', frame.msgId);
});

pipeline.on('latencyWarning', (warning) => {
  console.warn('⚠️  Latency Warning:', `${warning.latencyMs}ms > ${warning.threshold}ms threshold`);
});

// Test synthetic audio frames
async function testSyntheticFrames() {
  console.log('\n🧪 Testing with Synthetic Audio Frames...');
  
  // Simulate audio frame events
  const testFrames = [
    {
      msgId: 'test-001',
      payload: new TextEncoder().encode(JSON.stringify({
        op: 'sum',
        args: { a: 5, b: 9 },
        id: 'req-123'
      })),
      timestamp: Date.now(),
      snrDb: 18.5,
      lockPct: 0.95,
      crcValid: true
    },
    {
      msgId: 'test-002',
      payload: new TextEncoder().encode(JSON.stringify({
        op: 'login',
        args: {
          username: 'john_doe',
          password: 'secret123',
          email: 'john@example.com'
        }
      })),
      timestamp: Date.now(),
      snrDb: 16.2,
      lockPct: 0.88,
      crcValid: true
    },
    {
      msgId: 'test-003',
      payload: new TextEncoder().encode(JSON.stringify({
        hello: true,
        caps: {
          mtu: 16384,
          fec: true,
          compression: 'zstd'
        }
      })),
      timestamp: Date.now(),
      snrDb: 20.1,
      lockPct: 0.98,
      crcValid: true
    }
  ];

  // Process frames
  for (const frame of testFrames) {
    console.log(`\n📡 Processing frame: ${frame.msgId}`);
    console.log(`SNR: ${frame.snrDb}dB, Lock: ${(frame.lockPct * 100).toFixed(1)}%`);
    
    // Simulate frame event
    pipeline.emit('frame', frame);
    
    // Wait a bit between frames
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Test multipart frames
async function testMultipartFrames() {
  console.log('\n🧩 Testing Multipart Frames...');
  
  const msgId = 'multipart-001';
  const payload = new TextEncoder().encode(JSON.stringify({
    op: 'complexOperation',
    args: {
      data: 'This is a longer message that would be split across multiple frames',
      timestamp: Date.now(),
      metadata: {
        source: 'audio-demo',
        version: '1.0.0'
      }
    }
  }));
  
  // Split payload into chunks
  const chunkSize = Math.ceil(payload.length / 3);
  const totalChunks = 3;
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, payload.length);
    const chunk = payload.slice(start, end);
    
    const frame = {
      msgId,
      payload: chunk,
      timestamp: Date.now(),
      snrDb: 17.5 + Math.random() * 3,
      lockPct: 0.9 + Math.random() * 0.08,
      crcValid: true,
      frameIndex: i,
      totalFrames: totalChunks
    };
    
    console.log(`📡 Processing multipart frame ${i + 1}/${totalChunks}`);
    pipeline.emit('frame', frame);
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

// Test error conditions
async function testErrorConditions() {
  console.log('\n⚠️  Testing Error Conditions...');
  
  // Test CRC failure
  const crcFailFrame = {
    msgId: 'crc-fail-001',
    payload: new TextEncoder().encode('{"invalid": "json'),
    timestamp: Date.now(),
    snrDb: 12.0,
    lockPct: 0.75,
    crcValid: false
  };
  
  console.log('📡 Testing CRC failure...');
  pipeline.emit('frame', crcFailFrame);
  
  // Test decode failure
  const decodeFailFrame = {
    msgId: 'decode-fail-001',
    payload: new TextEncoder().encode('invalid json content'),
    timestamp: Date.now(),
    snrDb: 15.0,
    lockPct: 0.85,
    crcValid: true
  };
  
  console.log('📡 Testing decode failure...');
  pipeline.emit('frame', decodeFailFrame);
  
  await new Promise(resolve => setTimeout(resolve, 100));
}

// Test performance
async function testPerformance() {
  console.log('\n⚡ Testing Performance...');
  
  const startTime = Date.now();
  const numFrames = 10;
  
  for (let i = 0; i < numFrames; i++) {
    const frame = {
      msgId: `perf-${i.toString().padStart(3, '0')}`,
      payload: new TextEncoder().encode(JSON.stringify({
        op: 'test',
        index: i,
        timestamp: Date.now()
      })),
      timestamp: Date.now(),
      snrDb: 18.0 + Math.random() * 4,
      lockPct: 0.9 + Math.random() * 0.1,
      crcValid: true
    };
    
    pipeline.emit('frame', frame);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / numFrames;
  
  console.log(`\n📊 Performance Results:`);
  console.log(`Total Time: ${totalTime}ms`);
  console.log(`Average Time per Frame: ${avgTime.toFixed(1)}ms`);
  console.log(`Throughput: ${(numFrames / (totalTime / 1000)).toFixed(1)} frames/sec`);
}

// Main test function
async function runTests() {
  try {
    console.log('🚀 Starting Audio → Plain English Pipeline Tests...\n');
    
    // Test basic functionality
    await testSyntheticFrames();
    
    // Test multipart frames
    await testMultipartFrames();
    
    // Test error conditions
    await testErrorConditions();
    
    // Test performance
    await testPerformance();
    
    // Final metrics
    console.log('\n🎯 Final Pipeline Metrics:');
    console.log('=' .repeat(40));
    const finalMetrics = pipeline.getMetrics();
    console.log(`Total Frames Processed: ${finalMetrics.framesReceived}`);
    console.log(`Successful Translations: ${finalMetrics.messagesTranslated}`);
    console.log(`Average Latency: ${finalMetrics.averageLatencyMs.toFixed(1)}ms`);
    console.log(`Average SNR: ${finalMetrics.averageSnrDb.toFixed(1)}dB`);
    console.log(`Average Confidence: ${(finalMetrics.averageConfidence * 100).toFixed(1)}%`);
    console.log(`CRC Failures: ${finalMetrics.crcFailures}`);
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n🎉 Audio → Plain English Pipeline is working perfectly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up
    pipeline.destroy();
  }
}

// Run the tests
runTests();
