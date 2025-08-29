import { Router, Request, Response } from 'express';
import { RateLimiter } from '../middleware/rateLimit';
import { AuditLogger } from '../services/audit';

export interface TranscriptRouteDependencies {
  auditLogger: AuditLogger;
}

export function transcriptRoutes(deps: TranscriptRouteDependencies): Router {
  const router = Router();

  // Apply rate limiting only (auth is handled at gateway level)
  const rateLimiter = new RateLimiter({
    windowMs: 60000,
    maxRequests: 50,
  });

  router.use(rateLimiter.middleware());

  router.get('/:msgId', async (req, res) => {
    try {
      const { msgId } = req.params;

      if (!msgId) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'msgId is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Get transcript from audit logger
      const transcript = await deps.auditLogger.getTranscript(msgId);

      if (!transcript) {
        return res.status(404).json({
          error: 'TRANSCRIPT_NOT_FOUND',
          message: 'Transcript not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Check if user has access to this transcript
      // For now, allow access if the user is the same actor or if it's a recent transcript
      const userApiKey = (req as any).apiKey;
      const isOwner = transcript.actor === userApiKey;
      const isRecent = new Date(transcript.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

      if (!isOwner && !isRecent) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Access denied to transcript',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      res.json({
        msgId: transcript.msgId,
        timestamp: transcript.timestamp,
        payload: transcript.payload,
        metadata: transcript.metadata,
        audit: transcript,
        rawFrames: transcript.rawFrames || [],
      });

    } catch (error) {
      console.error('Transcript error:', error);
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve transcript',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }
  });

  return router;
}
