import { AudioFileReader, AudioChunk } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class AudioFileReaderImpl implements AudioFileReader {
  async readFile(filePath: string): Promise<AudioChunk[]> {
    const buffer = fs.readFileSync(filePath);
    return this.readBuffer(buffer);
  }

  async readBuffer(buffer: ArrayBuffer): Promise<AudioChunk[]> {
    const uint8Array = new Uint8Array(buffer);
    const fileExtension = this.getFileExtension(buffer);
    
    switch (fileExtension) {
      case 'wav':
        return this.decodeWAV(uint8Array);
      case 'mp3':
        return this.decodeMP3(uint8Array);
      default:
        throw new Error(`Unsupported audio format: ${fileExtension}`);
    }
  }

  async readBase64(base64: string): Promise<AudioChunk[]> {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return this.readBuffer(bytes.buffer);
  }

  private getFileExtension(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer);
    
    // Check for WAV header
    if (uint8Array.length >= 12) {
      const riff = String.fromCharCode(...uint8Array.slice(0, 4));
      const wave = String.fromCharCode(...uint8Array.slice(8, 12));
      if (riff === 'RIFF' && wave === 'WAVE') {
        return 'wav';
      }
    }
    
    // Check for MP3 header (ID3 or MPEG sync)
    if (uint8Array.length >= 3) {
      // ID3v2 header
      const id3 = String.fromCharCode(...uint8Array.slice(0, 3));
      if (id3 === 'ID3') {
        return 'mp3';
      }
      
      // MPEG sync word
      if ((uint8Array[0] === 0xFF) && ((uint8Array[1] & 0xE0) === 0xE0)) {
        return 'mp3';
      }
    }
    
    throw new Error('Unknown audio format');
  }

  private decodeWAV(uint8Array: Uint8Array): AudioChunk[] {
    const chunks: AudioChunk[] = [];
    
    // Parse WAV header
    const dataView = new DataView(uint8Array.buffer);
    
    // Check RIFF header
    const riff = String.fromCharCode(...uint8Array.slice(0, 4));
    if (riff !== 'RIFF') {
      throw new Error('Invalid WAV file: missing RIFF header');
    }
    
    // Check WAVE identifier
    const wave = String.fromCharCode(...uint8Array.slice(8, 12));
    if (wave !== 'WAVE') {
      throw new Error('Invalid WAV file: missing WAVE identifier');
    }
    
    // Find format chunk
    let formatChunkOffset = 12;
    let sampleRate = 44100;
    let channels = 1;
    let bitsPerSample = 16;
    
    while (formatChunkOffset < uint8Array.length - 8) {
      const chunkId = String.fromCharCode(...uint8Array.slice(formatChunkOffset, formatChunkOffset + 4));
      const chunkSize = dataView.getUint32(formatChunkOffset + 4, true);
      
      if (chunkId === 'fmt ') {
        const audioFormat = dataView.getUint16(formatChunkOffset + 8, true);
        if (audioFormat !== 1) {
          throw new Error('Unsupported WAV format: only PCM is supported');
        }
        
        channels = dataView.getUint16(formatChunkOffset + 10, true);
        sampleRate = dataView.getUint32(formatChunkOffset + 12, true);
        bitsPerSample = dataView.getUint16(formatChunkOffset + 22, true);
        break;
      }
      
      formatChunkOffset += 8 + chunkSize;
    }
    
    // Find data chunk
    let dataChunkOffset = 12;
    while (dataChunkOffset < uint8Array.length - 8) {
      const chunkId = String.fromCharCode(...uint8Array.slice(dataChunkOffset, dataChunkOffset + 4));
      const chunkSize = dataView.getUint32(dataChunkOffset + 4, true);
      
      if (chunkId === 'data') {
        const dataStart = dataChunkOffset + 8;
        const dataEnd = dataStart + chunkSize;
        const audioData = uint8Array.slice(dataStart, dataEnd);
        
        // Convert to Float32Array
        const pcm = this.convertToFloat32(audioData, bitsPerSample, channels);
        
        // Split into chunks
        const chunkSize = 1024;
        for (let i = 0; i < pcm.length; i += chunkSize) {
          const chunkPcm = pcm.slice(i, i + chunkSize);
          chunks.push({
            pcm: chunkPcm,
            timestamp: (i / sampleRate) * 1000,
            sampleRate
          });
        }
        break;
      }
      
      dataChunkOffset += 8 + chunkSize;
    }
    
    return chunks;
  }

  private decodeMP3(uint8Array: Uint8Array): AudioChunk[] {
    // For now, return a simple decoded chunk
    // In a real implementation, you would use a proper MP3 decoder
    const sampleRate = 44100;
    const chunkSize = 1024;
    const pcm = new Float32Array(chunkSize);
    
    // Generate a simple tone as placeholder
    for (let i = 0; i < chunkSize; i++) {
      pcm[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1;
    }
    
    return [{
      pcm,
      timestamp: 0,
      sampleRate
    }];
  }

  private convertToFloat32(audioData: Uint8Array, bitsPerSample: number, channels: number): Float32Array {
    const dataView = new DataView(audioData.buffer);
    const samplesPerChannel = audioData.length / (bitsPerSample / 8) / channels;
    const float32Array = new Float32Array(samplesPerChannel);
    
    let sampleIndex = 0;
    for (let i = 0; i < audioData.length; i += (bitsPerSample / 8) * channels) {
      let sample = 0;
      
      if (bitsPerSample === 16) {
        sample = dataView.getInt16(i, true);
        sample = sample / 32768.0; // Normalize to [-1, 1]
      } else if (bitsPerSample === 24) {
        // Handle 24-bit samples
        const byte1 = dataView.getUint8(i);
        const byte2 = dataView.getUint8(i + 1);
        const byte3 = dataView.getUint8(i + 2);
        sample = ((byte3 << 16) | (byte2 << 8) | byte1) << 8 >> 8; // Sign extend
        sample = sample / 8388608.0; // Normalize to [-1, 1]
      } else if (bitsPerSample === 32) {
        sample = dataView.getFloat32(i, true);
      }
      
      // For mono, just use the sample
      // For stereo, average the channels
      if (channels === 1) {
        float32Array[sampleIndex] = sample;
      } else if (channels === 2) {
        const leftSample = sample;
        const rightSample = dataView.getInt16(i + 2, true) / 32768.0;
        float32Array[sampleIndex] = (leftSample + rightSample) / 2;
      }
      
      sampleIndex++;
    }
    
    return float32Array;
  }
}
