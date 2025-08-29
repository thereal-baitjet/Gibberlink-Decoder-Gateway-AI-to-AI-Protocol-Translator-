import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { parseApiKeys } from './middleware/auth';
import { createRateLimiter } from './middleware/rateLimit';
import { PolicyEngineImpl, defaultPolicyConfig } from './services/policy';
import { AuditLogger, defaultAuditConfig } from './services/audit';
import { SessionManager, InMemorySessionStore } from './services/session';
import { createRoutes, RouteDependencies } from './routes';
import { Englishizer, OpenAIConfig } from '@gibberlink/englishizer';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

export interface GatewayConfig {
  port: number;
  apiKeys: string;
  rateLimitWindow: number;
  rateLimitMaxRequests: number;
  auditLogPath: string;
  transcriptStoragePath: string;
}

export class Gateway {
  private app: express.Application;
  private server: any;
  private wss!: WebSocketServer;
  private config: GatewayConfig;
  private auth: any;
  private rateLimiter: any;
  private policyEngine!: PolicyEngineImpl;
  private auditLogger!: AuditLogger;
  private sessionManager!: SessionManager;
  private englishizer: any;

  constructor(config: GatewayConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupServices();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request ID middleware
    this.app.use((req, res, next) => {
      req.headers['x-request-id'] = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      next();
    });

    // API key authentication
    const apiKeys = parseApiKeys(this.config.apiKeys);
    this.auth = { keys: apiKeys };

    // Rate limiting
    this.rateLimiter = createRateLimiter({
      windowMs: this.config.rateLimitWindow,
      maxRequests: this.config.rateLimitMaxRequests,
    });
  }

  private setupServices(): void {
    // Policy engine
    this.policyEngine = new PolicyEngineImpl(defaultPolicyConfig);

    // Audit logger
    this.auditLogger = new AuditLogger({
      logPath: this.config.auditLogPath,
      maxFileSize: defaultAuditConfig.maxFileSize,
      maxFiles: defaultAuditConfig.maxFiles,
    });

    // Session manager
    const sessionStore = new InMemorySessionStore();
    this.sessionManager = new SessionManager(sessionStore);

    // Englishizer for plain English translation with OpenAI enhancement
    const openaiConfig: OpenAIConfig | undefined = process.env.OPENAI_API_KEY ? {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3')
    } : undefined;
    
    this.englishizer = new Englishizer({}, undefined, openaiConfig);
  }

