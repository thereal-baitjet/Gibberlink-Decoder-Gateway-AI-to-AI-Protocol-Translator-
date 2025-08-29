#!/usr/bin/env node

/**
 * Real WebSocket Test for Gibberlink Gateway
 * Demonstrates actual WebSocket functionality with session management
 */

const WebSocket = require('ws');
const http = require('http');

class RealWebSocketTest {
  constructor() {
    this.gatewayUrl = 'http://localhost:8080';
    this.wsUrl = 'ws://localhost:8080';
    this.sessionId = null;
    this.ws = null;
    this.messageCount = 0;
  }

  // Step 1: Create a session via HTTP handshake
  async createSession() {
    console.log('🔗 Creating session...');
    
    const handshakeData = {
      clientFeatures: {
        compression: 'none',
        fec: false,
        crypto: false,
        maxMtu: 1500
      },
      peerAddress: {
        protocol: 'ws',
        host: 'localhost',
        port: 8080
      }
    };

    try {
      const response = await this.makeHttpRequest('POST', '/v1/handshake', handshakeData, 'devkey');
      
      if (response.statusCode === 200) {
        this.sessionId = response.body.sessionId;
        console.log(`✅ Session created: ${this.sessionId}`);
        console.log(`📋 Negotiated features:`, response.body.negotiated);
        return this.sessionId;
      } else {
        throw new Error(`Handshake failed: ${response.body.message}`);
      }
    } catch (error) {
      console.error('❌ Session creation failed:', error.message);
      throw error;
    }
  }

