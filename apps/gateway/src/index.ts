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
            
            // Echo back for demo
            ws.send(JSON.stringify({
              type: 'recv',
              msgId: `ws_${Date.now()}`,
              payload: message.payload,
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
