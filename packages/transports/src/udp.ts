import * as dgram from 'dgram';
import { Transport, Address } from '@gibberlink/protocol-core';

export class UDPTransport implements Transport {
  name = 'udp';
  private socket?: dgram.Socket;
  private frameCallback?: (frame: Uint8Array, source: Address) => void;
  private bound = false;

  constructor(private port: number = 9999) {}

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket('udp4');

      this.socket.on('error', (error) => {
        console.error('UDP socket error:', error);
        reject(error);
      });

      this.socket.on('message', (msg, rinfo) => {
        if (this.frameCallback) {
          const source: Address = {
            protocol: 'udp',
            host: rinfo.address,
            port: rinfo.port,
          };
          this.frameCallback(msg, source);
        }
      });

      this.socket.bind(this.port, () => {
        console.log(`UDP server listening on port ${this.port}`);
        this.bound = true;
        resolve();
      });
    });
  }

  async send(frame: Uint8Array, target: Address): Promise<void> {
    if (!this.socket || !this.bound) {
      throw new Error('UDP socket not bound');
    }

    if (target.protocol !== 'udp') {
      throw new Error(`Invalid protocol for UDP transport: ${target.protocol}`);
    }

    return new Promise((resolve, reject) => {
      this.socket!.send(frame, target.port, target.host, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  onFrame(callback: (frame: Uint8Array, source: Address) => void): void {
    this.frameCallback = callback;
  }

  async close(): Promise<void> {
    if (this.socket) {
      this.socket.close();
      this.bound = false;
    }
  }

  getPort(): number {
    return this.port;
  }

  isBound(): boolean {
    return this.bound;
  }
}

export class UDPClientTransport implements Transport {
  name = 'udp-client';
  private socket?: dgram.Socket;
  private frameCallback?: (frame: Uint8Array, source: Address) => void;
  private bound = false;

  constructor(private localPort?: number) {}

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket('udp4');

      this.socket.on('error', (error) => {
        console.error('UDP client socket error:', error);
        reject(error);
      });

      this.socket.on('message', (msg, rinfo) => {
        if (this.frameCallback) {
          const source: Address = {
            protocol: 'udp',
            host: rinfo.address,
            port: rinfo.port,
          };
          this.frameCallback(msg, source);
        }
      });

      if (this.localPort) {
        this.socket.bind(this.localPort, () => {
          console.log(`UDP client bound to port ${this.localPort}`);
          this.bound = true;
          resolve();
        });
      } else {
        this.socket.bind(() => {
          const address = this.socket!.address();
          console.log(`UDP client bound to port ${address.port}`);
          this.bound = true;
          resolve();
        });
      }
    });
  }

  async send(frame: Uint8Array, target: Address): Promise<void> {
    if (!this.socket || !this.bound) {
      throw new Error('UDP client socket not bound');
    }

    if (target.protocol !== 'udp') {
      throw new Error(`Invalid protocol for UDP transport: ${target.protocol}`);
    }

    return new Promise((resolve, reject) => {
      this.socket!.send(frame, target.port, target.host, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  onFrame(callback: (frame: Uint8Array, source: Address) => void): void {
    this.frameCallback = callback;
  }

  async close(): Promise<void> {
    if (this.socket) {
      this.socket.close();
      this.bound = false;
    }
  }

  getLocalPort(): number | undefined {
    if (this.socket && this.bound) {
      return this.socket.address().port;
    }
    return undefined;
  }

  isBound(): boolean {
    return this.bound;
  }
}
