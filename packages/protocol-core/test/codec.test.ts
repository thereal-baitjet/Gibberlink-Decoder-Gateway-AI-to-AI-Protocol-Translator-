import { describe, it, expect } from 'vitest';
import { MessagePackCodec, CBORCodec, JSONCodec, CompressedCodec } from '../src/codec';

describe('Codec', () => {
  const testData = {
    string: 'hello world',
    number: 42,
    boolean: true,
    null: null,
    array: [1, 2, 3],
    object: { a: 1, b: 2 },
    nested: { a: { b: { c: 'deep' } } },
  };

  describe('MessagePackCodec', () => {
    const codec = new MessagePackCodec();

    it('should encode and decode data correctly', () => {
      const encoded = codec.encode(testData);
      const decoded = codec.decode(encoded);
      
      expect(decoded).toEqual(testData);
    });

    it('should handle different data types', () => {
      const data = {
        string: 'test',
        number: 123.456,
        boolean: false,
        null: null,
        array: ['a', 'b', 'c'],
        object: { x: 1, y: 2 },
      };

      const encoded = codec.encode(data);
      const decoded = codec.decode(encoded);
      
      expect(decoded).toEqual(data);
    });
  });

  describe('JSONCodec', () => {
    const codec = new JSONCodec();

    it('should encode and decode data correctly', () => {
      const encoded = codec.encode(testData);
      const decoded = codec.decode(encoded);
      
      expect(decoded).toEqual(testData);
    });

    it('should handle Unicode strings', () => {
      const data = { message: 'Hello 世界 🌍' };
      const encoded = codec.encode(data);
      const decoded = codec.decode(encoded);
      
      expect(decoded).toEqual(data);
    });
  });

  describe('CBORCodec', () => {
    const codec = new CBORCodec();

    it('should encode and decode data correctly', async () => {
      const encoded = await codec.encode(testData);
      const decoded = await codec.decode(encoded);
      
      expect(decoded).toEqual(testData);
    });

    it('should handle binary data', async () => {
      const data = { binary: new Uint8Array([1, 2, 3, 4, 5]) };
      const encoded = await codec.encode(data);
      const decoded = await codec.decode(encoded);
      
      expect(decoded.binary).toEqual(data.binary);
    });
  });

  describe('CompressedCodec', () => {
    it('should work with no compression', async () => {
      const baseCodec = new JSONCodec();
      const codec = new CompressedCodec(baseCodec, 'none');

      const encoded = await codec.encode(testData);
      const decoded = await codec.decode(encoded);
      
      expect(decoded).toEqual(testData);
    });

    it('should have correct name', () => {
      const baseCodec = new JSONCodec();
      const codec = new CompressedCodec(baseCodec, 'zstd');
      
      expect(codec.name).toBe('json+zstd');
    });
  });
});
