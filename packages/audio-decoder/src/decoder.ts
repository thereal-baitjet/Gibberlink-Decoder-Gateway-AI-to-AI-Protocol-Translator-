import { 
  AudioDecoder, 
  AudioStats, 
  AudioProcessingConfig, 
  AudioChunk,
  AudioFrame,
  FrequencyBin
} from './types';
import { FFTAnalyzer } from './fft';
import { RealFSKCodec } from './realFSKCodec';
import { FramerV1, JSONCodec } from '@gibberlink/protocol-core';
import { EventEmitter } from 'events';

export class AudioDecoderImpl extends EventEmitter implements AudioDecoder {
  private config: AudioProcessingConfig;
  private fftAnalyzer: FFTAnalyzer;
  private codec: RealFSKCodec;
  private framer: FramerV1;
  private codecProcessor: JSONCodec;
  private stats: AudioStats;
  private frameCallback?: (frame: AudioFrame) => void;
  private ringBuffer: Float32Array;
  private bufferIndex: number = 0;
  private lastFrameTime: number = 0;
  private capture: any;
  private isCapturing: boolean = false;

  constructor(config: AudioProcessingConfig) {
    super();
    this.config = config;
    this.fftAnalyzer = new FFTAnalyzer(config.sampleRate, config.windowSize, config.overlap);
    this.codec = new RealFSKCodec(config);
    this.framer = new FramerV1();
    this.codecProcessor = new JSONCodec();
    
    this.stats = {
      totalChunks: 0,
      totalFrames: 0,
      averageSnr: 0,
      errorRate: 0,
      lastFrameTime: 0
    };

    // Ring buffer for overlapping processing
    this.ringBuffer = new Float32Array(config.windowSize * 2);
  }

