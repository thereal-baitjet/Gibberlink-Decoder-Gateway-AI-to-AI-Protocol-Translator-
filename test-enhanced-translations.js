#!/usr/bin/env node

const WebSocket = require('ws');

console.log('🧪 Testing Enhanced Plain English Translations...');

async function testEnhancedTranslations() {
    try {
        // First establish a session
        const sessionResponse = await fetch(' http://localhost:8080/v1/handshake', {
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

            // Test enhanced translations with specific message types
            const enhancedMessages = [
                {
                    msgId: `audio-${Date.now()}-1`,
                    payload: {
                        op: 'sensor_read',
                        sensor: 'temperature',
                        value: 23.5,
                        unit: 'celsius',
                        timestamp: Date.now()
                    },
                    timestamp: Date.now(),
                    snrDb: 18.5,
                    lockPct: 85.2,
                    crcValid: true
                },
                {
                    msgId: `audio-${Date.now()}-2`,
                    payload: {
                        op: 'status_check',
                        component: 'battery',
                        level: 75,
                        charging: true
                    },
                    timestamp: Date.now(),
                    snrDb: 20.1,
                    lockPct: 92.3,
                    crcValid: true
                },
                {
                    msgId: `audio-${Date.now()}-3`,
                    payload: {
                        op: 'status',
                        component: 'sensor',
                        value: 49
                    },
                    timestamp: Date.now(),
                    snrDb: 19.8,
                    lockPct: 88.7,
                    crcValid: true
                },
                {
                    msgId: `audio-${Date.now()}-4`,
                    payload: {
                        error: 'AUDIO_ERROR',
                        message: 'Audio processing error',
                        code: 500
                    },
                    timestamp: Date.now(),
                    snrDb: 16.2,
                    lockPct: 78.9,
                    crcValid: true
                },
                {
                    msgId: `audio-${Date.now()}-5`,
                    payload: {
                        op: 'sensor_read',
                        sensor: 'humidity',
                        value: 65,
                        unit: '%',
                        timestamp: Date.now()
                    },
                    timestamp: Date.now(),
                    snrDb: 22.4,
                    lockPct: 95.1,
                    crcValid: true
                }
            ];

            let messageIndex = 0;

            const sendNextMessage = () => {
                if (messageIndex < enhancedMessages.length) {
                    const message = enhancedMessages[messageIndex];
                    console.log(`📡 Sending enhanced message ${messageIndex + 1}:`, message.payload.op || message.payload.error);
                    
                    // Send audio frame to gateway
                    ws.send(JSON.stringify({
                        type: 'audio.frame',
                        frame: message
                    }));
                    
                    messageIndex++;
                    
                    // Send next message after 2 seconds
                    setTimeout(sendNextMessage, 2000);
                } else {
                    console.log('⏹️ Stopping audio capture...');
                    ws.send(JSON.stringify({
                        type: 'audio.stop'
                    }));
                    
                    setTimeout(() => {
                        ws.close();
                        console.log('🎉 Enhanced translation test completed!');
                    }, 2000);
                }
            };

            // Start sending messages
            sendNextMessage();

        });

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'recv.plain') {
                console.log('\n🇬🇧 Enhanced Plain English Translation:');
                console.log('=' .repeat(60));
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
testEnhancedTranslations();
