import { WebSocket, WebSocketServer } from 'ws';
import { Transport, Address } from '@gibberlink/protocol-core';

export class WebSocketTransport implements Transport {
  name = 'websocket';
  private server?: WebSocketServer;
  private clients = new Map<string, WebSocket>();
  private frameCallback?: (frame: Uint8Array, source: Address) => void;

  constructor(private port: number = 8080) {}

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = new WebSocketServer({ port: this.port }, () => {
        console.log(`WebSocket server listening on port ${this.port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        console.error('WebSocket server error:', error);
        reject(error);
      });

      this.server.on('connection', (ws, req) => {
        const clientId = req.socket.remoteAddress || 'unknown';
        console.log(`WebSocket client connected: ${clientId}`);
        
        this.clients.set(clientId, ws);

        ws.on('message', (data) => {
          if (this.frameCallback && data instanceof Buffer) {
            const source: Address = {
              protocol: 'ws',
              host: req.socket.remoteAddress || 'unknown',
              port: req.socket.remotePort || 0,
            };
            this.frameCallback(data, source);
          }
        });

        ws.on('close', () => {
          console.log(`WebSocket client disconnected: ${clientId}`);
          this.clients.delete(clientId);
        });

        ws.on('error', (error) => {
          console.error(`WebSocket client error: ${clientId}`, error);
          this.clients.delete(clientId);
        });
      });
    });
  }

  async send(frame: Uint8Array, target: Address): Promise<void> {
    if (target.protocol !== 'ws') {
      throw new Error(`Invalid protocol for WebSocket transport: ${target.protocol}`);
    }

    const clientId = `${target.host}:${target.port}`;
    const client = this.clients.get(clientId);

    if (!client) {
      throw new Error(`WebSocket client not found: ${clientId}`);
    }

    if (client.readyState === WebSocket.OPEN) {
      client.send(frame);
    } else {
      throw new Error(`WebSocket client not ready: ${clientId}`);
    }
  }

  onFrame(callback: (frame: Uint8Array, source: Address) => void): void {
    this.frameCallback = callback;
  }

  async close(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.clients.clear();
    }
  }

  getConnectedClients(): string[] {
    return Array.from(this.clients.keys());
  }
}

export class WebSocketClientTransport implements Transport {
  name = 'websocket-client';
  private ws?: WebSocket;
  private frameCallback?: (frame: Uint8Array, source: Address) => void;
  private connected = false;

  constructor(private url: string) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log(`WebSocket client connected to ${this.url}`);
        this.connected = true;
        resolve();
      });

      this.ws.on('message', (data) => {
        if (this.frameCallback && data instanceof Buffer) {
          const source: Address = {
            protocol: 'ws',
            host: 'server',
            port: 0,
          };
          this.frameCallback(data, source);
        }
      });

      this.ws.on('close', () => {
        console.log(`WebSocket client disconnected from ${this.url}`);
        this.connected = false;
      });

      this.ws.on('error', (error) => {
        console.error(`WebSocket client error:`, error);
        reject(error);
      });
    });
  }

  async send(frame: Uint8Array, target: Address): Promise<void> {
    if (!this.ws || !this.connected) {
      throw new Error('WebSocket client not connected');
    }

    if (target.protocol !== 'ws') {
      throw new Error(`Invalid protocol for WebSocket transport: ${target.protocol}`);
    }

    this.ws.send(frame);
  }

  onFrame(callback: (frame: Uint8Array, source: Address) => void): void {
    this.frameCallback = callback;
  }

  async close(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
