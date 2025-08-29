import { MockGgwaveCodec, CodecStats, AudioProcessingConfig } from './types';

export class FSKCodec implements MockGgwaveCodec {
  private config: AudioProcessingConfig;
  private symbolRate: number;
  private tones: number[];
  private sampleRate: number;
  private samplesPerSymbol: number;
  private stats: CodecStats;
  private preamble: number[];
  private syncSequence: number[];

  constructor(config: AudioProcessingConfig) {
    this.config = config;
    this.symbolRate = config.symbolRate;
    this.tones = config.tones;
    this.sampleRate = config.sampleRate;
    this.samplesPerSymbol = Math.floor(this.sampleRate / this.symbolRate);
    
    this.stats = {
      symbolsDetected: 0,
      symbolsCorrected: 0,
      bitErrorRate: 0,
      frameErrorRate: 0,
      signalStrength: 0
    };

    // Create preamble: alternating tones for 200ms
    this.preamble = [];
    const preambleSymbols = Math.floor(0.2 * this.symbolRate);
    for (let i = 0; i < preambleSymbols; i++) {
      this.preamble.push(i % 2 === 0 ? 0 : 2); // Alternate between first and third tone
    }

    // Barker-like sync sequence (13-chip)
    this.syncSequence = [1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1];
  }

  encode(payload: Uint8Array): Float32Array {
    const encodedSymbols: number[] = [];
    
    // Add preamble
    encodedSymbols.push(...this.preamble);
    
    // Add sync sequence
    encodedSymbols.push(...this.syncSequence);
    
    // Encode payload as 2-bit symbols (4-FSK)
    for (let i = 0; i < payload.length; i++) {
      const byte = payload[i];
      // Each byte becomes 4 symbols (2 bits per symbol)
      encodedSymbols.push(
        (byte >> 6) & 0x03, // First 2 bits
        (byte >> 4) & 0x03, // Next 2 bits
        (byte >> 2) & 0x03, // Next 2 bits
        byte & 0x03         // Last 2 bits
      );
    }

    // Convert symbols to audio samples
    const totalSamples = encodedSymbols.length * this.samplesPerSymbol;
    const audio = new Float32Array(totalSamples);
    
    for (let i = 0; i < encodedSymbols.length; i++) {
      const symbol = encodedSymbols[i];
      const tone = this.tones[symbol];
      const startSample = i * this.samplesPerSymbol;
      
      // Generate tone for this symbol duration
      for (let j = 0; j < this.samplesPerSymbol; j++) {
        const sampleIndex = startSample + j;
        if (sampleIndex < totalSamples) {
          // Apply raised-cosine windowing to reduce splatter
          const window = this.raisedCosineWindow(j, this.samplesPerSymbol);
          audio[sampleIndex] = Math.sin(2 * Math.PI * tone * j / this.sampleRate) * window * 0.3;
        }
      }
    }

    return audio;
  }

  decode(pcm: Float32Array): Uint8Array[] {
    const frames: Uint8Array[] = [];
    const symbols = this.detectSymbols(pcm);
    
    if (symbols.length === 0) {
      return frames;
    }

    // Find frame boundaries using preamble detection
    const frameBoundaries = this.findFrameBoundaries(symbols);
    
    for (const boundary of frameBoundaries) {
      const frameSymbols = symbols.slice(boundary.start, boundary.end);
      const payload = this.symbolsToBytes(frameSymbols);
      
      if (payload.length > 0) {
        frames.push(payload);
        this.stats.symbolsDetected += frameSymbols.length;
      }
    }

    return frames;
  }

  setSymbolRate(rate: number): void {
    this.symbolRate = rate;
    this.samplesPerSymbol = Math.floor(this.sampleRate / rate);
  }

  setTones(tones: number[]): void {
    this.tones = tones;
  }

  getStats(): CodecStats {
    return { ...this.stats };
  }

  private raisedCosineWindow(sample: number, totalSamples: number): number {
    const alpha = 0.5; // Roll-off factor
    const t = (sample - totalSamples / 2) / (totalSamples / 2);
    
    if (Math.abs(t) === 1) {
      return alpha * Math.PI / 4;
    }
    
    const sinc = Math.sin(Math.PI * t) / (Math.PI * t);
    const cos = Math.cos(alpha * Math.PI * t) / (1 - Math.pow(2 * alpha * t, 2));
    
    return sinc * cos;
  }

