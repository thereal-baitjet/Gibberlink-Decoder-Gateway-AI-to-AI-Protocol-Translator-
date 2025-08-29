import { Router, Request, Response } from 'express';
import { healthRoutes } from './health';
import { handshakeRoutes, HandshakeRouteDependencies } from './handshake';
import { encodeRoutes, EncodeRouteDependencies } from './encode';
import { decodeRoutes, DecodeRouteDependencies } from './decode';
import { createAudioRoutes, AudioRouteDependencies } from './audio';
import { createTranscriptRoutes, TranscriptRouteDependencies } from './transcript';
import { createAudioPlainRoutes, AudioPlainRouteDependencies } from './audioPlain';

export interface RouteDependencies {
  sessionManager: any;
  policyEngine: any;
  auditLogger: any;
}

export function createRoutes(deps: RouteDependencies): Router {
  const router = Router();

  // Mount route modules
  router.use('/v1/health', healthRoutes());
  router.use('/v1/handshake', handshakeRoutes({ sessionManager: deps.sessionManager } as HandshakeRouteDependencies));
  router.use('/v1/encode', encodeRoutes(deps as EncodeRouteDependencies));
  router.use('/v1/decode', decodeRoutes({ 
    policyEngine: deps.policyEngine, 
    auditLogger: deps.auditLogger 
  } as DecodeRouteDependencies));

  router.use('/v1', createAudioRoutes({ 
    auditLogger: deps.auditLogger,
    policyEngine: deps.policyEngine 
  } as AudioRouteDependencies));

  router.use('/v1', createTranscriptRoutes({ 
    auditLogger: deps.auditLogger,
    policyEngine: deps.policyEngine,
    sessionManager: deps.sessionManager
  } as TranscriptRouteDependencies));

  router.use('/v1', createAudioPlainRoutes({ 
    auditLogger: deps.auditLogger,
    policyEngine: deps.policyEngine,
    sessionManager: deps.sessionManager
  } as AudioPlainRouteDependencies));

  // 404 handler
  router.use('*', (req, res) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  });

  return router;
}
