#!/usr/bin/env node

const { createAudioDecoder, AudioPresets } = require('./packages/audio-decoder/dist/index.js');

console.log('🎤 Testing Audio Decoder...');

// Test 1: Create decoder with preset
console.log('\n1. Testing preset configurations...');
try {
  const decoder = createAudioDecoder(AudioPresets.lowLatency);
  console.log('✅ Low latency preset created successfully');
  console.log('   Sample rate:', AudioPresets.lowLatency.sampleRate);
  console.log('   Symbol rate:', AudioPresets.lowLatency.symbolRate);
  console.log('   Tones:', AudioPresets.lowLatency.tones);
} catch (error) {
  console.log('❌ Failed to create decoder:', error.message);
}

// Test 2: Test FSK codec
console.log('\n2. Testing FSK codec...');
try {
  const { FSKCodec } = require('./packages/audio-decoder/dist/index.js');
  const codec = new FSKCodec(AudioPresets.lowLatency);
  console.log('✅ FSK codec created successfully');
  
  // Test encoding
  const testData = new TextEncoder().encode('Hello World');
  const audio = codec.encode(testData);
  console.log('✅ Audio encoding successful, length:', audio.length);
  
  // Test decoding
  const decoded = codec.decode(audio);
  console.log('✅ Audio decoding successful, frames:', decoded.length);
} catch (error) {
  console.log('❌ FSK codec test failed:', error.message);
}

// Test 3: Test FFT analyzer
console.log('\n3. Testing FFT analyzer...');
try {
  const { FFTAnalyzer } = require('./packages/audio-decoder/dist/index.js');
  const analyzer = new FFTAnalyzer(48000, 1024, 0.5);
  console.log('✅ FFT analyzer created successfully');
  
  // Create test signal
  const testSignal = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    testSignal[i] = Math.sin(2 * Math.PI * 1000 * i / 48000) * 0.5; // 1kHz tone
  }
  
  const bins = analyzer.analyze(testSignal);
  console.log('✅ FFT analysis successful, bins:', bins.length);
  
  const peaks = analyzer.findPeakFrequencies(bins, 0.1);
  console.log('✅ Peak detection successful, peaks:', peaks);
} catch (error) {
  console.log('❌ FFT analyzer test failed:', error.message);
}

// Test 4: Test audio decoder integration
console.log('\n4. Testing audio decoder integration...');
try {
  const decoder = createAudioDecoder(AudioPresets.lowLatency);
  
  // Create test audio chunk
  const testChunk = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    testChunk[i] = Math.sin(2 * Math.PI * 1500 * i / 48000) * 0.1;
  }
  
  const frames = decoder.decodeChunk(testChunk);
  console.log('✅ Audio decoder integration successful');
  console.log('   Processed chunk, frames:', frames.length);
  
  const stats = decoder.getStats();
  console.log('   Stats:', {
    totalChunks: stats.totalChunks,
    totalFrames: stats.totalFrames,
    averageSnr: stats.averageSnr.toFixed(2),
    errorRate: (stats.errorRate * 100).toFixed(2) + '%'
  });
} catch (error) {
  console.log('❌ Audio decoder integration test failed:', error.message);
}

console.log('\n🎉 Audio decoder tests completed!');
