import { Router, Request, Response } from 'express';

export function healthRoutes(): Router {
  const router = Router();

  router.get('/', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      transports: ['ws', 'udp', 'audio'],
      codecs: ['msgpack', 'cbor', 'json'],
      version: '1.0.0'
    });
  });

  return router;
}
