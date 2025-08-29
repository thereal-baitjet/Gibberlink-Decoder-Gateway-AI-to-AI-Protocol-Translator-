#!/usr/bin/env node

const WebSocket = require('ws');

console.log('🎤 Testing Real Audio Capture and Translation...');

async function testRealAudio() {
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
            console.log('🎤 Starting audio capture...');
            ws.send(JSON.stringify({
                type: 'audio.start'
            }));

            // Simulate audio frames being sent from microphone
            let frameCount = 0;
            const audioFrameInterval = setInterval(() => {
                frameCount++;
                
                // Simulate different types of audio-detected messages
                const audioFrames = [
                    {
                        msgId: `audio-${Date.now()}-${frameCount}`,
                        payload: {
                            op: 'sensor_read',
                            sensor: 'temperature',
                            value: 23.5 + Math.random() * 5,
                            unit: 'celsius',
                            timestamp: Date.now()
                        },
                        timestamp: Date.now(),
                        snrDb: 18 + Math.random() * 5,
                        lockPct: 85 + Math.random() * 15,
                        crcValid: true
                    },
                    {
                        msgId: `audio-${Date.now()}-${frameCount}`,
                        payload: {
                            op: 'status_check',
                            component: 'battery',
                            level: Math.floor(20 + Math.random() * 80),
                            charging: Math.random() > 0.5
                        },
                        timestamp: Date.now(),
                        snrDb: 16 + Math.random() * 8,
                        lockPct: 75 + Math.random() * 25,
                        crcValid: true
                    },
                    {
                        msgId: `audio-${Date.now()}-${frameCount}`,
                        payload: {
                            hello: true,
                            caps: {
                                mtu: 16384,
                                fec: true,
                                compression: 'zstd'
                            }
                        },
                        timestamp: Date.now(),
                        snrDb: 20 + Math.random() * 3,
                        lockPct: 90 + Math.random() * 10,
                        crcValid: true
                    }
                ];

                const randomFrame = audioFrames[Math.floor(Math.random() * audioFrames.length)];
                
                console.log(`📡 Sending audio frame ${frameCount}:`, randomFrame.payload.op || 'handshake');
                
                // Send audio frame to gateway
                ws.send(JSON.stringify({
                    type: 'audio.frame',
                    frame: randomFrame
                }));

                // Stop after 10 frames
                if (frameCount >= 10) {
                    clearInterval(audioFrameInterval);
                    console.log('⏹️ Stopping audio capture...');
                    ws.send(JSON.stringify({
                        type: 'audio.stop'
                    }));
                    
                    setTimeout(() => {
                        ws.close();
                        console.log('🎉 Real audio test completed!');
                    }, 2000);
                }
            }, 1000); // Send a frame every second

        });

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'recv.plain') {
                console.log('\n🇬🇧 Real Audio Translation:');
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
testRealAudio();
