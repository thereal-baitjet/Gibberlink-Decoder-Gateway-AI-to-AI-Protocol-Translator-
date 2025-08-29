import { Address } from '@gibberlink/protocol-core';

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  chunkSize: number;
}

export interface AudioChunk {
  pcm: Float32Array;
  timestamp: number;
  sampleRate: number;
}

export interface AudioFrame {
  data: Uint8Array;
  timestamp: number;
  snrDb: number;
  rssi?: number;
  fer?: number;
  source: Address;
}

export interface AudioDecoder {
  decodeChunk(pcm: Float32Array): Promise<Uint8Array[]>;
  reset(): void;
  getStats(): AudioStats;
}

export interface AudioStats {
  totalChunks: number;
  totalFrames: number;
  averageSnr: number;
  errorRate: number;
  lastFrameTime: number;
}

export interface AudioCapture {
  start(): Promise<void>;
  stop(): Promise<void>;
  onChunk(callback: (chunk: AudioChunk) => void): void;
  getDevices(): Promise<AudioDevice[]>;
  setDevice(deviceId: string): Promise<void>;
}

export interface AudioDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
  sampleRates: number[];
  channels: number;
}

export interface AudioFileReader {
  readFile(filePath: string): Promise<AudioChunk[]>;
  readBuffer(buffer: ArrayBuffer): Promise<AudioChunk[]>;
  readBase64(base64: string): Promise<AudioChunk[]>;
}

export interface SpectrogramAnalyzer {
  analyze(pcm: Float32Array): FrequencyBin[];
  setWindowSize(size: number): void;
  setOverlap(overlap: number): void;
}

export interface FrequencyBin {
  frequency: number;
  magnitude: number;
  phase: number;
  timestamp: number;
}

export interface MockGgwaveCodec {
  encode(payload: Uint8Array): Float32Array;
  decode(pcm: Float32Array): Uint8Array[];
  setSymbolRate(rate: number): void;
  setTones(tones: number[]): void;
  getStats(): CodecStats;
}

export interface CodecStats {
  symbolsDetected: number;
  symbolsCorrected: number;
  bitErrorRate: number;
  frameErrorRate: number;
  signalStrength: number;
}

export interface AudioProcessingConfig {
  sampleRate: number;
  symbolRate: number;
  tones: number[];
  windowSize: number;
  overlap: number;
  noiseThreshold: number;
  silenceThreshold: number;
  maxFrameSize: number;
}

export interface AudioDecodeResult {
  msgIds: string[];
  transcripts: any[];
  stats: AudioStats;
  errors: string[];
}
