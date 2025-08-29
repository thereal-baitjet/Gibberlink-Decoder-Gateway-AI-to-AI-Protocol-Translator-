import { SpectrogramAnalyzer, FrequencyBin } from './types';

export class FFTAnalyzer implements SpectrogramAnalyzer {
  private windowSize: number;
  private overlap: number;
  private sampleRate: number;
  private window: Float32Array;
  private fftBuffer: Float32Array;
  private fftReal: Float32Array;
  private fftImag: Float32Array;

  constructor(sampleRate: number = 48000, windowSize: number = 1024, overlap: number = 0.5) {
    this.sampleRate = sampleRate;
    this.windowSize = windowSize;
    this.overlap = overlap;
    this.window = this.createHannWindow(windowSize);
    this.fftBuffer = new Float32Array(windowSize);
    this.fftReal = new Float32Array(windowSize);
    this.fftImag = new Float32Array(windowSize);
  }

  setWindowSize(size: number): void {
    this.windowSize = size;
    this.window = this.createHannWindow(size);
    this.fftBuffer = new Float32Array(size);
    this.fftReal = new Float32Array(size);
    this.fftImag = new Float32Array(size);
  }

  setOverlap(overlap: number): void {
    this.overlap = Math.max(0, Math.min(1, overlap));
  }

  analyze(pcm: Float32Array): FrequencyBin[] {
    const bins: FrequencyBin[] = [];
    const stepSize = Math.floor(this.windowSize * (1 - this.overlap));
    
    for (let offset = 0; offset <= pcm.length - this.windowSize; offset += stepSize) {
      // Apply window function
      for (let i = 0; i < this.windowSize; i++) {
        this.fftBuffer[i] = pcm[offset + i] * this.window[i];
      }

      // Perform FFT
      this.fft(this.fftBuffer, this.fftReal, this.fftImag);

      // Calculate magnitude and phase for each bin
      for (let i = 0; i < this.windowSize / 2; i++) {
        const real = this.fftReal[i];
        const imag = this.fftImag[i];
        const magnitude = Math.sqrt(real * real + imag * imag);
        const phase = Math.atan2(imag, real);
        const frequency = (i * this.sampleRate) / this.windowSize;

        bins.push({
          frequency,
          magnitude,
          phase,
          timestamp: (offset / this.sampleRate) * 1000
        });
      }
    }

    return bins;
  }

  private createHannWindow(size: number): Float32Array {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    return window;
  }

  private fft(real: Float32Array, outReal: Float32Array, outImag: Float32Array): void {
    const n = real.length;
    
    // Copy input to output
    for (let i = 0; i < n; i++) {
      outReal[i] = real[i];
      outImag[i] = 0;
    }

    // Bit-reversal permutation
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        [outReal[i], outReal[j]] = [outReal[j], outReal[i]];
        [outImag[i], outImag[j]] = [outImag[j], outImag[i]];
      }
      
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    // FFT computation
    for (let step = 1; step < n; step <<= 1) {
      const angle = Math.PI / step;
      const wReal = Math.cos(angle);
      const wImag = Math.sin(angle);

      for (let group = 0; group < n; group += step << 1) {
        let uReal = 1;
        let uImag = 0;

        for (let pair = group; pair < group + step; pair++) {
          const vReal = outReal[pair + step] * uReal - outImag[pair + step] * uImag;
          const vImag = outReal[pair + step] * uImag + outImag[pair + step] * uReal;

          outReal[pair + step] = outReal[pair] - vReal;
          outImag[pair + step] = outImag[pair] - vImag;
          outReal[pair] += vReal;
          outImag[pair] += vImag;

          const nextUReal = uReal * wReal - uImag * wImag;
          const nextUImag = uReal * wImag + uImag * wReal;
          uReal = nextUReal;
          uImag = nextUImag;
        }
      }
    }
  }

  // Utility method to find peak frequencies
  findPeakFrequencies(bins: FrequencyBin[], threshold: number = 0.1): number[] {
    const peaks: number[] = [];
    const sortedBins = bins
      .filter(bin => bin.magnitude > threshold)
      .sort((a, b) => b.magnitude - a.magnitude);

    // Group nearby frequencies to avoid duplicates
    for (const bin of sortedBins) {
      const isDuplicate = peaks.some(peak => Math.abs(peak - bin.frequency) < 50);
      if (!isDuplicate) {
        peaks.push(bin.frequency);
      }
    }

    return peaks.slice(0, 10); // Return top 10 peaks
  }
}