  private setupRoutes(): void {
    // Health check (no auth required)
    this.app.get('/v1/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        transports: ['ws', 'udp', 'audio'],
        codecs: ['msgpack', 'cbor', 'json'],
        version: '1.0.0'
      });
    });

    // API routes (with auth)
    this.app.use('/v1', (req, res, next) => {
      // Skip auth for health endpoint
      if (req.path === '/health') {
        return next();
      }

      // Apply auth middleware
      const authMiddleware = require('./middleware/auth').ApiKeyAuth;
      const authInstance = new authMiddleware(this.auth);
      return authInstance.middleware()(req, res, next);
    });

    this.app.use('/v1', (req, res, next) => {
      // Apply rate limiting
      return this.rateLimiter.middleware()(req, res, next);
    });

    // Mount API routes
    const routeDeps: RouteDependencies = {
      sessionManager: this.sessionManager,
      policyEngine: this.policyEngine,
      auditLogger: this.auditLogger,
    };
    this.app.use('/', createRoutes(routeDeps));
  }

  private setupWebSocket(): void {
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws, req) => {
      console.log('WebSocket client connected');

      // Extract session ID from query params
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        ws.close(1008, 'Session ID required');
        return;
      }

      // Validate session
      const session = this.sessionManager.getSession(sessionId);
      if (!session) {
        ws.close(1008, 'Invalid session');
        return;
      }

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'send') {
            // Handle send message
            console.log('Received WebSocket message:', message);
            
            const msgId = `ws_${Date.now()}`;
            
            // Generate English translation
            let englishized = null;
            try {
              const event = {
                kind: 'unknown',
                payload: message.payload,
                meta: {
                  msgId,
                  transport: 'WebSocket',
                  codec: 'JSON',
                  ts: Date.now(),
                  sessionId
                }
              };
              
              englishized = await this.englishizer.toPlainEnglish(event);
            } catch (error) {
              console.warn('Failed to generate English translation:', error);
            }
            
            // Echo back for demo with English translation
            const response = {
              type: 'recv',
              msgId,
              payload: message.payload,
              timestamp: new Date().toISOString(),
            };
            
            // Add English translation if available
            if (englishized) {
              (response as any).english = {
                text: englishized.text,
                confidence: englishized.confidence,
                glossary: englishized.glossary,
                redactions: englishized.redactions
              };
            }
            
            ws.send(JSON.stringify(response));
            
            // Also send plain English version
            if (englishized) {
              ws.send(JSON.stringify({
                type: 'recv.plain',
                msgId,
                text: englishized.text,
                confidence: englishized.confidence,
                timestamp: new Date().toISOString(),
              }));
            }
          } else if (message.type === 'audio.start') {
            // Handle audio start request
            console.log('Audio start request:', message);
            
            // This would integrate with the AudioToPlainPipeline
            // For now, send acknowledgment
            ws.send(JSON.stringify({
              type: 'audio.started',
              deviceId: message.deviceId,
              timestamp: new Date().toISOString(),
            }));
            
          } else if (message.type === 'audio.frame') {
            // Handle simulated audio frame (for backward compatibility)
            console.log('Received simulated audio frame:', message);
            
            const frame = message;
            const msgId = frame.msgId || `audio_${Date.now()}`;
            
            // Generate English translation for audio frame
            let englishized = null;
            try {
              const event = {
                kind: 'unknown',
                payload: frame.payload,
                meta: {
                  msgId,
                  transport: 'Audio',
                  codec: 'JSON',
                  ts: frame.timestamp || Date.now(),
                  sessionId
                }
              };
              
              englishized = await this.englishizer.toPlainEnglish(event);
              
              // Send the translation back to the client
              if (englishized) {
                console.log('✅ Sending translation:', englishized.text);
                ws.send(JSON.stringify({
                  type: 'recv.plain',
                  msgId,
                  text: englishized.text,
                  confidence: englishized.confidence,
                  snrDb: 18.5, // Mock SNR
                  lockPct: 85.2, // Mock lock percentage
                  timestamp: new Date().toISOString(),
                }));
              }
            } catch (error) {
              console.warn('Failed to generate English translation for audio frame:', error);
            }
          } else if (message.type === 'audio.raw') {
            // Handle real audio data for FSK demodulation
            console.log('Received real audio data for FSK demodulation:', message.frame);
            
            const frame = message.frame;
            const msgId = frame.msgId || `audio_${Date.now()}`;
            
            try {
              // Convert audio data back to Float32Array
              const audioData = new Float32Array(frame.audioData);
              
              // Process with real FSK demodulation
              const { AudioDecoderImpl } = await import('@gibberlink/audio-decoder');
              
              const decoder = new AudioDecoderImpl({
                sampleRate: frame.sampleRate || 48000,
                symbolRate: 1200,
                tones: [1200, 1800, 2400, 3000],
                windowSize: 1024,
                overlap: 0.5,
                noiseThreshold: 0.01,
                silenceThreshold: 0.001,
                maxFrameSize: 1024
              });
              
              // Attempt to decode the audio data
              const decodedFrames = await decoder.decodeChunk(audioData);
              
              if (decodedFrames.length > 0) {
                console.log(`✅ Successfully decoded ${decodedFrames.length} frames from real audio`);
                
                for (const decodedFrame of decodedFrames) {
                  try {
                    const decodedText = new TextDecoder().decode(decodedFrame);
                    const decodedJson = JSON.parse(decodedText);
                    
                    // Generate English translation for decoded frame
                    const event = {
                      kind: 'unknown',
                      payload: decodedJson,
                      meta: {
                        msgId: `${msgId}_decoded`,
                        transport: 'Audio',
                        codec: 'FSK',
                        ts: frame.timestamp || Date.now(),
                        sessionId
                      }
                    };
                    
                    const englishized = await this.englishizer.toPlainEnglish(event);
                    
                    // Send decoded frame and translation
                    ws.send(JSON.stringify({
                      type: 'recv.plain',
                      msgId: `${msgId}_decoded`,
                      text: englishized.text,
                      confidence: englishized.confidence,
                      snrDb: frame.rms * 20, // Convert RMS to approximate SNR
                      lockPct: 85, // Mock lock percentage
                      timestamp: new Date().toISOString(),
                    }));
                    
                  } catch (error) {
                    console.warn('Failed to parse decoded frame:', error);
                  }
                }
              } else {
                console.log('❌ No frames decoded from real audio data');
                
                // Send acknowledgment that audio was received but no FSK signal detected
                ws.send(JSON.stringify({
                  type: 'audio.noise',
                  msgId,
                  message: 'Audio received but no FSK signal detected',
                  rms: frame.rms,
                  timestamp: new Date().toISOString(),
                }));
              }
              
                          } catch (error) {
                console.error('Failed to process real audio data:', error);
                
                ws.send(JSON.stringify({
                  type: 'audio.error',
                  msgId,
                  error: error instanceof Error ? error.message : 'Unknown error',
                  timestamp: new Date().toISOString(),
                }));
              }
            } else if (message.type === 'audio.stop') {
              // Handle audio stop request
              console.log('Audio stop request');
              
              ws.send(JSON.stringify({
                type: 'audio.stopped',
                timestamp: new Date().toISOString(),
              }));
            }
        } catch (error) {
          console.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
            timestamp: new Date().toISOString(),
          }));
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  async start(): Promise<void> {
    try {
      // Initialize audit logger
      await this.auditLogger.initialize();

      // Start server
      this.server.listen(this.config.port, () => {
        console.log(`Gibberlink Gateway listening on port ${this.config.port}`);
        console.log(`Health check: http://localhost:${this.config.port}/v1/health`);
        console.log(`WebSocket: ws://localhost:${this.config.port}/v1/messages`);
      });
    } catch (error) {
      console.error('Failed to start gateway:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        this.sessionManager.destroy();
        this.auditLogger.close();
        console.log('Gateway stopped');
        resolve();
      });
    });
  }
}

// Start the gateway if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const config: GatewayConfig = {
    port: parseInt(process.env.PORT || '8080'),
    apiKeys: process.env.API_KEYS || 'devkey:testkey',
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    auditLogPath: process.env.AUDIT_LOG_PATH || './logs/audit.jsonl',
    transcriptStoragePath: process.env.TRANSCRIPT_STORAGE_PATH || './data/transcripts',
  };

  const gateway = new Gateway(config);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down gateway...');
    await gateway.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Shutting down gateway...');
    await gateway.stop();
    process.exit(0);
  });

  gateway.start().catch((error) => {
    console.error('Failed to start gateway:', error);
    process.exit(1);
  });
}

// Export the AudioToPlainPipeline for external use
export { AudioToPlainPipeline } from './pipeline/audioToPlain';
