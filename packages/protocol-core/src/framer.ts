import { nanoid } from 'nanoid';
import { Frame, Framer, FramingOptions } from './types';
import { CRC32 } from './crc';

export class FramerV1 implements Framer {
  name = 'framer-v1';
  private static readonly MAGIC = 0x474C494E; // 'GLIN' in ASCII
  private static readonly VERSION = 1;
  private static readonly HEADER_SIZE = 13; // magic(4) + version(1) + length(4) + msgId(4)
  private static readonly CRC_SIZE = 4;
  private static readonly CHUNK_HEADER_SIZE = 2; // chunkIndex(1) + totalChunks(1)

  frame(msgId: string, payload: Uint8Array, options: FramingOptions = {}): Uint8Array[] {
    const maxFrameSize = options.maxFrameSize || 1500;
    const enableChunking = options.enableChunking !== false;
    
    const msgIdBytes = this.stringToBytes(msgId);
    const payloadWithMsgId = new Uint8Array(msgIdBytes.length + payload.length);
    payloadWithMsgId.set(msgIdBytes);
    payloadWithMsgId.set(payload, msgIdBytes.length);
    
    const crc = CRC32.calculate(payloadWithMsgId);
    
    if (!enableChunking || payloadWithMsgId.length <= maxFrameSize - FramerV1.HEADER_SIZE - FramerV1.CRC_SIZE) {
      // Single frame
      const frame = this.createFrame(payloadWithMsgId, crc);
      return [frame];
    }
    
    // Multiple frames with chunking
    const chunkSize = maxFrameSize - FramerV1.HEADER_SIZE - FramerV1.CRC_SIZE - FramerV1.CHUNK_HEADER_SIZE;
    const chunks: Uint8Array[] = [];
    const totalChunks = Math.ceil(payloadWithMsgId.length / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, payloadWithMsgId.length);
      const chunk = payloadWithMsgId.slice(start, end);
      
      const frame = this.createChunkedFrame(chunk, crc, i, totalChunks);
      chunks.push(frame);
    }
    
    return chunks;
  }

  deframe(bytes: Uint8Array): Frame | null {
    if (bytes.length < FramerV1.HEADER_SIZE + FramerV1.CRC_SIZE) {
      return null;
    }
    
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    
    // Check magic
    const magic = view.getUint32(0, false);
    if (magic !== FramerV1.MAGIC) {
      return null;
    }
    
    // Check version
    const version = view.getUint8(4);
    if (version !== FramerV1.VERSION) {
      return null;
    }
    
    // Get length
    const length = view.getUint32(5, false);
    
    // Extract msgId (first 4 bytes of payload)
    const msgIdBytes = bytes.slice(FramerV1.HEADER_SIZE, FramerV1.HEADER_SIZE + 4);
    const msgId = this.bytesToString(msgIdBytes);
    
    // Extract actual payload (remaining bytes after msgId)
    const payload = bytes.slice(FramerV1.HEADER_SIZE + 4, FramerV1.HEADER_SIZE + length);
    
    // Check CRC
    const expectedCrc = view.getUint32(bytes.length - FramerV1.CRC_SIZE, false);
    const payloadWithMsgId = new Uint8Array(4 + payload.length);
    payloadWithMsgId.set(msgIdBytes);
    payloadWithMsgId.set(payload);
    
    if (!CRC32.verify(payloadWithMsgId, expectedCrc)) {
      return null;
    }
    
    const frame: Frame = {
      magic,
      version,
      length,
      msgId,
      payload,
      crc32: expectedCrc,
    };
    
    // Check if this is a chunked frame
    if (bytes.length >= FramerV1.HEADER_SIZE + FramerV1.CRC_SIZE + FramerV1.CHUNK_HEADER_SIZE) {
      const chunkIndex = view.getUint8(FramerV1.HEADER_SIZE + length);
      const totalChunks = view.getUint8(FramerV1.HEADER_SIZE + length + 1);
      frame.chunkIndex = chunkIndex;
      frame.totalChunks = totalChunks;
    }
    
    return frame;
  }

  private createFrame(payload: Uint8Array, crc: number): Uint8Array {
    const frame = new Uint8Array(FramerV1.HEADER_SIZE + payload.length + FramerV1.CRC_SIZE);
    const view = new DataView(frame.buffer);
    
    // Write header
    view.setUint32(0, FramerV1.MAGIC, false);
    view.setUint8(4, FramerV1.VERSION);
    view.setUint32(5, payload.length, false);
    
    // Write payload
    frame.set(payload, FramerV1.HEADER_SIZE);
    
    // Write CRC
    view.setUint32(frame.length - FramerV1.CRC_SIZE, crc, false);
    
    return frame;
  }

  private createChunkedFrame(payload: Uint8Array, crc: number, chunkIndex: number, totalChunks: number): Uint8Array {
    const frame = new Uint8Array(FramerV1.HEADER_SIZE + payload.length + FramerV1.CRC_SIZE + FramerV1.CHUNK_HEADER_SIZE);
    const view = new DataView(frame.buffer);
    
    // Write header
    view.setUint32(0, FramerV1.MAGIC, false);
    view.setUint8(4, FramerV1.VERSION);
    view.setUint32(5, payload.length, false);
    
    // Write payload
    frame.set(payload, FramerV1.HEADER_SIZE);
    
    // Write chunk info
    view.setUint8(FramerV1.HEADER_SIZE + payload.length, chunkIndex);
    view.setUint8(FramerV1.HEADER_SIZE + payload.length + 1, totalChunks);
    
    // Write CRC
    view.setUint32(frame.length - FramerV1.CRC_SIZE, crc, false);
    
    return frame;
  }

  private stringToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  private bytesToString(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
  }
}

export class ChunkedFrameReassembler {
  private chunks = new Map<string, Map<number, Uint8Array>>();
  private timestamps = new Map<string, number>();
  private readonly timeout = 30000; // 30 seconds

  addChunk(msgId: string, chunkIndex: number, totalChunks: number, payload: Uint8Array): Uint8Array | null {
    const now = Date.now();
    
    // Clean up old chunks
    this.cleanup(now);
    
    // Initialize chunk map for this message
    if (!this.chunks.has(msgId)) {
      this.chunks.set(msgId, new Map());
      this.timestamps.set(msgId, now);
    }
    
    // Add chunk
    this.chunks.get(msgId)!.set(chunkIndex, payload);
    
    // Check if we have all chunks
    if (this.chunks.get(msgId)!.size === totalChunks) {
      // Reassemble
      const reassembled = this.reassemble(msgId, totalChunks);
      
      // Clean up
      this.chunks.delete(msgId);
      this.timestamps.delete(msgId);
      
      return reassembled;
    }
    
    return null;
  }

  private reassemble(msgId: string, totalChunks: number): Uint8Array {
    const chunkMap = this.chunks.get(msgId)!;
    const totalSize = Array.from(chunkMap.values()).reduce((sum, chunk) => sum + chunk.length, 0);
    const reassembled = new Uint8Array(totalSize);
    
    let offset = 0;
    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunkMap.get(i);
      if (!chunk) {
        throw new Error(`Missing chunk ${i} for message ${msgId}`);
      }
      reassembled.set(chunk, offset);
      offset += chunk.length;
    }
    
    return reassembled;
  }

  private cleanup(now: number): void {
    for (const [msgId, timestamp] of this.timestamps.entries()) {
      if (now - timestamp > this.timeout) {
        this.chunks.delete(msgId);
        this.timestamps.delete(msgId);
      }
    }
  }
}
