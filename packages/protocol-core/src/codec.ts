import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';
import * as cbor from 'cbor';
import { Codec } from './types';

export class MessagePackCodec implements Codec {
  name = 'msgpack';

  async encode(data: unknown): Promise<Uint8Array> {
    return msgpackEncode(data);
  }

  async decode(bytes: Uint8Array): Promise<unknown> {
    return msgpackDecode(bytes);
  }
}

export class CBORCodec implements Codec {
  name = 'cbor';

  async encode(data: unknown): Promise<Uint8Array> {
    return cbor.encode(data);
  }

  async decode(bytes: Uint8Array): Promise<unknown> {
    return cbor.decode(bytes);
  }
}

export class JSONCodec implements Codec {
  name = 'json';

  async encode(data: unknown): Promise<Uint8Array> {
    const json = JSON.stringify(data);
    return new TextEncoder().encode(json);
  }

  async decode(bytes: Uint8Array): Promise<unknown> {
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  }
}

export class CompressedCodec implements Codec {
  constructor(
    private baseCodec: Codec,
    private compression: 'zstd' | 'none' = 'none'
  ) {}

  get name(): string {
    return `${this.baseCodec.name}+${this.compression}`;
  }

  async encode(data: unknown): Promise<Uint8Array> {
    const encoded = this.baseCodec.encode(data);
    
    if (this.compression === 'zstd') {
      // zstd is not available, fallback to uncompressed
      console.warn('zstd compression not available, falling back to uncompressed');
      return encoded;
    }
    
    return encoded;
  }

  async decode(bytes: Uint8Array): Promise<unknown> {
    let decoded: Uint8Array;
    
    if (this.compression === 'zstd') {
      // zstd is not available, treat as uncompressed
      console.warn('zstd decompression not available, treating as uncompressed');
      decoded = bytes;
    } else {
      decoded = bytes;
    }
    
    return this.baseCodec.decode(decoded);
  }
}

export const codecs = {
  msgpack: new MessagePackCodec(),
  cbor: new CBORCodec(),
  json: new JSONCodec(),
  'msgpack+zstd': new CompressedCodec(new MessagePackCodec(), 'zstd'),
  'cbor+zstd': new CompressedCodec(new CBORCodec(), 'zstd'),
  'json+zstd': new CompressedCodec(new JSONCodec(), 'zstd'),
};