  private detectSymbols(pcm: Float32Array): number[] {
    const symbols: number[] = [];
    const fftSize = 1024;
    const hopSize = this.samplesPerSymbol;
    
    for (let offset = 0; offset <= pcm.length - fftSize; offset += hopSize) {
      const chunk = pcm.slice(offset, offset + fftSize);
      const symbol = this.detectSymbol(chunk);
      
      if (symbol !== -1) {
        symbols.push(symbol);
      }
    }

    return symbols;
  }

  private detectSymbol(chunk: Float32Array): number {
    // Simple Goertzel algorithm for tone detection
    const magnitudes: number[] = [];
    
    for (const tone of this.tones) {
      const magnitude = this.goertzel(chunk, tone, this.sampleRate);
      magnitudes.push(magnitude);
    }

    // Find the strongest tone
    const maxIndex = magnitudes.indexOf(Math.max(...magnitudes));
    const maxMagnitude = magnitudes[maxIndex];
    
    // Apply threshold
    const threshold = 0.01;
    if (maxMagnitude > threshold) {
      this.stats.signalStrength = Math.max(this.stats.signalStrength, maxMagnitude);
      return maxIndex;
    }

    return -1; // No valid symbol detected
  }

  private goertzel(chunk: Float32Array, frequency: number, sampleRate: number): number {
    const omega = 2 * Math.PI * frequency / sampleRate;
    const cosOmega = Math.cos(omega);
    
    let s1 = 0, s2 = 0;
    
    for (let i = 0; i < chunk.length; i++) {
      const s0 = chunk[i] + 2 * cosOmega * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    
    const magnitude = Math.sqrt(s1 * s1 + s2 * s2 - 2 * cosOmega * s1 * s2);
    return magnitude;
  }

  private findFrameBoundaries(symbols: number[]): Array<{start: number, end: number}> {
    const boundaries: Array<{start: number, end: number}> = [];
    
    for (let i = 0; i < symbols.length - this.preamble.length; i++) {
      // Check for preamble match
      let preambleMatch = true;
      for (let j = 0; j < this.preamble.length; j++) {
        if (symbols[i + j] !== this.preamble[j]) {
          preambleMatch = false;
          break;
        }
      }
      
      if (preambleMatch) {
        // Check for sync sequence
        const syncStart = i + this.preamble.length;
        if (syncStart + this.syncSequence.length <= symbols.length) {
          let syncMatch = true;
          for (let j = 0; j < this.syncSequence.length; j++) {
            if (symbols[syncStart + j] !== this.syncSequence[j]) {
              syncMatch = false;
              break;
            }
          }
          
          if (syncMatch) {
            const payloadStart = syncStart + this.syncSequence.length;
            const payloadEnd = this.findPayloadEnd(symbols, payloadStart);
            
            if (payloadEnd > payloadStart) {
              boundaries.push({
                start: payloadStart,
                end: payloadEnd
              });
            }
          }
        }
      }
    }
    
    return boundaries;
  }

  private findPayloadEnd(symbols: number[], start: number): number {
    // Look for silence or invalid symbols to determine frame end
    let consecutiveSilence = 0;
    const silenceThreshold = 10; // Number of consecutive invalid symbols
    
    for (let i = start; i < symbols.length; i++) {
      if (symbols[i] === -1 || symbols[i] >= this.tones.length) {
        consecutiveSilence++;
        if (consecutiveSilence >= silenceThreshold) {
          return i - silenceThreshold;
        }
      } else {
        consecutiveSilence = 0;
      }
    }
    
    return symbols.length;
  }

  private symbolsToBytes(symbols: number[]): Uint8Array {
    if (symbols.length < 4) {
      return new Uint8Array(0);
    }
    
    const bytes: number[] = [];
    
    // Convert 4 symbols (2 bits each) back to bytes
    for (let i = 0; i < symbols.length; i += 4) {
      if (i + 3 < symbols.length) {
        const byte = (symbols[i] << 6) | (symbols[i + 1] << 4) | (symbols[i + 2] << 2) | symbols[i + 3];
        bytes.push(byte);
      }
    }
    
    return new Uint8Array(bytes);
  }
}
