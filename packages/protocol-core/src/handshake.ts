import { nanoid } from 'nanoid';
import { Handshake, Features, Address } from './types';

export class HandshakeManager {
  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  negotiate(clientFeatures: Features, serverFeatures: Features): Handshake {
    const negotiated: Features = {
      compression: this.negotiateCompression(clientFeatures.compression, serverFeatures.compression),
      fec: this.negotiateBoolean(clientFeatures.fec, serverFeatures.fec),
      crypto: this.negotiateBoolean(clientFeatures.crypto, serverFeatures.crypto),
      maxMtu: this.negotiateMaxMtu(clientFeatures.maxMtu, serverFeatures.maxMtu),
    };

    const sessionId = nanoid();
    const expiresAt = new Date(Date.now() + HandshakeManager.SESSION_TIMEOUT).toISOString();

    return {
      clientFeatures,
      serverFeatures,
      negotiated,
      sessionId,
      expiresAt,
    };
  }

  private negotiateCompression(client?: string, server?: string): 'zstd' | 'none' {
    if (client === 'zstd' && server === 'zstd') {
      return 'zstd';
    }
    return 'none';
  }

  private negotiateBoolean(client?: boolean, server?: boolean): boolean {
    return client === true && server === true;
  }

  private negotiateMaxMtu(client?: number, server?: number): number {
    if (!client || !server) {
      return 1500; // Default MTU
    }
    return Math.min(client, server);
  }

  validateHandshake(handshake: Handshake): boolean {
    // Check if session has expired
    const expiresAt = new Date(handshake.expiresAt);
    if (expiresAt.getTime() < Date.now()) {
      return false;
    }

    // Validate negotiated features
    if (handshake.negotiated.maxMtu && (handshake.negotiated.maxMtu < 64 || handshake.negotiated.maxMtu > 65535)) {
      return false;
    }

    return true;
  }

  parseAddress(addressString: string): Address {
    try {
      const url = new URL(addressString);
      
      let protocol: 'ws' | 'udp' | 'audio';
      switch (url.protocol) {
        case 'ws:':
        case 'wss:':
          protocol = 'ws';
          break;
        case 'udp:':
          protocol = 'udp';
          break;
        case 'audio:':
          protocol = 'audio';
          break;
        default:
          throw new Error(`Unsupported protocol: ${url.protocol}`);
      }

      return {
        protocol,
        host: url.hostname,
        port: parseInt(url.port) || this.getDefaultPort(protocol),
        path: url.pathname !== '/' ? url.pathname : undefined,
      };
    } catch (error) {
      throw new Error(`Invalid address format: ${addressString}`);
    }
  }

  private getDefaultPort(protocol: 'ws' | 'udp' | 'audio'): number {
    switch (protocol) {
      case 'ws':
        return 80;
      case 'udp':
        return 9999;
      case 'audio':
        return 44100;
      default:
        return 8080;
    }
  }

  formatAddress(address: Address): string {
    const protocol = address.protocol;
    const host = address.host;
    const port = address.port;
    const path = address.path || '';

    return `${protocol}://${host}:${port}${path}`;
  }
}
