declare module 'mic' {
  interface MicOptions {
    rate?: string;
    channels?: string;
    fileType?: string;
    device?: string;
    exitOnSilence?: number;
    bitwidth?: string;
  }

  interface MicInstance {
    start(): void;
    stop(): void;
    getAudioStream(): NodeJS.ReadableStream;
  }

  function mic(options: MicOptions): MicInstance;
  function getDevices(): Array<{
    deviceId: string;
    name: string;
    type: string;
  }>;

  export default mic;
  export { getDevices };
}

declare module 'audio-decode' {
  function decode(buffer: ArrayBuffer): Promise<AudioBuffer>;
  export = decode;
}

declare module 'wav-decoder' {
  function decode(buffer: ArrayBuffer): Promise<{
    sampleRate: number;
    channelData: Float32Array[];
  }>;
  export = decode;
}
