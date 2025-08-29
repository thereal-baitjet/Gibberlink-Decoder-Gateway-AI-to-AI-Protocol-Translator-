import { Router, Request, Response } from 'express';
import { AudioToPlainPipeline, AudioToPlainConfig } from '../pipeline/audioToPlain';

export interface AudioPlainRouteDependencies {
  auditLogger: any;
  policyEngine: any;
  sessionManager: any;
}

export function createAudioPlainRoutes(deps: AudioPlainRouteDependencies) {
  const router = Router();
  
  // Store active pipelines per session
  const pipelines = new Map<string, AudioToPlainPipeline>();

  /**
   * POST /v1/audio/start
   * Start audio capture and plain English translation
   */
  router.post('/start', async (req: Request, res: Response) => {
    try {
      const { sessionId, deviceId, preset = 'lowLatency' } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          error: 'Missing sessionId',
          message: 'Session ID is required to start audio capture'
        });
      }

      // Check policy
      const policyResult = await deps.policyEngine.check('allowAudio', {
        sessionId,
        deviceId,
        preset
      });

      if (!policyResult.allowed) {
        return res.status(403).json({
          error: 'Audio capture not allowed',
          reason: policyResult.reason
        });
      }

      // Validate session
      const session = deps.sessionManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          sessionId
        });
      }

      // Create or get existing pipeline
      let pipeline = pipelines.get(sessionId);
      if (!pipeline) {
        const config: AudioToPlainConfig = {
          preset: preset as any,
          enableRedaction: true,
          enableGlossary: true,
          maxLatencyMs: 300
        };
        
        pipeline = new AudioToPlainPipeline(config);
        
        // Set up event handlers
        pipeline.on('plainEnglish', async (result) => {
          // Log to audit
          await deps.auditLogger.log({
            msgId: result.msgId,
            route: '/v1/audio/plain',
            actor: req.headers['x-api-key'] as string || 'unknown',
            timestamp: new Date().toISOString(),
            payload: {
              text: result.text,
              confidence: result.confidence,
              snrDb: result.snrDb,
              lockPct: result.lockPct,
              latencyMs: result.latencyMs
            },
            policyDecision: 'ALLOWED',
            metadata: {
              audio: {
                snrDb: result.snrDb,
                lockPct: result.lockPct,
                latencyMs: result.latencyMs
              },
              englishizer: {
                confidence: result.confidence,
                redactions: result.redactions,
                glossary: result.glossary
              }
            }
          });
        });

        pipeline.on('error', (error) => {
          console.error('Audio pipeline error:', error);
        });

        pipelines.set(sessionId, pipeline);
      }

      // Start capture
      await pipeline.startCapture(deviceId);

      res.json({
        success: true,
        sessionId,
        deviceId,
        preset,
        message: 'Audio capture started successfully'
      });

    } catch (error) {
      console.error('Audio start error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to start audio capture'
      });
    }
  });

  /**
   * POST /v1/audio/stop
   * Stop audio capture
   */
  router.post('/stop', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          error: 'Missing sessionId',
          message: 'Session ID is required to stop audio capture'
        });
      }

      const pipeline = pipelines.get(sessionId);
      if (!pipeline) {
        return res.status(404).json({
          error: 'No active audio pipeline found',
          sessionId
        });
      }

      await pipeline.stopCapture();

      res.json({
        success: true,
        sessionId,
        message: 'Audio capture stopped successfully'
      });

    } catch (error) {
      console.error('Audio stop error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to stop audio capture'
      });
    }
  });

  /**
   * GET /v1/audio/devices
   * Get available audio input devices
   */
  router.get('/devices', async (req: Request, res: Response) => {
    try {
      const sessionId = req.query.sessionId as string;
      
      if (!sessionId) {
        return res.status(400).json({
          error: 'Missing sessionId',
          message: 'Session ID is required to get audio devices'
        });
      }

      // Check policy
      const policyResult = await deps.policyEngine.check('allowAudioDevices', {
        sessionId
      });

      if (!policyResult.allowed) {
        return res.status(403).json({
          error: 'Access denied',
          reason: policyResult.reason
        });
      }

      // Get or create pipeline to access devices
      let pipeline = pipelines.get(sessionId);
      if (!pipeline) {
        pipeline = new AudioToPlainPipeline();
        pipelines.set(sessionId, pipeline);
      }

      const devices = await pipeline.getDevices();

      res.json({
        devices,
        count: devices.length
      });

    } catch (error) {
      console.error('Audio devices error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get audio devices'
      });
    }
  });

  /**
   * GET /v1/audio/stream/plain
   * Server-Sent Events stream of plain English translations
   */
  router.get('/stream/plain', async (req: Request, res: Response) => {
    try {
      const sessionId = req.query.sessionId as string;
      
      if (!sessionId) {
        return res.status(400).json({
          error: 'Missing sessionId',
          message: 'Session ID is required for audio stream'
        });
      }

      // Check policy
      const policyResult = await deps.policyEngine.check('allowAudioStream', {
        sessionId
      });

      if (!policyResult.allowed) {
        return res.status(403).json({
          error: 'Access denied',
          reason: policyResult.reason
        });
      }

      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial connection message
      res.write(`data: ${JSON.stringify({
        type: 'connected',
        sessionId,
        timestamp: new Date().toISOString()
      })}\n\n`);

      // Get or create pipeline
      let pipeline = pipelines.get(sessionId);
      if (!pipeline) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: 'No active audio pipeline found'
        })}\n\n`);
        res.end();
        return;
      }

      // Set up event handlers
      const plainEnglishHandler = (result: any) => {
        const event = {
          type: 'plainEnglish',
          msgId: result.msgId,
          text: result.text,
          confidence: result.confidence,
          snrDb: result.snrDb,
          lockPct: result.lockPct,
          latencyMs: result.latencyMs,
          timestamp: new Date().toISOString()
        };
        
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      const metricsHandler = (metrics: any) => {
        const event = {
          type: 'metrics',
          metrics,
          timestamp: new Date().toISOString()
        };
        
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      const errorHandler = (error: Error) => {
        const event = {
          type: 'error',
          message: error.message,
          timestamp: new Date().toISOString()
        };
        
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      // Attach event handlers
      pipeline.on('plainEnglish', plainEnglishHandler);
      pipeline.on('metrics', metricsHandler);
      pipeline.on('error', errorHandler);

      // Handle client disconnect
      req.on('close', () => {
        pipeline?.removeListener('plainEnglish', plainEnglishHandler);
        pipeline?.removeListener('metrics', metricsHandler);
        pipeline?.removeListener('error', errorHandler);
      });

    } catch (error) {
      console.error('Audio stream error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to establish audio stream'
      });
    }
  });

  /**
   * GET /v1/audio/status
   * Get current audio capture status and metrics
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const sessionId = req.query.sessionId as string;
      
      if (!sessionId) {
        return res.status(400).json({
          error: 'Missing sessionId',
          message: 'Session ID is required to get audio status'
        });
      }

      const pipeline = pipelines.get(sessionId);
      if (!pipeline) {
        return res.json({
          isCapturing: false,
          message: 'No active audio pipeline'
        });
      }

      const metrics = pipeline.getMetrics();
      const isCapturing = pipeline.isCapturing();

      res.json({
        isCapturing,
        metrics,
        sessionId
      });

    } catch (error) {
      console.error('Audio status error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get audio status'
      });
    }
  });

  /**
   * POST /v1/audio/cleanup
   * Clean up audio pipeline for a session
   */
  router.post('/cleanup', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          error: 'Missing sessionId',
          message: 'Session ID is required for cleanup'
        });
      }

      const pipeline = pipelines.get(sessionId);
      if (pipeline) {
        pipeline.destroy();
        pipelines.delete(sessionId);
      }

      res.json({
        success: true,
        sessionId,
        message: 'Audio pipeline cleaned up successfully'
      });

    } catch (error) {
      console.error('Audio cleanup error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to cleanup audio pipeline'
      });
    }
  });

  return router;
}
