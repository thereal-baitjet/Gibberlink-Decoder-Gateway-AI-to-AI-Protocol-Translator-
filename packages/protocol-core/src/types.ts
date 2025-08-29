export interface Address {
  protocol: 'ws' | 'udp' | 'audio';
  host: string;
  port: number;
  path?: string;
}

export interface Features {
  compression?: 'zstd' | 'none';
  fec?: boolean;
  crypto?: boolean;
  maxMtu?: number;
}

export interface Frame {
  magic: number;
  version: number;
  length: number;
  msgId: string;
  payload: Uint8Array;
  crc32: number;
  chunkIndex?: number;
  totalChunks?: number;
}

export interface Message {
  msgId: string;
  payload: unknown;
  metadata: MessageMetadata;
}

export interface MessageMetadata {
  timestamp: string;
  transport: 'ws' | 'udp' | 'audio';
  codec: 'msgpack' | 'cbor' | 'json';
  compression: 'zstd' | 'none';
  fec: boolean;
  size: number;
  frames: number;
  crc32: string;
}

export interface Codec {
  name: string;
  encode(data: unknown): Uint8Array | Promise<Uint8Array>;
  decode(bytes: Uint8Array): unknown | Promise<unknown>;
}

export interface Framer {
  name: string;
  frame(msgId: string, payload: Uint8Array, options?: FramingOptions): Uint8Array[];
  deframe(bytes: Uint8Array): Frame | null;
}

export interface FramingOptions {
  maxFrameSize?: number;
  enableChunking?: boolean;
}

export interface FEC {
  name: string;
  encode(data: Uint8Array): Uint8Array;
  decode(data: Uint8Array): Uint8Array | null;
}

export interface Handshake {
  clientFeatures: Features;
  serverFeatures: Features;
  negotiated: Features;
  sessionId: string;
  expiresAt: string;
}

export interface Transport {
  name: string;
  send(frame: Uint8Array, target: Address): Promise<void>;
  onFrame(callback: (frame: Uint8Array, source: Address) => void): void;
  close(): Promise<void>;
}

export interface Session {
  id: string;
  transport: string;
  features: Features;
  peerAddress: Address;
  createdAt: string;
  expiresAt: string;
}

export interface AuditLog {
  timestamp: string;
  route: string;
  actor: string;
  msgId: string;
  size: number;
  codec: string;
  transport: string;
  policyDecision: 'allow' | 'deny';
  hash: string;
  piiDetected: boolean;
  redactedFields: string[];
}

export interface Transcript {
  msgId: string;
  timestamp: string;
  payload: unknown;
  metadata: MessageMetadata;
  audit: AuditLog;
  rawFrames: string[];
}

export interface PolicyEngine {
  checkPolicy(payload: unknown, features: Features): PolicyDecision;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  redactedFields: string[];
  piiDetected: boolean;
}

export interface RateLimiter {
  checkLimit(key: string): Promise<RateLimitResult>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfterMs?: number;
}
