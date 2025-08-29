import { Router, Request, Response } from 'express';
import { createEnglishizer } from '@gibberlink/englishizer';

export interface TranscriptRouteDependencies {
  auditLogger: any;
  policyEngine: any;
  sessionManager: any;
}

export function createTranscriptRoutes(deps: TranscriptRouteDependencies) {
  const router = Router();
  const englishizer = createEnglishizer();
  
  // Note: Auth and rate limiting are handled at the gateway level

  // Mock transcript storage (in a real implementation, this would be a database)
  const transcripts = new Map<string, any>();

  /**
   * GET /v1/transcript/:msgId
   * Get transcript for a specific message ID
   */
  router.get('/:msgId', async (req: Request, res: Response) => {
    try {
      const { msgId } = req.params;
      const { view = 'full' } = req.query;

      // Check policy
      const policyResult = await deps.policyEngine.check('allowTranscript', {
        sessionId: req.headers['x-session-id'] as string,
        msgId,
        view
      });

      if (!policyResult.allowed) {
        return res.status(403).json({
          error: 'Access denied',
          reason: policyResult.reason
        });
      }

      // Get transcript from storage
      const transcript = transcripts.get(msgId);
      if (!transcript) {
        return res.status(404).json({
          error: 'Transcript not found',
          msgId
        });
      }

      // Generate English translation if not already present
      if (!transcript.english && transcript.json) {
        try {
          const event = {
            kind: 'unknown',
            payload: transcript.json,
            meta: {
              msgId: transcript.msgId,
              transport: transcript.transport || 'unknown',
              codec: transcript.codec || 'unknown',
              ts: transcript.timestamp,
              sessionId: transcript.sessionId
            }
          };

          const englishized = await englishizer.toPlainEnglish(event);
          transcript.english = englishized;
          
          // Update storage
          transcripts.set(msgId, transcript);
        } catch (error) {
          console.warn('Failed to generate English translation:', error);
        }
      }

      // Return based on view parameter
      if (view === 'plain') {
        return res.json({
          text: transcript.english?.text || 'No English translation available',
          confidence: transcript.english?.confidence || 0,
          glossary: transcript.english?.glossary || {},
          redactions: transcript.english?.redactions || []
        });
      }

      if (view === 'english') {
        return res.json({
          text: transcript.english?.text || 'No English translation available',
          bullets: transcript.english?.bullets || [],
          glossary: transcript.english?.glossary || {},
          redactions: transcript.english?.redactions || [],
          confidence: transcript.english?.confidence || 0
        });
      }

      // Default: return full transcript
      res.json({
        msgId: transcript.msgId,
        timestamp: transcript.timestamp,
        sessionId: transcript.sessionId,
        transport: transcript.transport,
        codec: transcript.codec,
        raw: transcript.raw,
        json: transcript.json,
        english: transcript.english,
        metadata: transcript.metadata
      });

    } catch (error) {
      console.error('Transcript retrieval error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve transcript'
      });
    }
  });

  /**
   * POST /v1/translate
   * Translate a payload to plain English
   */
  router.post('/translate', async (req: Request, res: Response) => {
    try {
      const { payload, kind, msgId } = req.body;

      // Check policy
      const policyResult = await deps.policyEngine.check('allowTranslation', {
        sessionId: req.headers['x-session-id'] as string,
        payload: payload ? 'provided' : 'from-msgId',
        msgId
      });

      if (!policyResult.allowed) {
        return res.status(403).json({
          error: 'Translation not allowed',
          reason: policyResult.reason
        });
      }

      let targetPayload = payload;
      let targetMsgId = msgId;

      // If no payload provided but msgId is, fetch from transcript
      if (!targetPayload && targetMsgId) {
        const transcript = transcripts.get(targetMsgId);
        if (!transcript) {
          return res.status(404).json({
            error: 'Message not found',
            msgId: targetMsgId
          });
        }
        targetPayload = transcript.json;
      }

      if (!targetPayload) {
        return res.status(400).json({
          error: 'No payload provided',
          message: 'Either payload or msgId must be provided'
        });
      }

      // Create event for translation
      const event = {
        kind: kind || 'unknown',
        payload: targetPayload,
        meta: {
          msgId: targetMsgId || `translate-${Date.now()}`,
          transport: 'unknown',
          codec: 'unknown',
          ts: Date.now(),
          sessionId: req.headers['x-session-id'] as string
        }
      };

      // Generate English translation
      const englishized = await englishizer.toPlainEnglish(event);

      res.json(englishized);

    } catch (error) {
      console.error('Translation error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to translate payload'
      });
    }
  });

  /**
   * GET /v1/transcript
   * List all transcripts (with pagination)
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { page = '1', limit = '20', sessionId } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      // Check policy
      const policyResult = await deps.policyEngine.check('allowTranscriptList', {
        sessionId: req.headers['x-session-id'] as string,
        requestedSessionId: sessionId as string
      });

      if (!policyResult.allowed) {
        return res.status(403).json({
          error: 'Access denied',
          reason: policyResult.reason
        });
      }

      // Filter transcripts
      let filteredTranscripts = Array.from(transcripts.values());
      
      if (sessionId) {
        filteredTranscripts = filteredTranscripts.filter(t => t.sessionId === sessionId);
      }

      // Sort by timestamp (newest first)
      filteredTranscripts.sort((a, b) => b.timestamp - a.timestamp);

      // Paginate
      const start = (pageNum - 1) * limitNum;
      const end = start + limitNum;
      const paginatedTranscripts = filteredTranscripts.slice(start, end);

      // Format response
      const formattedTranscripts = paginatedTranscripts.map(t => ({
        msgId: t.msgId,
        timestamp: t.timestamp,
        sessionId: t.sessionId,
        transport: t.transport,
        codec: t.codec,
        hasEnglish: !!t.english,
        englishPreview: t.english?.text?.substring(0, 100) + (t.english?.text?.length > 100 ? '...' : '')
      }));

      res.json({
        transcripts: formattedTranscripts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: filteredTranscripts.length,
          pages: Math.ceil(filteredTranscripts.length / limitNum)
        }
      });

    } catch (error) {
      console.error('Transcript list error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to list transcripts'
      });
    }
  });

  // Export the transcripts map for use by other modules
  (router as any).transcripts = transcripts;

  return router;
}
