import { Router, Request, Response } from 'express';
import { HandshakeManager } from '@gibberlink/protocol-core';
import { ApiKeyAuth } from '../middleware/auth';
import { RateLimiter } from '../middleware/rateLimit';
import { SessionManager } from '../services/session';

export interface HandshakeRouteDependencies {
  sessionManager: SessionManager;
}

export function handshakeRoutes(deps: HandshakeRouteDependencies): Router {
  const router = Router();
  const handshakeManager = new HandshakeManager();

  // Apply rate limiting only (auth is handled at gateway level)
  const rateLimiter = new RateLimiter({
    windowMs: 60000,
    maxRequests: 10,
  });

  router.use(rateLimiter.middleware());

  router.post('/', (req, res) => {
    try {
      const { clientFeatures = {}, peerAddress } = req.body;

      if (!peerAddress || !peerAddress.protocol) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'peerAddress with protocol is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Validate transport
      if (!['ws', 'udp', 'audio'].includes(peerAddress.protocol)) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Invalid transport. Must be ws, udp, or audio',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Server features (negotiated with client)
      const serverFeatures = {
        compression: 'zstd',
        fec: true,
        crypto: false,
        maxMtu: 1500,
      };

      // Negotiate handshake
      const handshake = handshakeManager.negotiate(clientFeatures, serverFeatures);

      // Store session
      deps.sessionManager.createSession(
        handshake.sessionId, 
        peerAddress.protocol, 
        handshake.negotiated, 
        peerAddress
      );

      res.json({
        sessionId: handshake.sessionId,
        negotiated: handshake.negotiated,
        peerAddress: handshakeManager.formatAddress(peerAddress),
        expiresAt: handshake.expiresAt,
      });

    } catch (error) {
      console.error('Handshake error:', error);
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to establish handshake',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }
  });

  return router;
}
