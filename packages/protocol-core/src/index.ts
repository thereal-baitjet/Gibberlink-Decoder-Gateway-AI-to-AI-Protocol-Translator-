// Types
export * from './types';

// Core implementations
export { CRC32 } from './crc';
export { 
  MessagePackCodec, 
  CBORCodec, 
  JSONCodec, 
  CompressedCodec,
  codecs 
} from './codec';
export { 
  FramerV1, 
  ChunkedFrameReassembler 
} from './framer';
export { 
  NoOpFEC, 
  StubReedSolomonFEC, 
  SimulatedLossFEC,
  fecImplementations 
} from './fec';
export { HandshakeManager } from './handshake';

// Protocol processor
export class ProtocolProcessor {
  constructor(
    private codec: any,
    private framer: any,
    private fec: any
  ) {}

  async encode(msgId: string, payload: unknown, options: any = {}): Promise<Uint8Array[]> {
    // Encode payload
    const encoded = await this.codec.encode(payload);
    
    // Apply FEC
    const fecEncoded = this.fec.encode(encoded);
    
    // Frame the data
    return this.framer.frame(msgId, fecEncoded, options);
  }

  async decode(frames: Uint8Array[]): Promise<{ msgId: string; payload: unknown } | null> {
    if (frames.length === 0) {
      return null;
    }

    // Deframe (handle chunking if needed)
    const reassembler = new (await import('./framer')).ChunkedFrameReassembler();
    let reassembledData: Uint8Array | null = null;

    for (const frame of frames) {
      const deframed = this.framer.deframe(frame);
      if (!deframed) {
        continue;
      }

      if (deframed.chunkIndex !== undefined && deframed.totalChunks !== undefined) {
        // Chunked frame
        reassembledData = reassembler.addChunk(
          deframed.msgId,
          deframed.chunkIndex,
          deframed.totalChunks,
          deframed.payload
        );
      } else {
        // Single frame
        reassembledData = deframed.payload;
      }

      if (reassembledData) {
        break;
      }
    }

    if (!reassembledData) {
      return null;
    }

    // Apply FEC decoding
    const fecDecoded = this.fec.decode(reassembledData);
    if (!fecDecoded) {
      return null;
    }

    // Decode payload
    const payload = await this.codec.decode(fecDecoded);

    // Extract msgId from first frame
    const firstFrame = this.framer.deframe(frames[0]);
    const msgId = firstFrame?.msgId || 'unknown';

    return { msgId, payload };
  }
}
