#!/usr/bin/env node

import { Command } from 'commander';
import axios from 'axios';
import WebSocket from 'ws';
import { 
  ProtocolProcessor, 
  codecs, 
  FramerV1, 
  fecImplementations 
} from '@gibberlink/protocol-core';

interface ClientConfig {
  gatewayUrl: string;
  apiKey: string;
  transport: 'ws' | 'udp' | 'audio';
  target: string;
  payload: any;
  count: number;
  delay: number;
}

class GibberlinkClient {
  private config: ClientConfig;
  private sessionId: string | null = null;
  private ws: WebSocket | null = null;
  private stats = {
    sent: 0,
    received: 0,
    errors: 0,
    totalLatency: 0,
    totalBytes: 0,
  };

  constructor(config: ClientConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log(`🔌 Connecting to gateway: ${this.config.gatewayUrl}`);
    
    try {
      const response = await axios.get(`${this.config.gatewayUrl}/v1/health`, {
        headers: { 'x-api-key': this.config.apiKey }
      });
      
      if (response.data.status === 'ok') {
        console.log('✅ Gateway connection successful');
      } else {
        throw new Error('Gateway health check failed');
      }
    } catch (error) {
      console.error('❌ Gateway connection failed:', error);
      throw error;
    }
  }

  async handshake(): Promise<void> {
    console.log('🤝 Establishing handshake...');
    
    try {
      const response = await axios.post(`${this.config.gatewayUrl}/v1/handshake`, {
        transport: this.config.transport,
        target: this.config.target,
        features: {
          compression: 'zstd',
          fec: true,
          crypto: false,
          maxMtu: 1500,
        },
      }, {
        headers: { 'x-api-key': this.config.apiKey }
      });

      this.sessionId = response.data.sessionId;
      console.log(`✅ Handshake successful - Session ID: ${this.sessionId}`);
      
      // Connect WebSocket for streaming
      await this.connectWebSocket();
    } catch (error) {
      console.error('❌ Handshake failed:', error);
      throw error;
    }
  }

