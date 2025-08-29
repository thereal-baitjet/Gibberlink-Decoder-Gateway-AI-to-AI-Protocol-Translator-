#!/usr/bin/env node

const WebSocket = require('ws');

console.log('🧪 Testing Translation Button Functionality...');

async function testTranslation() {
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
            
            // Send test messages for translation
            const testMessages = [
                {
                    op: 'sum',
                    args: { a: 15, b: 25 },
                    id: 'test-001'
                },
                {
                    op: 'login',
                    args: {
                        username: 'demo_user',
                        password: 'demo123',
                        email: 'demo@example.com'
                    }
                },
                {
                    hello: true,
                    caps: {
                        mtu: 16384,
                        fec: true,
                        compression: 'zstd'
                    }
                }
            ];

            let messageIndex = 0;

            const sendNextMessage = () => {
                if (messageIndex < testMessages.length) {
                    const message = testMessages[messageIndex];
                    console.log(`📤 Sending message ${messageIndex + 1}:`, message);
                    
                    ws.send(JSON.stringify({
                        type: 'send',
                        payload: message
                    }));
                    
                    messageIndex++;
                    
                    // Send next message after 2 seconds
                    setTimeout(sendNextMessage, 2000);
                } else {
                    console.log('✅ All test messages sent');
                    setTimeout(() => {
                        ws.close();
                        console.log('🎉 Translation test completed!');
                    }, 1000);
                }
            };

            // Start sending messages
            sendNextMessage();
        });

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'recv.plain') {
                console.log('\n🇬🇧 Plain English Translation Received:');
                console.log('=' .repeat(50));
                console.log(`Text: ${message.text}`);
                console.log(`Confidence: ${(message.confidence * 100).toFixed(1)}%`);
                console.log(`Timestamp: ${message.timestamp}`);
                console.log('');
            } else if (message.type === 'recv' && message.english) {
                console.log('\n🇬🇧 English Translation (from recv):');
                console.log('=' .repeat(50));
                console.log(`Text: ${message.english.text}`);
                console.log(`Confidence: ${(message.english.confidence * 100).toFixed(1)}%`);
                if (message.english.redactions) {
                    console.log(`Redacted: ${message.english.redactions.join(', ')}`);
                }
                console.log('');
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
testTranslation();
