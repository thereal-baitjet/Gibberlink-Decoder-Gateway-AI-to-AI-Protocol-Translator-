import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { 
  ProtocolProcessor, 
  codecs, 
  FramerV1, 
  fecImplementations,
  HandshakeManager 
} from '@gibberlink/protocol-core';
import { 
  WebSocketTransport, 
  UDPTransport, 
  AudioTransport,
  TransportFactory 
} from '@gibberlink/transports';

export interface EchoPeerConfig {
  port: number;
  gatewayUrl: string;
  transport: 'ws' | 'udp' | 'audio';
  enableLossyMode: boolean;
}

export class EchoPeer {
  private app: express.Application;
  private server: any;
  private wss!: WebSocketServer;
  private config: EchoPeerConfig;
  private transport: any;
  private processor!: ProtocolProcessor;
  private handshakeManager!: HandshakeManager;
  private messageCount = 0;

  constructor(config: EchoPeerConfig) {
    this.config = config;
    this.app = express();
    this.setupExpress();
    this.setupWebSocket();
    this.setupTransport();
    this.setupProtocol();
  }

  private setupExpress(): void {
    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        transport: this.config.transport,
        messageCount: this.messageCount,
        timestamp: new Date().toISOString(),
      });
    });

    // Echo endpoint
    this.app.post('/echo', (req, res) => {
      const { payload } = req.body;
      
      if (!payload) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Payload is required',
        });
      }

      this.messageCount++;
      
      // Echo back with some modifications
      const echoPayload = {
        ...payload,
        echoed: true,
        timestamp: new Date().toISOString(),
        messageId: this.messageCount,
      };

      res.json({
        original: payload,
        echo: echoPayload,
        transport: this.config.transport,
      });
    });
  }

  private setupWebSocket(): void {
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws) => {
      console.log('WebSocket client connected to echo peer');

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'send') {
            this.messageCount++;
            
            // Echo back
            const echoMessage = {
              type: 'recv',
              msgId: `echo_${this.messageCount}`,
              payload: {
                ...message.payload,
                echoed: true,
                timestamp: new Date().toISOString(),
                messageId: this.messageCount,
              },
              timestamp: new Date().toISOString(),
            };

            ws.send(JSON.stringify(echoMessage));
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
            timestamp: new Date().toISOString(),
          }));
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected from echo peer');
      });
    });
  }

  private setupTransport(): void {
    switch (this.config.transport) {
      case 'ws':
        this.transport = new WebSocketTransport(this.config.port);
        break;
      case 'udp':
        this.transport = new UDPTransport(this.config.port);
        break;
      case 'audio':
        this.transport = new AudioTransport(this.config.port);
        break;
      default:
        throw new Error(`Unsupported transport: ${this.config.transport}`);
    }
  }

  private setupProtocol(): void {
    const codec = this.config.enableLossyMode ? 
      codecs.json : codecs.msgpack;
    const framer = new FramerV1();
    const fec = this.config.enableLossyMode ? 
      fecImplementations['simulated-loss'] : 
      fecImplementations['no-op'];

    this.processor = new ProtocolProcessor(codec, framer, fec);
    this.handshakeManager = new HandshakeManager();
  }

  async start(): Promise<void> {
    try {
      // Start transport
      if (this.transport.start) {
        await this.transport.start();
      }

      // Set up frame handler
      this.transport.onFrame(async (frame: Uint8Array, source: any) => {
        try {
          // Decode the frame
          const result = await this.processor.decode([frame]);
          
          if (result) {
            this.messageCount++;
            console.log(`Received message ${this.messageCount}:`, result.payload);

            // Echo back with modifications
            const echoPayload = {
              ...(result.payload as Record<string, unknown>),
              echoed: true,
              timestamp: new Date().toISOString(),
              messageId: this.messageCount,
              transport: this.config.transport,
            };

            // Encode echo response
            const echoFrames = await this.processor.encode(
              `echo_${this.messageCount}`,
              echoPayload,
              { maxFrameSize: 1500, enableChunking: true }
            );

            // Send back via transport
            for (const echoFrame of echoFrames) {
              await this.transport.send(echoFrame, source);
            }

            console.log(`Echoed message ${this.messageCount} back to ${source.host}:${source.port}`);
          }
        } catch (error) {
          console.error('Error processing frame:', error);
        }
      });

      // Start HTTP server
      this.server.listen(this.config.port, () => {
        console.log(`Echo peer listening on port ${this.config.port}`);
        console.log(`Transport: ${this.config.transport}`);
        console.log(`Health check: http://localhost:${this.config.port}/health`);
        console.log(`Echo endpoint: http://localhost:${this.config.port}/echo`);
        console.log(`WebSocket: ws://localhost:${this.config.port}`);
        
        if (this.config.enableLossyMode) {
          console.log('⚠️  Lossy mode enabled - simulating packet loss and bit errors');
        }
      });
    } catch (error) {
      console.error('Failed to start echo peer:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(async () => {
        if (this.transport.close) {
          await this.transport.close();
        }
        console.log('Echo peer stopped');
        resolve();
      });
    });
  }

  getStats(): { messageCount: number; transport: string } {
    return {
      messageCount: this.messageCount,
      transport: this.config.transport,
    };
  }
}

// Start the echo peer if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const config: EchoPeerConfig = {
    port: parseInt(process.env.PORT || '9999'),
    gatewayUrl: process.env.GATEWAY_URL || 'http://localhost:8080',
    transport: (process.env.TRANSPORT as 'ws' | 'udp' | 'audio') || 'ws',
    enableLossyMode: process.env.DEMO_LOSSY === 'true',
  };

  const echoPeer = new EchoPeer(config);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down echo peer...');
    await echoPeer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Shutting down echo peer...');
    await echoPeer.stop();
    process.exit(0);
  });

  echoPeer.start().catch((error) => {
    console.error('Failed to start echo peer:', error);
    process.exit(1);
  });
}
