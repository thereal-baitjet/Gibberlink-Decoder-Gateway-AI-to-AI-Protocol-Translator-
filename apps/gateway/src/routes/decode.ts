import { Router, Request, Response } from 'express';
import { 
  ProtocolProcessor, 
  codecs, 
  FramerV1, 
  fecImplementations,
  MessageMetadata,
  CRC32
} from '@gibberlink/protocol-core';
import { RateLimiter } from '../middleware/rateLimit';
import { PolicyEngineImpl } from '../services/policy';
import { AuditLogger } from '../services/audit';

export interface DecodeRouteDependencies {
  policyEngine: PolicyEngineImpl;
  auditLogger: AuditLogger;
}

export function decodeRoutes(deps: DecodeRouteDependencies): Router {
  const router = Router();

  // Apply rate limiting only (auth is handled at gateway level)
  const rateLimiter = new RateLimiter({
    windowMs: 60000,
    maxRequests: 100,
  });

  router.use(rateLimiter.middleware());

  router.post('/', async (req, res) => {
    try {
      const { bytesBase64 } = req.body;

      if (!bytesBase64) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'bytesBase64 is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Decode base64 to bytes
      let frames: Uint8Array[];
      try {
        const bytes = Buffer.from(bytesBase64, 'base64');
        frames = [bytes]; // For now, assume single frame
      } catch (error) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Invalid base64 encoding',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Create protocol processor
      const codec = codecs.msgpack;
      const framer = new FramerV1();
      const fec = fecImplementations['no-op'];
      
      const processor = new ProtocolProcessor(codec, framer, fec);

      // Decode message
      const result = await processor.decode(frames);
      
      if (!result) {
        return res.status(400).json({
          error: 'DECODE_FAILED',
          message: 'Failed to decode message',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Calculate CRC32 for validation
      const frameBuffer = Buffer.concat(frames);
      const crc32 = CRC32.calculate(frameBuffer);
      const crc32Hex = CRC32.toHex(crc32);

      // Create metadata
      const metadata: MessageMetadata = {
        timestamp: new Date().toISOString(),
        transport: 'ws' as 'ws' | 'udp' | 'audio', // Would be determined from frame
        codec: 'msgpack',
        compression: 'none',
        fec: false,
        size: frameBuffer.length,
        frames: frames.length,
        crc32: crc32Hex,
      };

      // Check policy on decoded payload
      const policyDecision = deps.policyEngine.checkPolicy(result.payload, {
        compression: 'none',
        fec: false,
        crypto: false,
        maxMtu: 1500
      });

      if (!policyDecision.allowed) {
        return res.status(403).json({
          error: 'POLICY_VIOLATION',
          message: policyDecision.reason,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Log audit entry
      await deps.auditLogger.log({
        timestamp: new Date().toISOString(),
        route: '/v1/decode',
        actor: (req as any).apiKey || 'unknown',
        msgId: result.msgId,
        size: metadata.size,
        codec: metadata.codec,
        transport: metadata.transport,
        policyDecision: 'allow',
        hash: deps.policyEngine.generatePayloadHash(result.payload),
        piiDetected: policyDecision.piiDetected || false,
        redactedFields: policyDecision.redactedFields || [],
      });

      res.json({
        msgId: result.msgId,
        payload: result.payload,
        metadata,
        crc32: crc32Hex,
      });

    } catch (error) {
      console.error('Decode error:', error);
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to decode message',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }
  });

  return router;
}
