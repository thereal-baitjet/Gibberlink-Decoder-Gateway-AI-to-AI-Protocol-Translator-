#!/usr/bin/env node

const WebSocket = require('ws');

console.log('🎤 Testing Complete Real Audio → FSK → English Pipeline...');
console.log('========================================================');

async function testCompleteRealAudioPipeline() {
    try {
        // First establish a session
        const sessionResponse = await fetch('http://localhost:8080/v1/handshake', {
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

        if (!sessionResponse.ok) {
            throw new Error('Failed to establish session');
        }

        const sessionData = await sessionResponse.json();
        const sessionId = sessionData.sessionId;
        console.log(`✅ Session established: ${sessionId}`);

        // Connect to WebSocket
        const ws = new WebSocket(`ws://localhost:8080/v1/messages?sessionId=${sessionId}`);

        ws.on('open', () => {
            console.log('✅ WebSocket connected');
            
            // Start audio capture
            console.log('🎤 Starting real audio capture...');
            ws.send(JSON.stringify({
                type: 'audio.start'
            }));

            // Test 1: Send simulated audio frames (backward compatibility)
            console.log('\n📡 Test 1: Simulated Audio Frames');
            console.log('==================================');
            
            const simulatedFrames = [
                {
                    msgId: `sim-${Date.now()}-1`,
                    payload: { op: 'sensor_read', sensor: 'temperature', value: 23.5, unit: 'celsius' },
                    timestamp: Date.now(),
                    snrDb: 18.5,
                    lockPct: 85.2,
                    crcValid: true
                },
                {
                    msgId: `sim-${Date.now()}-2`,
                    payload: { op: 'status_check', component: 'battery', level: 75, charging: true },
                    timestamp: Date.now(),
                    snrDb: 20.1,
                    lockPct: 92.3,
                    crcValid: true
                }
            ];

            let frameIndex = 0;
            const sendSimulatedFrame = () => {
                if (frameIndex < simulatedFrames.length) {
                    const frame = simulatedFrames[frameIndex];
                    console.log(`📤 Sending simulated frame ${frameIndex + 1}:`, frame.payload.op);
                    
                    ws.send(JSON.stringify({
                        type: 'audio.frame',
                        frame: frame
                    }));
                    
                    frameIndex++;
                    setTimeout(sendSimulatedFrame, 2000);
                } else {
                    // Move to real audio test
                    setTimeout(testRealAudioData, 2000);
                }
            };

            sendSimulatedFrame();
        });

        // Test 2: Send real audio data for FSK demodulation
        function testRealAudioData() {
            console.log('\n🎵 Test 2: Real Audio Data for FSK Demodulation');
            console.log('================================================');
            
            // Generate synthetic FSK audio data
            const { AudioDecoderImpl } = require('./packages/audio-decoder/dist/index.js');
            
            const decoder = new AudioDecoderImpl({
                sampleRate: 48000,
                symbolRate: 1200,
                tones: [1200, 1800, 2400, 3000],
                windowSize: 1024,
                overlap: 0.5,
                noiseThreshold: 0.01,
                silenceThreshold: 0.001,
                maxFrameSize: 1024
            });

            const testMessages = [
                { op: 'sensor_read', sensor: 'temperature', value: 25.0, unit: 'celsius' },
                { op: 'status_check', component: 'battery', level: 80, charging: false },
                { error: 'AUDIO_ERROR', message: 'Real FSK signal detected', code: 200 }
            ];

            let messageIndex = 0;
            
            const sendRealAudioData = () => {
                if (messageIndex < testMessages.length) {
                    const message = testMessages[messageIndex];
                    const messageStr = JSON.stringify(message);
                    
                    console.log(`🎵 Generating FSK audio for: "${messageStr}"`);
                    
                    try {
                        // Encode message to FSK audio
                        const encodedAudio = decoder.codec.encode(new TextEncoder().encode(messageStr));
                        
                        // Add some realistic noise
                        const noisyAudio = new Float32Array(encodedAudio.length);
                        for (let i = 0; i < encodedAudio.length; i++) {
                            const noise = (Math.random() - 0.5) * 0.05; // 5% noise
                            noisyAudio[i] = encodedAudio[i] + noise;
                        }
                        
                        // Calculate RMS
                        const rms = Math.sqrt(noisyAudio.reduce((sum, val) => sum + val * val, 0) / noisyAudio.length);
                        
                        // Send real audio data to gateway
                        const audioFrame = {
                            msgId: `real-${Date.now()}-${messageIndex + 1}`,
                            audioData: Array.from(noisyAudio),
                            sampleRate: 48000,
                            timestamp: Date.now(),
                            rms: rms
                        };
                        
                        console.log(`📡 Sending real audio data (${noisyAudio.length} samples, RMS: ${rms.toFixed(4)})`);
                        
                        ws.send(JSON.stringify({
                            type: 'audio.raw',
                            frame: audioFrame
                        }));
                        
                        messageIndex++;
                        setTimeout(sendRealAudioData, 3000);
                        
                    } catch (error) {
                        console.error('❌ Failed to generate FSK audio:', error.message);
                        messageIndex++;
                        setTimeout(sendRealAudioData, 3000);
                    }
                } else {
                    // Finish test
                    setTimeout(() => {
                        console.log('\n⏹️ Stopping audio capture...');
                        ws.send(JSON.stringify({
                            type: 'audio.stop'
                        }));
                        
                        setTimeout(() => {
                            ws.close();
                            console.log('🎉 Complete real audio pipeline test finished!');
                        }, 2000);
                    }, 2000);
                }
            };
            
            sendRealAudioData();
        }

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'recv.plain') {
                console.log('\n🇬🇧 Plain English Translation:');
                console.log('=' .repeat(50));
                console.log(`Text: ${message.text}`);
                console.log(`Confidence: ${(message.confidence * 100).toFixed(1)}%`);
                console.log(`SNR: ${message.snrDb?.toFixed(1)}dB`);
                console.log(`Lock: ${message.lockPct?.toFixed(1)}%`);
                console.log(`Timestamp: ${message.timestamp}`);
                console.log('');
            } else if (message.type === 'audio.started') {
                console.log('✅ Audio capture started');
            } else if (message.type === 'audio.stopped') {
                console.log('⏹️ Audio capture stopped');
            } else if (message.type === 'audio.noise') {
                console.log(`🔇 Audio noise detected (RMS: ${message.rms?.toFixed(4)})`);
            } else if (message.type === 'audio.error') {
                console.log(`❌ Audio processing error: ${message.error}`);
            }
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
        });

        ws.on('close', () => {
            console.log('🔌 WebSocket connection closed');
        });

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testCompleteRealAudioPipeline();
