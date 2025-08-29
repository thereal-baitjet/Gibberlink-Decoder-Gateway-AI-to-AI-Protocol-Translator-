import { AudioDecoder, AudioCapture, AudioFileReader, AudioProcessingConfig } from './types';
import { AudioDecoderImpl } from './decoder';
import { NodeAudioCapture, BrowserAudioCapture } from './capture';
import { AudioFileReaderImpl } from './file';

export function createAudioDecoder(config?: Partial<AudioProcessingConfig>): AudioDecoder {
  const defaultConfig: AudioProcessingConfig = {
    sampleRate: 48000,
    symbolRate: 250,
    tones: [1500, 1900, 2300, 2700], // 4-FSK tones
    windowSize: 1024,
    overlap: 0.5,
    noiseThreshold: 0.1,
    silenceThreshold: 0.01,
    maxFrameSize: 4096
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new AudioDecoderImpl(finalConfig);
}

export function createAudioCapture(environment: 'node' | 'browser' = 'node', config?: any): AudioCapture {
  if (environment === 'browser') {
    return new BrowserAudioCapture(config);
  } else {
    return new NodeAudioCapture(config);
  }
}

export function createAudioFileReader(): AudioFileReader {
  return new AudioFileReaderImpl();
}

// Preset configurations for different use cases
export const AudioPresets = {
  // High-quality audio processing
  highQuality: {
    sampleRate: 48000,
    symbolRate: 500,
    tones: [1500, 1900, 2300, 2700],
    windowSize: 2048,
    overlap: 0.75,
    noiseThreshold: 0.05,
    silenceThreshold: 0.005,
    maxFrameSize: 8192
  },

  // Low-latency processing
  lowLatency: {
    sampleRate: 16000,
    symbolRate: 125,
    tones: [1000, 1500, 2000, 2500],
    windowSize: 512,
    overlap: 0.25,
    noiseThreshold: 0.2,
    silenceThreshold: 0.02,
    maxFrameSize: 1024
  },

  // Noise-resistant processing
  noiseResistant: {
    sampleRate: 44100,
    symbolRate: 100,
    tones: [1200, 1800, 2400, 3000],
    windowSize: 4096,
    overlap: 0.5,
    noiseThreshold: 0.3,
    silenceThreshold: 0.05,
    maxFrameSize: 2048
  }
};

// Create decoder with preset configuration
export function createAudioDecoderWithPreset(preset: keyof typeof AudioPresets): AudioDecoder {
  return createAudioDecoder(AudioPresets[preset]);
}
