#!/usr/bin/env node

/**
 * Show Translations Working
 * Displays translations directly in the terminal
 */

const WebSocket = require('ws');

async function establishSession() {
  try {
    const response = await fetch('http://localhost:8080/v1/handshake', {
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

    if (response.ok) {
      const data = await response.json();
      return data.sessionId;
    } else {
      throw new Error('Failed to establish session');
    }
  } catch (error) {
    console.error('Session establishment failed:', error);
    return null;
  }
}

async function showTranslations() {
  console.log('🎯 SHOWING TRANSLATIONS WORKING');
  console.log('================================\n');

  const sessionId = await establishSession();
  if (!sessionId) {
    console.error('❌ Failed to establish session');
    return;
  }

  const ws = new WebSocket(`ws://localhost:8080/v1/messages?sessionId=${sessionId}`);
  
  await new Promise((resolve) => {
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Send handshake
      ws.send(JSON.stringify({
        type: 'handshake',
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'handshake.ack') {
        console.log('✅ Handshake acknowledged\n');
        
        // Send test messages one by one
        const testMessages = [
          {
            name: '🌡️ Temperature Sensor',
            payload: {
              op: 'sensor_read',
              sensor: 'temperature',
              value: 23.5,
              unit: 'celsius',
              location: 'server_room_1'
            }
          },
          {
            name: '🔋 Battery Status',
            payload: {
              op: 'status_check',
              component: 'battery',
              level: 75,
              charging: true,
              voltage: 12.6
            }
          },
          {
            name: '🧠 AI Compute Request',
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
            }
          }
        ];

        let messageIndex = 0;
        
        function sendNextMessage() {
          if (messageIndex >= testMessages.length) {
            console.log('\n🎉 All translations completed!');
            ws.close();
            return;
          }

          const testMsg = testMessages[messageIndex];
          console.log(`📤 Sending: ${testMsg.name}`);
          console.log('JSON:', JSON.stringify(testMsg.payload, null, 2));
          
          const frame = {
            type: 'audio.frame',
            msgId: `test_${messageIndex}_${Date.now()}`,
            payload: testMsg.payload,
            timestamp: new Date().toISOString()
          };
          
          ws.send(JSON.stringify(frame));
          messageIndex++;
        }

        // Send first message
        sendNextMessage();
        
      } else if (message.type === 'recv.plain') {
        console.log('\n🤖 TRANSLATION RECEIVED:');
        console.log('='.repeat(50));
        console.log('📝 Text:', message.text);
        console.log('🎯 Confidence:', Math.round(message.confidence * 100) + '%');
        console.log('📊 SNR:', message.snrDb + 'dB');
        console.log('⏰ Timestamp:', message.timestamp);
        console.log('='.repeat(50));
        
        // Send next message after 2 seconds
        setTimeout(() => {
          const testMessages = [
            {
              name: '🌡️ Temperature Sensor',
              payload: {
                op: 'sensor_read',
                sensor: 'temperature',
                value: 23.5,
                unit: 'celsius',
                location: 'server_room_1'
              }
            },
            {
              name: '🔋 Battery Status',
              payload: {
                op: 'status_check',
                component: 'battery',
                level: 75,
                charging: true,
                voltage: 12.6
              }
            },
            {
              name: '🧠 AI Compute Request',
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
              }
            }
          ];

          let messageIndex = 0;
          
          function sendNextMessage() {
            if (messageIndex >= testMessages.length) {
              console.log('\n🎉 All translations completed!');
              ws.close();
              return;
            }

            const testMsg = testMessages[messageIndex];
            console.log(`\n📤 Sending: ${testMsg.name}`);
            console.log('JSON:', JSON.stringify(testMsg.payload, null, 2));
            
            const frame = {
              type: 'audio.frame',
              msgId: `test_${messageIndex}_${Date.now()}`,
              payload: testMsg.payload,
              timestamp: new Date().toISOString()
            };
            
            ws.send(JSON.stringify(frame));
            messageIndex++;
          }

          sendNextMessage();
        }, 2000);
      }
    });

    ws.on('close', () => {
      console.log('\n🔌 WebSocket connection closed');
      resolve();
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      resolve();
    });
  });
}

showTranslations().catch(console.error);
