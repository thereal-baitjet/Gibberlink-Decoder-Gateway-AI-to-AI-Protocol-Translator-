import { describe, it, expect } from 'vitest';
import { FramerV1, ChunkedFrameReassembler } from '../src/framer';

describe('FramerV1', () => {
  const framer = new FramerV1();

  describe('frame', () => {
    it('should create single frame for small payload', () => {
      const msgId = 'test123';
      const payload = new Uint8Array([1, 2, 3, 4, 5]);
      
      const frames = framer.frame(msgId, payload);
      
      expect(frames).toHaveLength(1);
      expect(frames[0].length).toBeGreaterThan(payload.length);
    });

    it('should create multiple frames for large payload', () => {
      const msgId = 'test123';
      const payload = new Uint8Array(2000); // Large payload
      payload.fill(1);
      
      const frames = framer.frame(msgId, payload, { maxFrameSize: 100 });
      
      expect(frames.length).toBeGreaterThan(1);
    });

    it('should handle chunking correctly', () => {
      const msgId = 'test123';
      const payload = new Uint8Array(1000);
      payload.fill(42);
      
      const frames = framer.frame(msgId, payload, { 
        maxFrameSize: 200,
        enableChunking: true 
      });
      
      expect(frames.length).toBeGreaterThan(1);
    });
  });

  describe('deframe', () => {
    it('should deframe single frame correctly', () => {
      const msgId = 'test123';
      const payload = new Uint8Array([1, 2, 3, 4, 5]);
      
      const frames = framer.frame(msgId, payload);
      const deframed = framer.deframe(frames[0]);
      
      expect(deframed).not.toBeNull();
      expect(deframed!.msgId).toBe(msgId);
      expect(deframed!.payload).toEqual(payload);
    });

    it('should return null for invalid frame', () => {
      const invalidFrame = new Uint8Array([1, 2, 3, 4, 5]); // Too short
      const deframed = framer.deframe(invalidFrame);
      
      expect(deframed).toBeNull();
    });

    it('should return null for wrong magic number', () => {
      const frame = new Uint8Array(100);
      frame.fill(0);
      const deframed = framer.deframe(frame);
      
      expect(deframed).toBeNull();
    });
  });
});

describe('ChunkedFrameReassembler', () => {
  const reassembler = new ChunkedFrameReassembler();

  it('should reassemble chunks correctly', () => {
    const msgId = 'test123';
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    
    // Add chunks in order
    const result1 = reassembler.addChunk(msgId, 0, 2, new Uint8Array([1, 2]));
    expect(result1).toBeNull(); // Not complete yet
    
    const result2 = reassembler.addChunk(msgId, 1, 2, new Uint8Array([3, 4, 5]));
    expect(result2).not.toBeNull();
    expect(result2).toEqual(payload);
  });

  it('should handle chunks out of order', () => {
    const msgId = 'test456';
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    
    // Add chunks out of order
    const result1 = reassembler.addChunk(msgId, 1, 2, new Uint8Array([3, 4, 5]));
    expect(result1).toBeNull();
    
    const result2 = reassembler.addChunk(msgId, 0, 2, new Uint8Array([1, 2]));
    expect(result2).not.toBeNull();
    expect(result2).toEqual(payload);
  });

  it('should handle missing chunks', () => {
    const msgId = 'test789';
    
    // Add only first chunk
    const result = reassembler.addChunk(msgId, 0, 3, new Uint8Array([1, 2]));
    expect(result).toBeNull();
    
    // Add third chunk (missing second)
    const result2 = reassembler.addChunk(msgId, 2, 3, new Uint8Array([5]));
    expect(result2).toBeNull();
  });
});
