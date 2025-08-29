import crc32 from 'crc-32';

export class CRC32 {
  static calculate(data: Uint8Array): number {
    return crc32.buf(data);
  }

  static verify(data: Uint8Array, expectedCrc: number): boolean {
    const calculatedCrc = this.calculate(data);
    return calculatedCrc === expectedCrc;
  }

  static toHex(crc: number): string {
    return (crc >>> 0).toString(16).padStart(8, '0');
  }

  static fromHex(hex: string): number {
    return parseInt(hex, 16);
  }
}
