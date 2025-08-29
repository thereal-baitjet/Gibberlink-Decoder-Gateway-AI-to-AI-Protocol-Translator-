import { FEC } from './types';

export class NoOpFEC implements FEC {
  name = 'no-op';

  encode(data: Uint8Array): Uint8Array {
    return data;
  }

  decode(data: Uint8Array): Uint8Array | null {
    return data;
  }
}

export class StubReedSolomonFEC implements FEC {
  name = 'reed-solomon-stub';
  private readonly redundancyRatio: number;

  constructor(redundancyRatio: number = 0.25) {
    this.redundancyRatio = redundancyRatio;
  }

  encode(data: Uint8Array): Uint8Array {
    // Stub implementation - just append redundancy data
    const redundancySize = Math.ceil(data.length * this.redundancyRatio);
    const redundancy = new Uint8Array(redundancySize);
    
    // Simple XOR-based redundancy (not real Reed-Solomon)
    for (let i = 0; i < redundancySize; i++) {
      redundancy[i] = data[i % data.length] ^ (i * 7);
    }
    
    const encoded = new Uint8Array(data.length + redundancySize + 4);
    const view = new DataView(encoded.buffer);
    
    // Write original data length
    view.setUint32(0, data.length, false);
    
    // Write original data
    encoded.set(data, 4);
    
    // Write redundancy
    encoded.set(redundancy, 4 + data.length);
    
    return encoded;
  }

  decode(data: Uint8Array): Uint8Array | null {
    if (data.length < 4) {
      return null;
    }
    
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const originalLength = view.getUint32(0, false);
    
    if (data.length < 4 + originalLength) {
      return null;
    }
    
    // Extract original data
    const originalData = data.slice(4, 4 + originalLength);
    
    // In a real implementation, we would use the redundancy to correct errors
    // For now, just return the original data
    return originalData;
  }
}

export class SimulatedLossFEC implements FEC {
  name = 'simulated-loss';
  private readonly lossRate: number;
  private readonly baseFEC: FEC;

  constructor(baseFEC: FEC, lossRate: number = 0.05) {
    this.baseFEC = baseFEC;
    this.lossRate = lossRate;
  }

  encode(data: Uint8Array): Uint8Array {
    return this.baseFEC.encode(data);
  }

  decode(data: Uint8Array): Uint8Array | null {
    // Simulate packet loss
    if (Math.random() < this.lossRate) {
      return null;
    }
    
    // Simulate bit errors
    const corrupted = this.simulateBitErrors(data);
    
    return this.baseFEC.decode(corrupted);
  }

  private simulateBitErrors(data: Uint8Array): Uint8Array {
    const corrupted = new Uint8Array(data);
    const errorRate = 0.001; // 0.1% bit error rate
    
    for (let i = 0; i < corrupted.length; i++) {
      for (let bit = 0; bit < 8; bit++) {
        if (Math.random() < errorRate) {
          corrupted[i] ^= (1 << bit);
        }
      }
    }
    
    return corrupted;
  }
}

export const fecImplementations = {
  'no-op': new NoOpFEC(),
  'reed-solomon-stub': new StubReedSolomonFEC(),
  'simulated-loss': new SimulatedLossFEC(new StubReedSolomonFEC()),
};
