import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { 
  ProtocolProcessor, 
  codecs, 
  FramerV1, 
  fecImplementations,
  MessageMetadata,
  CRC32
} from '@gibberlink/protocol-core';
import { ApiKeyAuth } from '../middleware/auth';
import { RateLimiter } from '../middleware/rateLimit';
import { SessionManager } from '../services/session';
import { PolicyEngineImpl } from '../services/policy';
import { AuditLogger } from '../services/audit';
import { TransportFactory } from '@gibberlink/transports';

export interface EncodeRouteDependencies {
  sessionManager: SessionManager;
  policyEngine: PolicyEngineImpl;
  auditLogger: AuditLogger;
}

export function encodeRoutes(deps: EncodeRouteDependencies): Router {
  const router = Router();

  // Apply rate limiting only (auth is handled at gateway level)
  const rateLimiter = new RateLimiter({
    windowMs: 60000,
    maxRequests: 100,
  });

  router.use(rateLimiter.middleware());

  router.post('/', async (req, res) => {
    try {
      const { sessionId, target, payload, requireTranscript = true } = req.body;

      if (!sessionId || !target || !payload) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'sessionId, target, and payload are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Validate session
      const session = deps.sessionManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          error: 'SESSION_NOT_FOUND',
          message: 'Session not found or expired',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Check policy
      const policyDecision = deps.policyEngine.checkPolicy(payload, session.features);
      if (!policyDecision.allowed) {
        return res.status(403).json({
          error: 'POLICY_VIOLATION',
          message: policyDecision.reason,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Generate message ID
      const msgId = nanoid();

      // Create protocol processor
      const codec = codecs.msgpack;
      const framer = new FramerV1();
      const fec = fecImplementations['no-op'];
      
      const processor = new ProtocolProcessor(codec, framer, fec);

      // Encode message
      const frames = await processor.encode(msgId, payload, {
        maxFrameSize: 1500,
        enableChunking: true,
      });

      // Convert frames to base64
      const frameBuffer = Buffer.concat(frames);
      const bytesBase64 = frameBuffer.toString('base64');

      // Calculate CRC32
      const crc32 = CRC32.calculate(frameBuffer);
      const crc32Hex = CRC32.toHex(crc32);

      // Create metadata
      const metadata: MessageMetadata = {
        timestamp: new Date().toISOString(),
        transport: session.transport as 'ws' | 'udp' | 'audio',
        codec: 'msgpack',
        compression: 'none',
        fec: false,
        size: frameBuffer.length,
        frames: frames.length,
        crc32: crc32Hex,
      };

      // Send via transport
      try {
        const transport = TransportFactory.createClientTransport(session.transport as 'ws' | 'udp' | 'audio', {
          url: target
        });
        
        // Send the first frame (for now, we'll implement full multi-frame sending later)
        await transport.send(frames[0], {
          protocol: session.transport as 'ws' | 'udp' | 'audio',
          host: new URL(target).hostname,
          port: parseInt(new URL(target).port) || 8080
        });
        
        console.log(`Message ${msgId} sent via ${session.transport} to ${target}`);
      } catch (transportError) {
        console.warn(`Transport send failed for message ${msgId}:`, transportError);
        // Don't fail the request, just log the transport error
      }

      // Log audit entry
      await deps.auditLogger.log({
        timestamp: new Date().toISOString(),
        route: '/v1/encode',
        actor: (req as any).apiKey || 'unknown',
        msgId,
        size: metadata.size,
        codec: metadata.codec,
        transport: metadata.transport,
        policyDecision: 'allow',
        hash: deps.policyEngine.generatePayloadHash(payload),
        piiDetected: policyDecision.piiDetected || false,
        redactedFields: policyDecision.redactedFields || [],
      });

      res.json({
        msgId,
        bytesBase64,
        frames: frames.length,
        size: metadata.size,
        crc32: crc32Hex,
        transcriptId: requireTranscript ? msgId : undefined,
      });

    } catch (error) {
      console.error('Encode error:', error);
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to encode message',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }
  });

  return router;
}