  // Step 2: Connect to WebSocket with session
  async connectWebSocket() {
    if (!this.sessionId) {
      throw new Error('No session ID. Call createSession() first.');
    }

    const fullWsUrl = `${this.wsUrl}?sessionId=${this.sessionId}`;
    console.log(`🔌 Connecting to WebSocket: ${fullWsUrl}`);

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(fullWsUrl);

      this.ws.on('open', () => {
        console.log('✅ WebSocket connected successfully');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket disconnected: ${code} - ${reason}`);
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      });
    });
  }

  // Step 3: Send real WebSocket messages
  sendMessage(payload, type = 'send') {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      type: type,
      msgId: `test_${++this.messageCount}_${Date.now()}`,
      payload: payload,
      timestamp: new Date().toISOString()
    };

    console.log(`📤 Sending WebSocket message: ${message.msgId}`);
    console.log(`📦 Payload:`, payload);
    
    this.ws.send(JSON.stringify(message));
    return message.msgId;
  }

  // Step 4: Handle incoming WebSocket messages
  handleWebSocketMessage(message) {
    console.log(`📥 Received WebSocket message:`, message);

    switch (message.type) {
      case 'recv':
        console.log(`✅ Echo received: ${message.msgId}`);
        console.log(`📦 Echoed payload:`, message.payload);
        break;
      
      case 'error':
        console.error(`❌ Server error: ${message.message}`);
        break;
      
      case 'heartbeat':
        console.log(`💓 Heartbeat received: ${message.msgId}`);
        break;
      
      default:
        console.log(`❓ Unknown message type: ${message.type}`);
    }
  }

  // Step 5: Send encoded message via HTTP (alternative to WebSocket)
  async sendEncodedMessage(payload) {
    if (!this.sessionId) {
      throw new Error('No session ID. Call createSession() first.');
    }

    console.log('📤 Sending encoded message via HTTP...');
    
    const encodeData = {
      sessionId: this.sessionId,
      target: 'ws://localhost:8080',
      payload: payload,
      requireTranscript: true
    };

    try {
      const response = await this.makeHttpRequest('POST', '/v1/encode', encodeData, 'devkey');
      
      if (response.statusCode === 200) {
        console.log(`✅ Message encoded and sent: ${response.body.msgId}`);
        console.log(`📊 Size: ${response.body.size} bytes`);
        console.log(`🔍 CRC32: ${response.body.crc32}`);
        console.log(`📋 Frames: ${response.body.frames}`);
        return response.body;
      } else {
        throw new Error(`Encode failed: ${response.body.message}`);
      }
    } catch (error) {
      console.error('❌ Encode failed:', error.message);
      throw error;
    }
  }

  // Step 6: Decode a message
  async decodeMessage(bytesBase64) {
    console.log('🔍 Decoding message...');
    
    const decodeData = { bytesBase64 };
    
    try {
      const response = await this.makeHttpRequest('POST', '/v1/decode', decodeData, 'devkey');
      
      if (response.statusCode === 200) {
        console.log(`✅ Message decoded: ${response.body.msgId}`);
        console.log(`📦 Decoded payload:`, response.body.payload);
        console.log(`🔍 CRC32: ${response.body.crc32}`);
        return response.body;
      } else {
        throw new Error(`Decode failed: ${response.body.message}`);
      }
    } catch (error) {
      console.error('❌ Decode failed:', error.message);
      throw error;
    }
  }

  // Step 7: Get transcript
  async getTranscript(msgId) {
    console.log(`📋 Getting transcript for: ${msgId}`);
    
    try {
      const response = await this.makeHttpRequest('GET', `/v1/transcript/${msgId}`, null, 'devkey');
      
      if (response.statusCode === 200) {
        console.log(`✅ Transcript found: ${response.body.msgId}`);
        console.log(`📊 Route: ${response.body.audit.route}`);
        console.log(`👤 Actor: ${response.body.audit.actor}`);
        console.log(`✅ Policy decision: ${response.body.audit.policyDecision}`);
        return response.body;
      } else {
        throw new Error(`Transcript not found: ${response.body.message}`);
      }
    } catch (error) {
      console.error('❌ Transcript failed:', error.message);
      throw error;
    }
  }

  // Utility: Make HTTP requests
  async makeHttpRequest(method, path, data = null, apiKey = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.gatewayUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'X-API-Key': apiKey })
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = {
              statusCode: res.statusCode,
              headers: res.headers,
              body: body ? JSON.parse(body) : null
            };
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  // Step 8: Close WebSocket connection
  close() {
    if (this.ws) {
      this.ws.close();
      console.log('🔌 WebSocket connection closed');
    }
  }
}

// Run the real WebSocket test
async function runRealWebSocketTest() {
  console.log('🚀 Real WebSocket Test for Gibberlink Gateway\n');
  
  const test = new RealWebSocketTest();
  
  try {
    // Step 1: Create session
    await test.createSession();
    
    // Step 2: Connect WebSocket
    await test.connectWebSocket();
    
    // Step 3: Send WebSocket messages
    console.log('\n📤 Testing WebSocket messages...');
    
    // Send simple message
    test.sendMessage({
      message: 'Hello from real WebSocket!',
      timestamp: new Date().toISOString(),
      test: true
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send complex message
    test.sendMessage({
      operation: 'calculate',
      data: {
        a: 10,
        b: 20,
        operator: '+'
      },
      metadata: {
        source: 'websocket-test',
        version: '1.0.0'
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send heartbeat
    test.sendMessage({}, 'heartbeat');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 4: Test HTTP encode/decode
    console.log('\n📤 Testing HTTP encode/decode...');
    
    const encodedMessage = await test.sendEncodedMessage({
      message: 'Hello from HTTP encode!',
      method: 'http',
      timestamp: new Date().toISOString()
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 5: Decode the message
    await test.decodeMessage(encodedMessage.bytesBase64);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 6: Get transcript
    await test.getTranscript(encodedMessage.msgId);
    
    // Step 7: Keep connection alive for a bit
    console.log('\n⏳ Keeping WebSocket connection alive for 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Step 8: Cleanup
    test.close();
    console.log('\n✅ Real WebSocket test completed');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runRealWebSocketTest().catch(console.error);
}

module.exports = { RealWebSocketTest };
