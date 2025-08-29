import { EventEmitter } from 'events';
import { createAudioDecoder, AudioPresets, AudioProcessingConfig } from '@gibberlink/audio-decoder';
import { createEnglishizer } from '@gibberlink/englishizer';
import { FramerV1, JSONCodec } from '@gibberlink/protocol-core';

export interface AudioToPlainConfig {
  preset?: keyof typeof AudioPresets;
  customConfig?: Partial<AudioProcessingConfig>;
  enableRedaction?: boolean;
  enableGlossary?: boolean;
  maxLatencyMs?: number;
}

export interface AudioFrame {
  msgId: string;
  payload: Uint8Array;
  timestamp: number;
  snrDb: number;
  lockPct: number;
  crcValid: boolean;
  frameIndex?: number;
  totalFrames?: number;
}

export interface PlainEnglishResult {
  msgId: string;
  text: string;
  confidence: number;
  glossary?: Record<string, string>;
  redactions?: string[];
  snrDb: number;
  lockPct: number;
  startedAt: number;
  endedAt: number;
  latencyMs: number;
}

export interface AudioToPlainMetrics {
  framesReceived: number;
  framesDecoded: number;
  messagesTranslated: number;
  averageLatencyMs: number;
  averageSnrDb: number;
  averageConfidence: number;
  crcFailures: number;
}

export class AudioToPlainPipeline extends EventEmitter {
  private audioDecoder: any;
  private englishizer: any;
  private framer: FramerV1;
  private codec: JSONCodec;
  private isRunning: boolean = false;
  private frameBuffer: Map<string, AudioFrame[]> = new Map();
  private metrics: AudioToPlainMetrics = {
    framesReceived: 0,
    framesDecoded: 0,
    messagesTranslated: 0,
    averageLatencyMs: 0,
    averageSnrDb: 0,
    averageConfidence: 0,
    crcFailures: 0
  };
  private config: AudioToPlainConfig;

  constructor(config: AudioToPlainConfig = {}) {
    super();
    this.config = {
      preset: 'lowLatency',
      enableRedaction: true,
      enableGlossary: true,
      maxLatencyMs: 300,
      ...config
    };

    // Initialize components
    const audioConfig = this.config.customConfig || AudioPresets[this.config.preset!];
    this.audioDecoder = createAudioDecoder(audioConfig);
    this.englishizer = createEnglishizer({
      includeGlossary: this.config.enableGlossary,
      includeSourceMapping: false
    });
    this.framer = new FramerV1();
    this.codec = new JSONCodec();

    // Set up audio decoder event handlers
    this.setupAudioDecoder();
  }

  private setupAudioDecoder(): void {
    this.audioDecoder.on('frame', async (frame: AudioFrame) => {
      await this.processFrame(frame);
    });

    this.audioDecoder.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this.audioDecoder.on('stats', (stats: any) => {
      this.emit('stats', stats);
    });
  }

  private async processFrame(frame: AudioFrame): Promise<void> {
    this.metrics.framesReceived++;
    
    try {
      // Update metrics
      this.metrics.averageSnrDb = this.updateAverage(
        this.metrics.averageSnrDb, 
        frame.snrDb, 
        this.metrics.framesReceived
      );

      // Track CRC failures
      if (!frame.crcValid) {
        this.metrics.crcFailures++;
        this.emit('crcFailure', frame);
        return;
      }

      this.metrics.framesDecoded++;

      // Handle multipart frames
      if (frame.frameIndex !== undefined && frame.totalFrames !== undefined) {
        await this.handleMultipartFrame(frame);
      } else {
        // Single frame message
        await this.processCompleteMessage([frame]);
      }

    } catch (error) {
      this.emit('error', new Error(`Frame processing failed: ${error}`));
    }
  }

  private async handleMultipartFrame(frame: AudioFrame): Promise<void> {
    const msgId = frame.msgId;
    const frames = this.frameBuffer.get(msgId) || [];
    frames.push(frame);
    this.frameBuffer.set(msgId, frames);

    // Check if we have all frames
    if (frames.length === frame.totalFrames) {
      // Sort by frame index
      frames.sort((a, b) => (a.frameIndex || 0) - (b.frameIndex || 0));
      
      await this.processCompleteMessage(frames);
      
      // Clean up buffer
      this.frameBuffer.delete(msgId);
    }
  }

