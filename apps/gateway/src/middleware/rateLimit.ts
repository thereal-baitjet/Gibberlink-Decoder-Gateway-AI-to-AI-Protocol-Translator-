import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class RateLimiter {
  private limiter: RateLimiterMemory;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.limiter = new RateLimiterMemory({
      keyPrefix: 'gibberlink_gateway',
      points: config.maxRequests,
      duration: config.windowMs / 1000, // Convert to seconds
    });
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.config.keyGenerator ? 
          this.config.keyGenerator(req) : 
          (req as any).apiKey || req.ip;

        const result = await this.limiter.consume(key);
        
        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': this.config.maxRequests,
          'X-RateLimit-Remaining': result.remainingPoints,
          'X-RateLimit-Reset': new Date(Date.now() + result.msBeforeNext).toISOString(),
        });

        next();
      } catch (error: any) {
        if (error.remainingPoints === 0) {
          const retryAfterMs = error.msBeforeNext;
          
          return res.status(429).json({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            retryAfterMs,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          });
        }
        
        next(error);
      }
    };
  }

  async checkLimit(key: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfterMs?: number;
  }> {
    try {
      const result = await this.limiter.consume(key);
      return {
        allowed: true,
        remaining: result.remainingPoints,
        resetTime: Date.now() + result.msBeforeNext,
      };
    } catch (error: any) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + error.msBeforeNext,
        retryAfterMs: error.msBeforeNext,
      };
    }
  }
}

export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}