  async startCapture(deviceId?: string): Promise<void> {
    if (this.isCapturing) {
      return;
    }

    try {
      const { NodeAudioCapture } = await import('./capture');
      this.capture = new NodeAudioCapture({
        sampleRate: this.config.sampleRate,
        channels: 1,
        bitDepth: 16,
        chunkSize: this.config.windowSize,
        device: deviceId
      });

      this.capture.onChunk((chunk: AudioChunk) => {
        this.processAudioChunk(chunk);
      });

      await this.capture.start();
      this.isCapturing = true;
      this.emit('started');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async stopCapture(): Promise<void> {
    if (!this.isCapturing) {
      return;
    }

    try {
      if (this.capture) {
        await this.capture.stop();
        this.capture = null;
      }
      this.isCapturing = false;
      this.emit('stopped');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async processAudioChunk(chunk: AudioChunk): Promise<void> {
    // Process the audio chunk and emit frames
    const frames = await this.decodeChunk(chunk.pcm);
    
    for (const frameData of frames) {
      // Create frame object
      const frame: AudioFrame = {
        data: frameData,
        timestamp: Date.now(),
        snrDb: this.stats.averageSnr,
        source: { protocol: 'audio', host: 'localhost', port: 0 }
      };

      // Emit frame event
      this.emit('frame', frame);
      
      if (this.frameCallback) {
        this.frameCallback(frame);
      }
    }
  }

  async decodeChunk(pcm: Float32Array): Promise<Uint8Array[]> {
    this.stats.totalChunks++;
    const frames: Uint8Array[] = [];

    // Add to ring buffer
    for (let i = 0; i < pcm.length; i++) {
      this.ringBuffer[this.bufferIndex] = pcm[i];
      this.bufferIndex = (this.bufferIndex + 1) % this.ringBuffer.length;
    }

    // Process overlapping windows
    const stepSize = Math.floor(this.config.windowSize * (1 - this.config.overlap));
    let offset = 0;

    while (offset + this.config.windowSize <= this.ringBuffer.length) {
      // Extract window
      const window = new Float32Array(this.config.windowSize);
      for (let i = 0; i < this.config.windowSize; i++) {
        const bufferIndex = (offset + i) % this.ringBuffer.length;
        window[i] = this.ringBuffer[bufferIndex];
      }

      // Check for silence
      const rms = this.calculateRMS(window);
      if (rms < this.config.silenceThreshold) {
        offset += stepSize;
        continue;
      }

      // Perform spectral analysis
      const frequencyBins = this.fftAnalyzer.analyze(window);
      const peakFrequencies = this.fftAnalyzer.findPeakFrequencies(frequencyBins, this.config.noiseThreshold);

      // Calculate SNR
      const snr = this.calculateSNR(frequencyBins, peakFrequencies);

      // Decode using FSK codec
      const decodedFrames = this.codec.decode(window);

      for (const frame of decodedFrames) {
        if (frame.length > this.config.maxFrameSize) {
          console.warn(`Frame too large: ${frame.length} bytes`);
          continue;
        }

        try {
          // Try to deframe using protocol framer
          const deframed = this.framer.deframe(frame);
          if (deframed) {
            // Decode using protocol codec
            const decoded = await this.codecProcessor.decode(deframed.payload);
            if (decoded) {
              frames.push(decoded as Uint8Array);
              this.stats.totalFrames++;
              this.stats.lastFrameTime = Date.now();
              this.stats.averageSnr = (this.stats.averageSnr + snr) / 2;

              // Emit frame callback if registered
              if (this.frameCallback) {
                this.frameCallback({
                  data: decoded as Uint8Array,
                  timestamp: Date.now(),
                  snrDb: snr,
                  source: {
                    protocol: 'audio',
                    host: 'localhost',
                    port: 0
                  }
                });
              }
            }
          }
        } catch (error) {
          console.warn('Frame decode error:', error);
          this.stats.errorRate = (this.stats.errorRate + 1) / 2;
        }
      }

      offset += stepSize;
    }

    return frames;
  }

  reset(): void {
    this.stats = {
      totalChunks: 0,
      totalFrames: 0,
      averageSnr: 0,
      errorRate: 0,
      lastFrameTime: 0
    };
    this.bufferIndex = 0;
    this.ringBuffer.fill(0);
    this.codec = new RealFSKCodec(this.config);
  }

  getStats(): AudioStats {
    return { ...this.stats };
  }

  onFrame(callback: (frame: AudioFrame) => void): void {
    this.frameCallback = callback;
  }

  // Utility methods
  private calculateRMS(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  private calculateSNR(frequencyBins: FrequencyBin[], peakFrequencies: number[]): number {
    if (peakFrequencies.length === 0) {
      return 0;
    }

    // Calculate signal power at peak frequencies
    let signalPower = 0;
    for (const freq of peakFrequencies) {
      const bin = frequencyBins.find(b => Math.abs(b.frequency - freq) < 50);
      if (bin) {
        signalPower += bin.magnitude * bin.magnitude;
      }
    }

    // Calculate noise power (average of all bins)
    let noisePower = 0;
    for (const bin of frequencyBins) {
      noisePower += bin.magnitude * bin.magnitude;
    }
    noisePower = noisePower / frequencyBins.length;

    if (noisePower === 0) {
      return 0;
    }

    return 10 * Math.log10(signalPower / noisePower);
  }

  // Configuration methods
  setNoiseThreshold(threshold: number): void {
    this.config.noiseThreshold = threshold;
  }

  setSilenceThreshold(threshold: number): void {
    this.config.silenceThreshold = threshold;
  }

  setMaxFrameSize(size: number): void {
    this.config.maxFrameSize = size;
  }

  // Get current configuration
  getConfig(): AudioProcessingConfig {
    return { ...this.config };
  }

  async getDevices(): Promise<any[]> {
    try {
      // For now, return a mock device list
      // In a real implementation, this would query the system for audio devices
      return [
        { id: 'default', name: 'Default Microphone', type: 'input' },
        { id: 'builtin', name: 'Built-in Microphone', type: 'input' }
      ];
    } catch (error) {
      console.warn('Failed to get audio devices:', error);
      return [];
    }
  }
}