  private async processCompleteMessage(frames: AudioFrame[]): Promise<void> {
    const startTime = Date.now();
    const firstFrame = frames[0];
    const msgId = firstFrame.msgId;

    try {
      // Combine frame payloads
      const combinedPayload = this.combineFramePayloads(frames);
      
      // Decode using protocol stack
      const decoded = await this.decodePayload(combinedPayload);
      if (!decoded) {
        this.emit('decodeError', { msgId, error: 'Failed to decode payload' });
        return;
      }

      // Create gateway event for Englishizer
      const event = {
        kind: 'unknown',
        payload: decoded,
        meta: {
          msgId,
          transport: 'Audio',
          codec: 'JSON',
          ts: startTime,
          sessionId: 'audio-session'
        }
      };

      // Generate English translation
      const englishized = await this.englishizer.toPlainEnglish(event);
      
      // Calculate latency
      const endTime = Date.now();
      const latencyMs = endTime - startTime;

      // Create result
      const result: PlainEnglishResult = {
        msgId,
        text: englishized.text,
        confidence: englishized.confidence,
        glossary: englishized.glossary,
        redactions: englishized.redactions,
        snrDb: this.calculateAverageSnr(frames),
        lockPct: this.calculateAverageLock(frames),
        startedAt: startTime,
        endedAt: endTime,
        latencyMs
      };

      // Update metrics
      this.metrics.messagesTranslated++;
      this.metrics.averageLatencyMs = this.updateAverage(
        this.metrics.averageLatencyMs, 
        latencyMs, 
        this.metrics.messagesTranslated
      );
      this.metrics.averageConfidence = this.updateAverage(
        this.metrics.averageConfidence, 
        englishized.confidence, 
        this.metrics.messagesTranslated
      );

      // Emit results
      this.emit('plainEnglish', result);
      this.emit('metrics', this.metrics);

      // Check latency threshold
      if (latencyMs > (this.config.maxLatencyMs || 300)) {
        this.emit('latencyWarning', { msgId, latencyMs, threshold: this.config.maxLatencyMs });
      }

    } catch (error) {
      this.emit('error', new Error(`Message processing failed for ${msgId}: ${error}`));
    }
  }

  private combineFramePayloads(frames: AudioFrame[]): Uint8Array {
    const totalLength = frames.reduce((sum, frame) => sum + frame.payload.length, 0);
    const combined = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const frame of frames) {
      combined.set(frame.payload, offset);
      offset += frame.payload.length;
    }
    
    return combined;
  }

  private async decodePayload(payload: Uint8Array): Promise<any> {
    try {
      // Try to deframe first
      const deframed = this.framer.deframe(payload);
      if (deframed) {
        // Decode the payload
        return await this.codec.decode(deframed.payload);
      }
      
      // If deframing fails, try direct JSON decode
      const text = new TextDecoder().decode(payload);
      return JSON.parse(text);
      
    } catch (error) {
      console.warn('Payload decode failed:', error);
      return null;
    }
  }

  private calculateAverageSnr(frames: AudioFrame[]): number {
    return frames.reduce((sum, frame) => sum + frame.snrDb, 0) / frames.length;
  }

  private calculateAverageLock(frames: AudioFrame[]): number {
    return frames.reduce((sum, frame) => sum + frame.lockPct, 0) / frames.length;
  }

  private updateAverage(current: number, newValue: number, count: number): number {
    return (current * (count - 1) + newValue) / count;
  }

  public async startCapture(deviceId?: string): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      await this.audioDecoder.startCapture(deviceId);
      this.isRunning = true;
      this.emit('started');
    } catch (error) {
      this.emit('error', new Error(`Failed to start capture: ${error}`));
      throw error;
    }
  }

  public async stopCapture(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.audioDecoder.stopCapture();
      this.isRunning = false;
      this.emit('stopped');
    } catch (error) {
      this.emit('error', new Error(`Failed to stop capture: ${error}`));
      throw error;
    }
  }

  public getMetrics(): AudioToPlainMetrics {
    return { ...this.metrics };
  }

  public isCapturing(): boolean {
    return this.isRunning;
  }

  public async getDevices(): Promise<any[]> {
    return this.audioDecoder.getDevices();
  }

  public destroy(): void {
    this.stopCapture();
    this.removeAllListeners();
    this.frameBuffer.clear();
  }
}
