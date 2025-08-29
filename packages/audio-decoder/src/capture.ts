import { AudioCapture, AudioChunk, AudioDevice } from './types';
import mic from 'mic';
import * as fs from 'fs';
import * as path from 'path';

export class NodeAudioCapture implements AudioCapture {
  private micInstance: any;
  private isRecording: boolean = false;
  private chunkCallback?: (chunk: AudioChunk) => void;
  private config: {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    chunkSize: number;
    device?: string;
  };

  constructor(config: {
    sampleRate?: number;
    channels?: number;
    bitDepth?: number;
    chunkSize?: number;
    device?: string;
  } = {}) {
    this.config = {
      sampleRate: config.sampleRate || 48000,
      channels: config.channels || 1,
      bitDepth: config.bitDepth || 16,
      chunkSize: config.chunkSize || 1024,
      device: config.device
    };
  }

  async start(): Promise<void> {
    if (this.isRecording) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.micInstance = mic({
          rate: this.config.sampleRate.toString(),
          channels: this.config.channels.toString(),
          fileType: 'raw',
          device: this.config.device,
          exitOnSilence: 0,
          bitwidth: this.config.bitDepth.toString()
        });

        const micInputStream = this.micInstance.getAudioStream();

        micInputStream.on('data', (data: Buffer) => {
          if (this.chunkCallback) {
            // Convert buffer to Float32Array
            const pcm = this.bufferToFloat32(data);
            const chunk: AudioChunk = {
              pcm,
              timestamp: Date.now(),
              sampleRate: this.config.sampleRate
            };
            this.chunkCallback(chunk);
          }
        });

        micInputStream.on('error', (error: Error) => {
          console.error('Microphone stream error:', error);
          reject(error);
        });

        micInputStream.on('startComplete', () => {
          this.isRecording = true;
          resolve();
        });

        this.micInstance.start();
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    return new Promise((resolve) => {
      if (this.micInstance) {
        this.micInstance.stop();
        this.micInstance = null;
      }
      this.isRecording = false;
      resolve();
    });
  }

  onChunk(callback: (chunk: AudioChunk) => void): void {
    this.chunkCallback = callback;
  }

  async getDevices(): Promise<AudioDevice[]> {
    // Return mock devices for now
    return [
      {
        id: 'default',
        name: 'Default Microphone',
        type: 'input' as const,
        sampleRates: [8000, 16000, 22050, 44100, 48000],
        channels: 1
      },
      {
        id: 'external',
        name: 'External USB Microphone',
        type: 'input' as const,
        sampleRates: [8000, 16000, 22050, 44100, 48000],
        channels: 1
      },
      {
        id: 'bluetooth',
        name: 'Bluetooth Headset',
        type: 'input' as const,
        sampleRates: [8000, 16000, 22050, 44100, 48000],
        channels: 1
      }
    ];
  }

  async setDevice(deviceId: string): Promise<void> {
    this.config.device = deviceId;
    // Restart capture if currently recording
    if (this.isRecording) {
      await this.stop();
      await this.start();
    }
  }

  private bufferToFloat32(buffer: Buffer): Float32Array {
    const float32Array = new Float32Array(buffer.length / 2);
    
    for (let i = 0; i < buffer.length; i += 2) {
      const int16 = buffer.readInt16LE(i);
      float32Array[i / 2] = int16 / 32768.0; // Normalize to [-1, 1]
    }
    
    return float32Array;
  }

  getRecordingStatus(): boolean {
    return this.isRecording;
  }
}

// Browser-compatible audio capture using Web Audio API
// Note: This is a placeholder for browser implementation
// In a real implementation, you would need proper browser type definitions
export class BrowserAudioCapture implements AudioCapture {
  private isRecording: boolean = false;
  private chunkCallback?: (chunk: AudioChunk) => void;
  private config: {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    chunkSize: number;
  };

  constructor(config: {
    sampleRate?: number;
    channels?: number;
    bitDepth?: number;
    chunkSize?: number;
  } = {}) {
    this.config = {
      sampleRate: config.sampleRate || 48000,
      channels: config.channels || 1,
      bitDepth: config.bitDepth || 16,
      chunkSize: config.chunkSize || 1024
    };
  }

  async start(): Promise<void> {
    if (this.isRecording) {
      return;
    }
    this.isRecording = true;
    console.log('Browser audio capture started (placeholder)');
  }

  async stop(): Promise<void> {
    if (!this.isRecording) {
      return;
    }
    this.isRecording = false;
    console.log('Browser audio capture stopped (placeholder)');
  }

  onChunk(callback: (chunk: AudioChunk) => void): void {
    this.chunkCallback = callback;
  }

  async getDevices(): Promise<AudioDevice[]> {
    // Return mock devices for now
    return [
      {
        id: 'default',
        name: 'Default Microphone',
        type: 'input' as const,
        sampleRates: [8000, 16000, 22050, 44100, 48000],
        channels: 1
      }
    ];
  }

  async setDevice(deviceId: string): Promise<void> {
    console.log(`Device set to: ${deviceId} (placeholder)`);
  }
}
