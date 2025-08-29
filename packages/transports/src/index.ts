// WebSocket transports
import { WebSocketTransport, WebSocketClientTransport } from './ws';
export { WebSocketTransport, WebSocketClientTransport } from './ws';

// UDP transports
import { UDPTransport, UDPClientTransport } from './udp';
export { UDPTransport, UDPClientTransport } from './udp';

// Audio transports
import { 
  AudioTransport, 
  AudioLoopbackSimulator,
  AudioModem,
  GGWaveModem 
} from './audio';
export { 
  AudioTransport, 
  AudioLoopbackSimulator,
  AudioModem,
  GGWaveModem 
} from './audio';

// Transport factory
export class TransportFactory {
  static createTransport(type: 'ws' | 'udp' | 'audio', options: any = {}): any {
    switch (type) {
      case 'ws':
        return new WebSocketTransport(options.port || 8080);
      case 'udp':
        return new UDPTransport(options.port || 9999);
      case 'audio':
        return new AudioTransport(options.port || 44100);
      default:
        throw new Error(`Unsupported transport type: ${type}`);
    }
  }

  static createClientTransport(type: 'ws' | 'udp' | 'audio', options: any = {}): any {
    switch (type) {
      case 'ws':
        return new WebSocketClientTransport(options.url || 'ws://localhost:8080');
      case 'udp':
        return new UDPClientTransport(options.localPort);
      case 'audio':
        return new AudioTransport(options.port || 44100);
      default:
        throw new Error(`Unsupported transport type: ${type}`);
    }
  }
}
