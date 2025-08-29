import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface ApiKeyConfig {
  keys: Map<string, string>; // key -> secret mapping
}

export class ApiKeyAuth {
  private keys: Map<string, string>;

  constructor(config: ApiKeyConfig) {
    this.keys = config.keys;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'API key required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      if (!this.keys.has(apiKey)) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Invalid API key',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Add API key info to request for audit logging
      (req as any).apiKey = apiKey;
      (req as any).apiKeySecret = this.keys.get(apiKey);

      next();
    };
  }

  validateHmac(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  generateHmac(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }
}

export function parseApiKeys(keysString: string): Map<string, string> {
  const keys = new Map<string, string>();
  
  if (!keysString) {
    return keys;
  }

  const pairs = keysString.split(',');
  for (const pair of pairs) {
    const [key, secret] = pair.split(':');
    if (key && secret) {
      keys.set(key.trim(), secret.trim());
    }
  }

  return keys;
}
