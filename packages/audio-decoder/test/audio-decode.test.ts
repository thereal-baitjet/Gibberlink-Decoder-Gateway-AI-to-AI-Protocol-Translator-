import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createAudioDecoder, 
  createAudioDecoderWithPreset,
  AudioPresets,
  FFTAnalyzer,
  FSKCodec 
} from '../src';
import { FramerV1, JSONCodec } from '@gibberlink/protocol-core';

describe('Audio Decoder', () => {
  let decoder: any;

  beforeEach(() => {
    decoder = createAudioDecoder();
  });

  describe('FSK Codec', () => {
    it('should encode and decode simple payload', () => {
      const config = AudioPresets.lowLatency;
      const codec = new FSKCodec(config);
      
      const testPayload = new TextEncoder().encode('Hello World');
      const audio = codec.encode(testPayload);
      
      expect(audio).toBeInstanceOf(Float32Array);
      expect(audio.length).toBeGreaterThan(0);
      
      const decoded = codec.decode(audio);
      expect(decoded.length).toBeGreaterThan(0);
    });

    it('should handle different symbol rates', () => {
      const config = { ...AudioPresets.lowLatency, symbolRate: 500 };
      const codec = new FSKCodec(config);
      
      const testPayload = new TextEncoder().encode('Test');
      const audio = codec.encode(testPayload);
      
      expect(audio.length).toBeGreaterThan(0);
    });

    it('should provide codec statistics', () => {
      const config = AudioPresets.lowLatency;
      const codec = new FSKCodec(config);
      
      const stats = codec.getStats();
      expect(stats).toHaveProperty('symbolsDetected');
      expect(stats).toHaveProperty('bitErrorRate');
      expect(stats).toHaveProperty('frameErrorRate');
      expect(stats).toHaveProperty('signalStrength');
    });
  });

  describe('FFT Analyzer', () => {
    it('should analyze frequency bins correctly', () => {
      const analyzer = new FFTAnalyzer(48000, 1024, 0.5);
      
      // Create test signal with known frequencies
      const testSignal = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        testSignal[i] = Math.sin(2 * Math.PI * 1000 * i / 48000) * 0.5; // 1kHz tone
      }
      
      const bins = analyzer.analyze(testSignal);
      expect(bins.length).toBeGreaterThan(0);
      
      // Should detect the 1kHz tone
      const peakFrequencies = analyzer.findPeakFrequencies(bins, 0.1);
      expect(peakFrequencies.some(freq => Math.abs(freq - 1000) < 100)).toBe(true);
    });

    it('should handle different window sizes', () => {
      const analyzer = new FFTAnalyzer(48000, 512, 0.5);
      analyzer.setWindowSize(2048);
      
      const testSignal = new Float32Array(2048);
      for (let i = 0; i < 2048; i++) {
        testSignal[i] = Math.sin(2 * Math.PI * 2000 * i / 48000) * 0.3; // 2kHz tone
      }
      
      const bins = analyzer.analyze(testSignal);
      expect(bins.length).toBeGreaterThan(0);
    });
  });

  describe('Audio Decoder Integration', () => {
    it('should decode chunks and emit frames', () => {
      const config = AudioPresets.lowLatency;
      const decoder = createAudioDecoder(config);
      
      let frameReceived = false;
      decoder.onFrame((frame) => {
        frameReceived = true;
        expect(frame).toHaveProperty('data');
        expect(frame).toHaveProperty('timestamp');
        expect(frame).toHaveProperty('snrDb');
      });
      
      // Create test audio chunk
      const testChunk = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        testChunk[i] = Math.sin(2 * Math.PI * 1500 * i / 48000) * 0.1;
      }
      
      const frames = decoder.decodeChunk(testChunk);
      expect(Array.isArray(frames)).toBe(true);
    });

    it('should provide decoder statistics', () => {
      const stats = decoder.getStats();
      expect(stats).toHaveProperty('totalChunks');
      expect(stats).toHaveProperty('totalFrames');
      expect(stats).toHaveProperty('averageSnr');
      expect(stats).toHaveProperty('errorRate');
      expect(stats).toHaveProperty('lastFrameTime');
    });

    it('should reset decoder state', () => {
      // Process some chunks
      const testChunk = new Float32Array(1024);
      decoder.decodeChunk(testChunk);
      
      const statsBefore = decoder.getStats();
      expect(statsBefore.totalChunks).toBeGreaterThan(0);
      
      decoder.reset();
      
      const statsAfter = decoder.getStats();
      expect(statsAfter.totalChunks).toBe(0);
      expect(statsAfter.totalFrames).toBe(0);
    });
  });

  describe('Preset Configurations', () => {
    it('should create decoder with high quality preset', () => {
      const decoder = createAudioDecoderWithPreset('highQuality');
      const config = decoder.getConfig();
      
      expect(config.sampleRate).toBe(48000);
      expect(config.symbolRate).toBe(500);
      expect(config.windowSize).toBe(2048);
    });

    it('should create decoder with low latency preset', () => {
      const decoder = createAudioDecoderWithPreset('lowLatency');
      const config = decoder.getConfig();
      
      expect(config.sampleRate).toBe(16000);
      expect(config.symbolRate).toBe(125);
      expect(config.windowSize).toBe(512);
    });

    it('should create decoder with noise resistant preset', () => {
      const decoder = createAudioDecoderWithPreset('noiseResistant');
      const config = decoder.getConfig();
      
      expect(config.sampleRate).toBe(44100);
      expect(config.symbolRate).toBe(100);
      expect(config.windowSize).toBe(4096);
    });
  });

  describe('Protocol Integration', () => {
    it('should decode protocol frames correctly', () => {
      const config = AudioPresets.lowLatency;
      const decoder = createAudioDecoder(config);
      
      // Create a test protocol frame
      const testData = new TextEncoder().encode(JSON.stringify({
        message: 'Test protocol message',
        timestamp: new Date().toISOString()
      }));
      
      const framer = new FramerV1();
      const codec = new JSONCodec();
      
      const encoded = codec.encode(testData);
      const framed = framer.frame(encoded);
      
      // Simulate audio encoding (simplified)
      const audioCodec = new FSKCodec(config);
      const audio = audioCodec.encode(framed);
      
      // Decode back
      const decodedFrames = audioCodec.decode(audio);
      expect(decodedFrames.length).toBeGreaterThan(0);
      
      // Try to deframe and decode
      for (const frame of decodedFrames) {
        try {
          const deframed = framer.deframe(frame);
          if (deframed) {
            const decoded = codec.decode(deframed);
            if (decoded) {
              const text = new TextDecoder().decode(decoded);
              const json = JSON.parse(text);
              expect(json.message).toBe('Test protocol message');
              return;
            }
          }
        } catch (error) {
          // Continue to next frame
        }
      }
      
      // If we get here, no valid frame was found
      expect.fail('No valid protocol frame was decoded');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty audio chunks', () => {
      const emptyChunk = new Float32Array(0);
      const frames = decoder.decodeChunk(emptyChunk);
      expect(frames).toEqual([]);
    });

    it('should handle silent audio chunks', () => {
      const silentChunk = new Float32Array(1024);
      const frames = decoder.decodeChunk(silentChunk);
      expect(Array.isArray(frames)).toBe(true);
    });

    it('should handle malformed audio data', () => {
      const malformedChunk = new Float32Array(1024);
      // Fill with random noise
      for (let i = 0; i < 1024; i++) {
        malformedChunk[i] = (Math.random() - 0.5) * 2;
      }
      
      const frames = decoder.decodeChunk(malformedChunk);
      expect(Array.isArray(frames)).toBe(true);
    });
  });
});