  private async connectWebSocket(): Promise<void> {
    if (!this.sessionId) {
      console.error('No session ID available for WebSocket connection');
      return;
    }

    const wsUrl = this.config.gatewayUrl.replace('http', 'ws') + `/v1/messages?sessionId=${this.sessionId}`;
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        console.log('✅ WebSocket connected');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.stats.received++;
          console.log(`📨 Received: ${JSON.stringify(message)}`);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });
      
      this.ws.on('close', () => {
        console.log('📴 WebSocket disconnected');
      });
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      });
    });
  }

  async sendMessage(payload: any): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No active session - establish handshake first');
    }

    const startTime = Date.now();
    
    try {
      console.log(`📤 Sending message: ${JSON.stringify(payload)}`);
      
      const response = await axios.post(`${this.config.gatewayUrl}/v1/encode`, {
        sessionId: this.sessionId,
        target: this.config.target,
        payload,
        requireTranscript: true,
      }, {
        headers: { 'x-api-key': this.config.apiKey }
      });

      const latency = Date.now() - startTime;
      this.stats.sent++;
      this.stats.totalLatency += latency;
      this.stats.totalBytes += response.data.size || 0;

      console.log(`✅ Message sent successfully - ID: ${response.data.msgId}, Latency: ${latency}ms, Size: ${this.formatBytes(response.data.size)}`);

      // Also send via WebSocket if available
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'send',
          payload,
          timestamp: new Date().toISOString(),
        }));
      }

    } catch (error) {
      this.stats.errors++;
      console.error('❌ Message failed:', error);
      throw error;
    }
  }

  async runTest(): Promise<void> {
    console.log(`🚀 Starting test with ${this.config.count} messages...`);
    
    for (let i = 0; i < this.config.count; i++) {
      try {
        const payload = {
          ...this.config.payload,
          testId: i + 1,
          timestamp: new Date().toISOString(),
        };

        await this.sendMessage(payload);
        
        if (i < this.config.count - 1 && this.config.delay > 0) {
          await this.sleep(this.config.delay);
        }
      } catch (error) {
        console.error(`Message ${i + 1} failed:`, error);
      }
    }

    this.printStats();
  }

  async decodeMessage(bytesBase64: string): Promise<void> {
    console.log('🔍 Decoding message...');
    
    try {
      const response = await axios.post(`${this.config.gatewayUrl}/v1/decode`, {
        bytesBase64,
      }, {
        headers: { 'x-api-key': this.config.apiKey }
      });

      console.log('✅ Decoded message:');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('❌ Decode failed:', error);
    }
  }

  async getTranscript(msgId: string): Promise<void> {
    console.log(`📄 Getting transcript for message: ${msgId}`);
    
    try {
      const response = await axios.get(`${this.config.gatewayUrl}/v1/transcript/${msgId}`, {
        headers: { 'x-api-key': this.config.apiKey }
      });

      console.log('✅ Transcript:');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('❌ Failed to get transcript:', error);
    }
  }

  private printStats(): void {
    console.log('\n📊 Test Statistics:');
    console.log(`   Messages sent: ${this.stats.sent}`);
    console.log(`   Messages received: ${this.stats.received}`);
    console.log(`   Errors: ${this.stats.errors}`);
    console.log(`   Success rate: ${this.stats.sent > 0 ? Math.round(((this.stats.sent - this.stats.errors) / this.stats.sent) * 100) : 100}%`);
    console.log(`   Average latency: ${this.stats.sent > 0 ? Math.round(this.stats.totalLatency / this.stats.sent) : 0}ms`);
    console.log(`   Total bytes sent: ${this.formatBytes(this.stats.totalBytes)}`);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// CLI setup
const program = new Command();

program
  .name('gibberlink-client')
  .description('Gibberlink Gateway Node.js client')
  .version('1.0.0');

program
  .command('test')
  .description('Run a test with multiple messages')
  .option('-u, --url <url>', 'Gateway URL', 'http://localhost:8080')
  .option('-k, --key <key>', 'API Key', 'devkey')
  .option('-t, --transport <transport>', 'Transport type', 'ws')
  .option('-r, --target <target>', 'Target address', 'ws://localhost:9999')
  .option('-p, --payload <payload>', 'Message payload (JSON)', '{"op":"sum","a":2,"b":3}')
  .option('-c, --count <count>', 'Number of messages', '10')
  .option('-d, --delay <delay>', 'Delay between messages (ms)', '1000')
  .action(async (options) => {
    const client = new GibberlinkClient({
      gatewayUrl: options.url,
      apiKey: options.key,
      transport: options.transport as 'ws' | 'udp' | 'audio',
      target: options.target,
      payload: JSON.parse(options.payload),
      count: parseInt(options.count),
      delay: parseInt(options.delay),
    });

    try {
      await client.connect();
      await client.handshake();
      await client.runTest();
    } catch (error) {
      console.error('Test failed:', error);
      process.exit(1);
    } finally {
      client.close();
    }
  });

program
  .command('decode')
  .description('Decode a base64 message')
  .option('-u, --url <url>', 'Gateway URL', 'http://localhost:8080')
  .option('-k, --key <key>', 'API Key', 'devkey')
  .option('-b, --bytes <bytes>', 'Base64 encoded bytes')
  .action(async (options) => {
    if (!options.bytes) {
      console.error('Bytes parameter is required');
      process.exit(1);
    }

    const client = new GibberlinkClient({
      gatewayUrl: options.url,
      apiKey: options.key,
      transport: 'ws',
      target: '',
      payload: {},
      count: 1,
      delay: 0,
    });

    try {
      await client.decodeMessage(options.bytes);
    } catch (error) {
      console.error('Decode failed:', error);
      process.exit(1);
    }
  });

program
  .command('transcript')
  .description('Get message transcript')
  .option('-u, --url <url>', 'Gateway URL', 'http://localhost:8080')
  .option('-k, --key <key>', 'API Key', 'devkey')
  .option('-m, --msgId <msgId>', 'Message ID')
  .action(async (options) => {
    if (!options.msgId) {
      console.error('Message ID parameter is required');
      process.exit(1);
    }

    const client = new GibberlinkClient({
      gatewayUrl: options.url,
      apiKey: options.key,
      transport: 'ws',
      target: '',
      payload: {},
      count: 1,
      delay: 0,
    });

    try {
      await client.getTranscript(options.msgId);
    } catch (error) {
      console.error('Failed to get transcript:', error);
      process.exit(1);
    }
  });

program.parse();
