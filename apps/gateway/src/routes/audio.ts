import { Router, Request, Response } from 'express';
import { 
  createAudioDecoder, 
  createAudioFileReader, 
  AudioPresets,
  AudioProcessingConfig 
} from '@gibberlink/audio-decoder';
import { FramerV1, JSONCodec } from '@gibberlink/protocol-core';
import { AuditLogger } from '../services/audit';
import { PolicyEngineImpl } from '../services/policy';

export interface AudioRouteDependencies {
  auditLogger: AuditLogger;
  policyEngine: PolicyEngineImpl;
}

export function createAudioRoutes(deps: AudioRouteDependencies) {
  const router = Router();
  // Note: Auth and rate limiting are handled at the gateway level

  // POST /v1/decode-audio - Batch audio decode
  router.post('/decode-audio', async (req: Request, res: Response) => {
    try {
      const { file, format, preset = 'highQuality', requireTranscript = false } = req.body;

      if (!file) {
        return res.status(400).json({
          error: 'MISSING_FILE',
          message: 'Audio file data is required'
        });
      }

      // Check policy
      const policyResult = await deps.policyEngine.checkPolicy(
        { audio: { format, preset } },
        { allowAudio: true }
      );

      if (!policyResult.allowed) {
        return res.status(403).json({
          error: 'POLICY_VIOLATION',
          message: 'Audio processing not allowed by policy',
          details: policyResult.reasons
        });
      }

      const fileReader = createAudioFileReader();
      const decoder = createAudioDecoder(AudioPresets[preset as keyof typeof AudioPresets]);
      
      const chunks = await fileReader.readBase64(file);
      const results: any[] = [];
      const msgIds: string[] = [];

      let totalFrames = 0;
      for (const chunk of chunks) {
        const frames = decoder.decodeChunk(chunk.pcm);
        totalFrames += frames.length;
        
        for (const frame of frames) {
          try {
            // Try to decode using protocol
            const framer = new FramerV1();
            const codec = new JSONCodec();
            
            const deframed = framer.deframe(frame);
            if (deframed) {
              const decoded = codec.decode(deframed);
              if (decoded) {
                const text = new TextDecoder().decode(decoded);
                const json = JSON.parse(text);
                
                const msgId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                msgIds.push(msgId);
                
                results.push({
                  msgId,
                  timestamp: chunk.timestamp,
                  data: json,
                  size: frame.length,
                  snr: decoder.getStats().averageSnr
                });

                // Log audit entry
                if (requireTranscript) {
                  await deps.auditLogger.log({
                    msgId,
                    route: '/v1/decode-audio',
                    actor: req.headers['x-api-key'] as string || 'unknown',
                    timestamp: new Date().toISOString(),
                    payload: json,
                    policyDecision: 'ALLOWED',
                    metadata: {
                      audio: {
                        format,
                        preset,
                        snr: decoder.getStats().averageSnr,
                        frameCount: totalFrames
                      }
                    }
                  });
                }
              }
            }
          } catch (error) {
            console.warn('Frame decode error:', error);
          }
        }
      }

      const stats = decoder.getStats();
      
      res.json({
        msgIds,
        transcripts: results,
        stats: {
          totalChunks: stats.totalChunks,
          totalFrames: stats.totalFrames,
          averageSnr: stats.averageSnr,
          errorRate: stats.errorRate
        },
        errors: []
      });

    } catch (error) {
      console.error('Audio decode error:', error);
      res.status(500).json({
        error: 'DECODE_FAILED',
        message: 'Failed to decode audio file',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /v1/audio/start - Start audio capture
  router.post('/audio/start', async (req: Request, res: Response) => {
    try {
      const { sessionId, deviceId, preset = 'lowLatency' } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          error: 'MISSING_SESSION',
          message: 'Session ID is required'
        });
      }

      // Check policy
      const policyResult = await deps.policyEngine.checkPolicy(
        { audio: { deviceId, preset } },
        { allowAudio: true }
      );

      if (!policyResult.allowed) {
        return res.status(403).json({
          error: 'POLICY_VIOLATION',
          message: 'Audio capture not allowed by policy',
          details: policyResult.reasons
        });
      }

      // For now, just return success
      // In a real implementation, you would start audio capture for the session
      res.json({
        sessionId,
        status: 'started',
        deviceId,
        preset,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Audio start error:', error);
      res.status(500).json({
        error: 'START_FAILED',
        message: 'Failed to start audio capture',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /v1/audio/stop - Stop audio capture
  router.post('/audio/stop', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          error: 'MISSING_SESSION',
          message: 'Session ID is required'
        });
      }

      // For now, just return success
      // In a real implementation, you would stop audio capture for the session
      res.json({
        sessionId,
        status: 'stopped',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Audio stop error:', error);
      res.status(500).json({
        error: 'STOP_FAILED',
        message: 'Failed to stop audio capture',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /v1/audio/devices - List audio devices
  router.get('/audio/devices', async (req: Request, res: Response) => {
    try {
      // For now, return mock devices
      // In a real implementation, you would query the system for available devices
      const devices = [
        {
          id: 'default',
          name: 'Default Microphone',
          type: 'input' as const,
          sampleRates: [8000, 16000, 22050, 44100, 48000],
          channels: 1
        }
      ];

      res.json({
        devices,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Audio devices error:', error);
      res.status(500).json({
        error: 'DEVICES_FAILED',
        message: 'Failed to get audio devices',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
