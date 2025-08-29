#!/usr/bin/env node

/**
 * WebSocket Client Example for Gibberlink Gateway
 * Demonstrates real-time communication with the gateway
 */

const WebSocket = require('ws');
const http = require('http');

class GibberlinkWebSocketClient {
  constructor(gatewayUrl = 'ws://localhost:8080') {
    this.gatewayUrl = gatewayUrl;
    this.ws = null;
    this.sessionId = null;
    this.messageId = 0;
    this.connected = false;
    this.messageHandlers = new Map();
  }

  // Step 1: Establish a session via HTTP handshake
  async establishSession(apiKey = 'devkey') {
    console.log('🔗 Establishing session...');
    
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

    const response = await this.makeHttpRequest('POST', '/v1/handshake', handshakeData, apiKey);
    
    if (response.statusCode === 200) {
      this.sessionId = response.body.sessionId;
      console.log(`✅ Session established: ${this.sessionId}`);
      console.log(`📋 Negotiated features:`, response.body.negotiated);
      return this.sessionId;
    } else {
      throw new Error(`Handshake failed: ${response.body.message}`);
    }
  }

  // Step 2: Connect to WebSocket with session
  async connect() {
    if (!this.sessionId) {
      throw new Error('Session not established. Call establishSession() first.');
    }

    const wsUrl = `${this.gatewayUrl}?sessionId=${this.sessionId}`;
    console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('✅ WebSocket connected');
        this.connected = true;
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket disconnected: ${code} - ${reason}`);
        this.connected = false;
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      });
    });
  }

  // Step 3: Send real-time messages
  async sendMessage(payload, type = 'send') {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      type: type,
      msgId: `client_${++this.messageId}`,
      payload: payload,
      timestamp: new Date().toISOString()
    };

    console.log(`📤 Sending message: ${message.msgId}`);
    this.ws.send(JSON.stringify(message));
    return message.msgId;
  }

  // Step 4: Handle incoming messages
  handleMessage(message) {
    console.log(`📥 Received message:`, message);

    switch (message.type) {
      case 'recv':
        console.log(`✅ Echo received: ${message.msgId}`);
        console.log(`📦 Payload:`, message.payload);
        break;
      
      case 'error':
        console.error(`❌ Server error: ${message.message}`);
        break;
      
      case 'heartbeat':
        console.log(`💓 Heartbeat received`);
        break;
      
      default:
        console.log(`❓ Unknown message type: ${message.type}`);
    }

    // Call registered handlers
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }
  }

  // Step 5: Register message handlers
  onMessage(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  // Step 6: Send encoded messages via HTTP (alternative to WebSocket)
  async sendEncodedMessage(payload, target = 'ws://localhost:8080', apiKey = 'devkey') {
    if (!this.sessionId) {
      throw new Error('Session not established');
    }

    const encodeData = {
      sessionId: this.sessionId,
      target: target,
      payload: payload,
      requireTranscript: true
    };

    const response = await this.makeHttpRequest('POST', '/v1/encode', encodeData, apiKey);
    
    if (response.statusCode === 200) {
      console.log(`✅ Message encoded and sent: ${response.body.msgId}`);
      console.log(`📊 Size: ${response.body.size} bytes, Frames: ${response.body.frames}`);
      console.log(`🔍 CRC32: ${response.body.crc32}`);
      return response.body;
    } else {
      throw new Error(`Encode failed: ${response.body.message}`);
    }
  }

  // Utility: Make HTTP requests
  async makeHttpRequest(method, path, data = null, apiKey = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.gatewayUrl.replace('ws://', 'http://'));
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

  // Step 7: Disconnect
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
      console.log('🔌 WebSocket disconnected');
    }
  }

  // Step 8: Get connection status
  isConnected() {
    return this.connected;
  }
}

// Example usage
async function runWebSocketExample() {
  console.log('🚀 Gibberlink WebSocket Client Example\n');

  const client = new GibberlinkWebSocketClient('ws://localhost:8080');

  try {
    // Step 1: Establish session
    await client.establishSession('devkey');

    // Step 2: Connect to WebSocket
    await client.connect();

    // Step 3: Register message handlers
    client.onMessage('recv', (message) => {
      console.log(`🎯 Custom handler: Received echo for ${message.msgId}`);
    });

    // Step 4: Send real-time messages
    console.log('\n📤 Sending real-time messages...');
    
    await client.sendMessage({
      message: 'Hello from WebSocket!',
      timestamp: new Date().toISOString(),
      data: { numbers: [1, 2, 3, 4, 5] }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    await client.sendMessage({
      operation: 'calculate',
      a: 10,
      b: 20,
      operator: '+'
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 5: Send encoded message via HTTP (alternative)
    console.log('\n📤 Sending encoded message via HTTP...');
    await client.sendEncodedMessage({
      message: 'Hello from HTTP encode!',
      method: 'http',
      timestamp: new Date().toISOString()
    });

    // Step 6: Keep connection alive for a bit
    console.log('\n⏳ Keeping connection alive for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Step 7: Cleanup
    client.disconnect();
    console.log('\n✅ Example completed');
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runWebSocketExample().catch(console.error);
}

module.exports = { GibberlinkWebSocketClient };
