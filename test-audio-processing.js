#!/usr/bin/env node

/**
 * Test Audio Processing Pipeline
 * Verifies that audio data is being processed and translations are returned
 */

const WebSocket = require('ws');

async function testAudioProcessing() {
  console.log('🎤 Testing Audio Processing Pipeline...');
  console.log('=======================================\n');

  const sessionId = `test_${Date.now()}`;
  const ws = new WebSocket('ws://localhost:8080/v1/messages');
  
  await new Promise((resolve) => {
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Send handshake
      ws.send(JSON.stringify({
        type: 'handshake',
        sessionId,
        timestamp: new Date().toISOString()
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'handshake.ack') {
        console.log('✅ Session established:', message.sessionId);
        
        // Test 1: Send simulated audio frame
        console.log('\n📡 Test 1: Simulated Audio Frame');
        const simulatedFrame = {
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
        
        ws.send(JSON.stringify(simulatedFrame));
        
      } else if (message.type === 'recv.plain') {
        console.log('✅ Translation received:');
        console.log('Text:', message.text);
        console.log('Confidence:', message.confidence);
        console.log('SNR:', message.snrDb, 'dB');
        console.log('Timestamp:', message.timestamp);
        
        // Test 2: Send real audio data (simulated)
        console.log('\n📡 Test 2: Real Audio Data (Simulated)');
        const audioData = new Float32Array(4096);
        // Fill with some test data (simulating FSK tones)
        for (let i = 0; i < audioData.length; i++) {
          audioData[i] = Math.sin(2 * Math.PI * 1200 * i / 48000) * 0.1; // 1200 Hz tone
        }
        
        const realAudioFrame = {
          type: 'audio.raw',
          frame: {
            msgId: `audio_${Date.now()}`,
            audioData: Array.from(audioData),
            sampleRate: 48000,
            timestamp: Date.now(),
            rms: 0.1
          }
        };
        
        ws.send(JSON.stringify(realAudioFrame));
        
      } else if (message.type === 'audio.noise') {
        console.log('📡 Audio noise detected (no FSK signal):');
        console.log('Message:', message.message);
        console.log('RMS:', message.rms);
        
        // Test 3: Send a more complex audio frame
        console.log('\n📡 Test 3: Complex Audio Frame');
        const complexFrame = {
          type: 'audio.frame',
          msgId: `complex_${Date.now()}`,
          payload: {
            op: 'compute_request',
            task: 'image_processing',
            parameters: {
              algorithm: 'convolutional_neural_network',
              model: 'resnet50',
              input_size: [224, 224, 3],
              batch_size: 32
            },
            priority: 'high',
            timeout: 30000
          },
          timestamp: new Date().toISOString()
        };
        
        ws.send(JSON.stringify(complexFrame));
        
      } else if (message.type === 'audio.error') {
        console.log('❌ Audio processing error:');
        console.log('Error:', message.error);
        
      } else if (message.type === 'recv.plain' && message.msgId?.includes('complex')) {
        console.log('✅ Complex translation received:');
        console.log('Text:', message.text);
        console.log('Confidence:', message.confidence);
        console.log('SNR:', message.snrDb, 'dB');
        
        console.log('\n🎉 Audio processing pipeline test completed!');
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

testAudioProcessing().catch(console.error);
