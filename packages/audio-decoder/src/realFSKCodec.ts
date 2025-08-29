import { MockGgwaveCodec, CodecStats, AudioProcessingConfig } from './types';

export class RealFSKCodec implements MockGgwaveCodec {
  private config: AudioProcessingConfig;
  private symbolRate: number;
  private tones: number[];
  private sampleRate: number;
  private samplesPerSymbol: number;
  private stats: CodecStats;
  private preamble: number[];
  private syncSequence: number[];
  private symbolBuffer: number[];
  private lastSymbolTime: number;
  private symbolClock: number;
  private phaseError: number;

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

    // Symbol buffer for timing recovery
    this.symbolBuffer = [];
    this.lastSymbolTime = 0;
    this.symbolClock = 0;
    this.phaseError = 0;

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
    
    // Apply pre-emphasis filter to enhance high frequencies
    const filteredPcm = this.applyPreEmphasis(pcm);
    
    // Detect symbols using Goertzel algorithm
    const symbols = this.detectSymbols(filteredPcm);
    
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

  private applyPreEmphasis(pcm: Float32Array): Float32Array {
    const alpha = 0.95; // Pre-emphasis coefficient
    const filtered = new Float32Array(pcm.length);
    
    filtered[0] = pcm[0];
    for (let i = 1; i < pcm.length; i++) {
      filtered[i] = pcm[i] - alpha * pcm[i - 1];
    }
    
    return filtered;
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
    const hopSize = Math.floor(this.samplesPerSymbol / 4); // More overlap for better timing
    
    // Apply bandpass filter to focus on FSK frequencies
    const filteredPcm = this.applyBandpassFilter(pcm);
    
    for (let offset = 0; offset <= filteredPcm.length - fftSize; offset += hopSize) {
      const chunk = filteredPcm.slice(offset, offset + fftSize);
      const symbol = this.detectSymbol(chunk);
      
      if (symbol !== -1) {
        symbols.push(symbol);
        
        // Update timing recovery
        this.updateTimingRecovery(offset, symbol);
      }
    }

    return symbols;
  }

  private detectSymbol(chunk: Float32Array): number {
    // Apply Hann window to reduce spectral leakage
    const windowed = this.applyHannWindow(chunk);
    
    // Use Goertzel algorithm for each tone
    const magnitudes: number[] = [];
    
    for (const tone of this.tones) {
      const magnitude = this.goertzel(windowed, tone, this.sampleRate);
      magnitudes.push(magnitude);
    }

    // Find the strongest tone
    const maxIndex = magnitudes.indexOf(Math.max(...magnitudes));
    const maxMagnitude = magnitudes[maxIndex];
    
    // Apply adaptive threshold based on signal strength
    const threshold = this.calculateAdaptiveThreshold(magnitudes);
    
    if (maxMagnitude > threshold) {
      this.stats.signalStrength = Math.max(this.stats.signalStrength, maxMagnitude);
      return maxIndex;
    }

    return -1; // No valid symbol detected
  }

  private applyHannWindow(chunk: Float32Array): Float32Array {
    const windowed = new Float32Array(chunk.length);
    
    for (let i = 0; i < chunk.length; i++) {
      const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (chunk.length - 1)));
      windowed[i] = chunk[i] * window;
    }
    
    return windowed;
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

  private calculateAdaptiveThreshold(magnitudes: number[]): number {
    // Calculate RMS of all magnitudes
    const rms = Math.sqrt(magnitudes.reduce((sum, mag) => sum + mag * mag, 0) / magnitudes.length);
    
    // Use 6dB above noise floor as threshold for better reliability
    return rms * 2.0; // 6dB = 10^(6/20) ≈ 2.0
  }

  private applyBandpassFilter(pcm: Float32Array): Float32Array {
    // Simple bandpass filter to focus on FSK frequencies
    const minFreq = Math.min(...this.tones) * 0.8;
    const maxFreq = Math.max(...this.tones) * 1.2;
    
    // Apply a simple moving average filter as a basic bandpass
    const filtered = new Float32Array(pcm.length);
    const windowSize = 5;
    
    for (let i = 0; i < pcm.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(pcm.length - 1, i + windowSize); j++) {
        sum += pcm[j];
        count++;
      }
      
      filtered[i] = sum / count;
    }
    
    return filtered;
  }

  private updateTimingRecovery(offset: number, symbol: number): void {
    const currentTime = offset / this.sampleRate;
    const expectedTime = this.lastSymbolTime + 1 / this.symbolRate;
    
    // Calculate timing error
    const timingError = currentTime - expectedTime;
    this.phaseError = timingError * this.symbolRate;
    
    // Update symbol clock
    this.symbolClock += timingError;
    this.lastSymbolTime = currentTime;
  }

  private findFrameBoundaries(symbols: number[]): Array<{start: number, end: number}> {
    const boundaries: Array<{start: number, end: number}> = [];
    
    for (let i = 0; i < symbols.length - this.preamble.length; i++) {
      // Check for preamble match with some tolerance for errors
      const preambleMatch = this.matchPreamble(symbols, i);
      
      if (preambleMatch) {
        // Check for sync sequence
        const syncStart = i + this.preamble.length;
        if (syncStart + this.syncSequence.length <= symbols.length) {
          const syncMatch = this.matchSyncSequence(symbols, syncStart);
          
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

  private matchPreamble(symbols: number[], start: number): boolean {
    let matches = 0;
    const tolerance = 1; // Allow 1 symbol error in preamble
    
    // Check if we have enough symbols
    if (start + this.preamble.length > symbols.length) {
      return false;
    }
    
    for (let j = 0; j < this.preamble.length; j++) {
      if (Math.abs(symbols[start + j] - this.preamble[j]) <= tolerance) {
        matches++;
      }
    }
    
    // Require 80% match for preamble (more lenient)
    return matches >= this.preamble.length * 0.8;
  }

  private matchSyncSequence(symbols: number[], start: number): boolean {
    let matches = 0;
    
    for (let j = 0; j < this.syncSequence.length; j++) {
      if (symbols[start + j] === this.syncSequence[j]) {
        matches++;
      }
    }
    
    // Require exact match for sync sequence
    return matches === this.syncSequence.length;
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
