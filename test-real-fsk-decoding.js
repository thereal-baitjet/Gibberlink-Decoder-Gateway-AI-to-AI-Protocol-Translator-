#!/usr/bin/env node

const { AudioDecoderImpl } = require('./packages/audio-decoder/dist/index.js');

console.log('🧪 Testing Real FSK Audio Decoding...');
console.log('=====================================');

async function testRealFSKDecoding() {
    try {
        // Create audio decoder with real FSK codec
        const decoder = new AudioDecoderImpl({
            sampleRate: 48000,
            symbolRate: 1200,  // 1200 baud
            tones: [1200, 1800, 2400, 3000], // 4-FSK frequencies
            windowSize: 1024,
            overlap: 0.5,
            noiseThreshold: 0.01,
            silenceThreshold: 0.001,
            maxFrameSize: 1024
        });

        console.log('✅ Audio decoder created with real FSK codec');

        // Test encoding a message
        const testMessage = JSON.stringify({
            op: 'sensor_read',
            sensor: 'temperature',
            value: 23.5,
            unit: 'celsius'
        });

        console.log('📤 Encoding test message:', testMessage);

        // Encode the message using the real FSK codec
        const encodedAudio = decoder.codec.encode(new TextEncoder().encode(testMessage));
        console.log(`✅ Message encoded to ${encodedAudio.length} audio samples`);

        // Simulate some noise and distortion
        const noisyAudio = new Float32Array(encodedAudio.length);
        for (let i = 0; i < encodedAudio.length; i++) {
            // Add some noise
            const noise = (Math.random() - 0.5) * 0.1;
            noisyAudio[i] = encodedAudio[i] + noise;
        }

        console.log('🔊 Added simulated noise to audio signal');

        // Decode the noisy audio
        const decodedFrames = await decoder.decodeChunk(noisyAudio);
        
        if (decodedFrames.length > 0) {
            console.log(`✅ Successfully decoded ${decodedFrames.length} frames`);
            
            for (let i = 0; i < decodedFrames.length; i++) {
                const frame = decodedFrames[i];
                try {
                    const decodedText = new TextDecoder().decode(frame);
                    const decodedJson = JSON.parse(decodedText);
                    console.log(`📥 Frame ${i + 1}:`, decodedJson);
                } catch (error) {
                    console.log(`📥 Frame ${i + 1}: Raw bytes (${frame.length} bytes)`);
                }
            }
        } else {
            console.log('❌ No frames decoded from audio signal');
        }

        // Test with different message types
        const testMessages = [
            { op: 'status_check', component: 'battery', level: 75 },
            { error: 'AUDIO_ERROR', message: 'Test error', code: 500 },
            { hello: true, caps: { mtu: 16384, fec: true, compression: 'zstd' } }
        ];

        console.log('\n🔄 Testing multiple message types...');

        for (const message of testMessages) {
            const messageStr = JSON.stringify(message);
            const encoded = decoder.codec.encode(new TextEncoder().encode(messageStr));
            const decoded = await decoder.decodeChunk(encoded);
            
            if (decoded.length > 0) {
                const decodedText = new TextDecoder().decode(decoded[0]);
                console.log(`✅ "${messageStr}" -> "${decodedText}"`);
            } else {
                console.log(`❌ Failed to decode: "${messageStr}"`);
            }
        }

        // Test SNR calculation
        console.log('\n📊 Testing SNR calculation...');
        const snr = decoder.calculateSNR([], []);
        console.log(`📈 SNR: ${snr.toFixed(2)} dB`);

        // Test with silence
        console.log('\n🔇 Testing silence detection...');
        const silence = new Float32Array(1024).fill(0);
        const silenceFrames = await decoder.decodeChunk(silence);
        console.log(`🔇 Silence frames: ${silenceFrames.length} (expected: 0)`);

        console.log('\n🎉 Real FSK decoding test completed!');
        console.log('=====================================');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testRealFSKDecoding();
