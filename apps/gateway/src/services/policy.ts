import crypto from 'crypto';
import { PolicyEngine, PolicyDecision, Features } from '@gibberlink/protocol-core';

export interface PolicyConfig {
  maxPayloadSize: number;
  denylistFields: string[];
  piiPatterns: RegExp[];
  requireTranscript: boolean;
  allowedTransports: string[];
  allowedCodecs: string[];
}

export class PolicyEngineImpl implements PolicyEngine {
  private config: PolicyConfig;

  constructor(config: PolicyConfig) {
    this.config = config;
  }

  checkPolicy(payload: unknown, features: Features): PolicyDecision {
    const redactedFields: string[] = [];
    let piiDetected = false;

    // Check payload size
    const payloadSize = this.getPayloadSize(payload);
    if (payloadSize > this.config.maxPayloadSize) {
      return {
        allowed: false,
        reason: `Payload size ${payloadSize} exceeds maximum ${this.config.maxPayloadSize}`,
        redactedFields: [],
        piiDetected: false,
      };
    }

    // Check for PII and denylist fields
    const { hasPii, redacted } = this.scanPayload(payload);
    piiDetected = hasPii;
    redactedFields.push(...redacted);

    // Check transport restrictions
    if (features.transport && !this.config.allowedTransports.includes(features.transport)) {
      return {
        allowed: false,
        reason: `Transport ${features.transport} not allowed`,
        redactedFields: [],
        piiDetected: false,
      };
    }

    // Check codec restrictions
    if (features.codec && !this.config.allowedCodecs.includes(features.codec)) {
      return {
        allowed: false,
        reason: `Codec ${features.codec} not allowed`,
        redactedFields: [],
        piiDetected: false,
      };
    }

    return {
      allowed: true,
      redactedFields,
      piiDetected,
    };
  }

  private getPayloadSize(payload: unknown): number {
    return JSON.stringify(payload).length;
  }

  private scanPayload(payload: unknown): { hasPii: boolean; redacted: string[] } {
    const redacted: string[] = [];
    let hasPii = false;

    const scanObject = (obj: any, path: string = ''): void => {
      if (typeof obj !== 'object' || obj === null) {
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Check denylist fields
        if (this.config.denylistFields.includes(key.toLowerCase())) {
          redacted.push(currentPath);
          obj[key] = '[REDACTED]';
          continue;
        }

        // Check PII patterns
        if (typeof value === 'string') {
          for (const pattern of this.config.piiPatterns) {
            if (pattern.test(value)) {
              hasPii = true;
              redacted.push(currentPath);
              obj[key] = '[PII_REDACTED]';
              break;
            }
          }
        }

        // Recursively scan nested objects
        if (typeof value === 'object' && value !== null) {
          scanObject(value, currentPath);
        }
      }
    };

    scanObject(payload);
    return { hasPii, redacted };
  }

  generatePayloadHash(payload: unknown): string {
    const json = JSON.stringify(payload);
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  shouldRequireTranscript(features: Features): boolean {
    return this.config.requireTranscript;
  }
}

export const defaultPolicyConfig: PolicyConfig = {
  maxPayloadSize: 1024 * 1024, // 1MB
  denylistFields: ['password', 'secret', 'token', 'key', 'credential'],
  piiPatterns: [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/, // Phone
  ],
  requireTranscript: true,
  allowedTransports: ['ws', 'udp', 'audio'],
  allowedCodecs: ['msgpack', 'cbor', 'json'],
};
