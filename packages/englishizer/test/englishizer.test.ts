import { describe, it, expect, beforeEach } from 'vitest';
import { 
  Englishizer, 
  createEnglishizer,
  renderHandshake,
  renderComputeRequest,
  renderAck,
  renderError,
  renderPolicyDecision,
  renderGeneric
} from '../src/index';
import { GatewayEvent } from '../src/types';

describe('Englishizer', () => {
  let englishizer: Englishizer;

  beforeEach(() => {
    englishizer = createEnglishizer();
  });

  describe('Handshake Messages', () => {
    it('should render handshake with basic capabilities', async () => {
      const event: GatewayEvent = {
        kind: 'handshake',
        payload: {
          hello: true,
          caps: {
            mtu: 16384,
            fec: true,
            compression: 'zstd'
          }
        },
        meta: {
          msgId: 'test-123',
          transport: 'WebSocket',
          codec: 'MessagePack',
          ts: Date.now()
        }
      };

      const result = await englishizer.toPlainEnglish(event);
      
      expect(result.text).toContain('The agents agreed to communicate over WebSocket');
      expect(result.text).toContain('MessagePack codec');
      expect(result.text).toContain('zstd compression');
      expect(result.text).toContain('Forward error correction is enabled');
      expect(result.text).toContain('16 KB');
      expect(result.confidence).toBe(1);
      expect(result.glossary).toBeDefined();
    });

    it('should render handshake without optional features', async () => {
      const event: GatewayEvent = {
        kind: 'handshake',
        payload: {
          hello: true,
          caps: {
            mtu: 1500
          }
        },
        meta: {
          msgId: 'test-124',
          transport: 'UDP',
          codec: 'JSON',
          ts: Date.now()
        }
      };

      const result = await englishizer.toPlainEnglish(event);
      
      expect(result.text).toContain('The agents agreed to communicate over UDP');
      expect(result.text).toContain('JSON codec');
      expect(result.text).not.toContain('compression');
      expect(result.text).not.toContain('Forward error correction');
    });
  });

  describe('Compute Request Messages', () => {
    it('should render compute request with operation and arguments', async () => {
      const event: GatewayEvent = {
        kind: 'compute-request',
        payload: {
          op: 'sum',
          args: { a: 2, b: 3 },
          id: 'req-456'
        },
        meta: {
          msgId: 'test-125',
          transport: 'WebSocket',
          codec: 'MessagePack',
          ts: Date.now()
        }
      };

      const result = await englishizer.toPlainEnglish(event);
      
      expect(result.text).toContain('One agent asked the other to perform "sum"');
      expect(result.text).toContain('a: 2, b: 3');
      expect(result.text).toContain('request ID is req-456');
      expect(result.confidence).toBe(1);
    });

    it('should render compute request without arguments', async () => {
      const event: GatewayEvent = {
        kind: 'compute-request',
        payload: {
          op: 'ping'
        },
        meta: {
          msgId: 'test-126',
          transport: 'WebSocket',
          codec: 'MessagePack',
          ts: Date.now()
        }
      };

      const result = await englishizer.toPlainEnglish(event);
      
      expect(result.text).toContain('One agent asked the other to perform "ping"');
      expect(result.text).toContain('and return the result');
    });
  });

  describe('Acknowledgment Messages', () => {
    it('should render ack with reference and data', async () => {
      const event: GatewayEvent = {
        kind: 'ack',
        payload: {
          msgIdRef: 'req-456',
          status: 'success',
          data: 'Hello World'
        },
        meta: {
          msgId: 'test-127',
          transport: 'WebSocket',
          codec: 'MessagePack',
          ts: Date.now()
        }
      };

      const result = await englishizer.toPlainEnglish(event);
      
      expect(result.text).toContain('The agent acknowledged receipt of message req-456');
      expect(result.text).toContain('The response is "Hello World"');
      expect(result.confidence).toBe(1);
    });

    it('should render ack with error status', async () => {
      const event: GatewayEvent = {
        kind: 'ack',
        payload: {
          msgIdRef: 'req-457',
          status: 'error',
          data: { error: 'Invalid input' }
        },
        meta: {
          msgId: 'test-128',
          transport: 'WebSocket',
          codec: 'MessagePack',
          ts: Date.now()
        }
      };

      const result = await englishizer.toPlainEnglish(event);
      
      expect(result.text).toContain('The agent acknowledged receipt of message req-457');
      expect(result.text).toContain('The status is "error"');
      expect(result.text).toContain('The response contains 1 fields');
    });
  });

  describe('Error Messages', () => {
    it('should render error with message and code', async () => {
      const event: GatewayEvent = {
        kind: 'error',
        payload: {
          error: 'Invalid operation',
          code: 'INVALID_OP',
          msgIdRef: 'req-458'
        },
        meta: {
          msgId: 'test-129',
          transport: 'WebSocket',
          codec: 'MessagePack',
          ts: Date.now()
        }
      };

      const result = await englishizer.toPlainEnglish(event);
      
      expect(result.text).toContain('An error occurred: Invalid operation');
      expect(result.text).toContain('The error code is INVALID_OP');
      expect(result.text).toContain('This relates to message req-458');
      expect(result.confidence).toBe(1);
    });
  });

  describe('Policy Decision Messages', () => {
    it('should render policy decision with details', async () => {
      const event: GatewayEvent = {
        kind: 'policy-decision',
        payload: {
          decision: 'denied',
          policy: 'PII_guard',
          resource: 'user_data',
          actor: 'session-123',
          reason: 'Contains sensitive information'
        },
        meta: {
          msgId: 'test-130',
          transport: 'WebSocket',
          codec: 'MessagePack',
          ts: Date.now()
        }
      };

      const result = await englishizer.toPlainEnglish(event);
      
      expect(result.text).toContain('The policy engine denied the request');
      expect(result.text).toContain('This was based on policy "PII_guard"');
      expect(result.text).toContain('The affected resource is "user_data"');
      expect(result.text).toContain('The request was made by session-123');
      expect(result.text).toContain('Reason: Contains sensitive information');
      expect(result.confidence).toBe(1);
    });
  });

  describe('Generic Messages', () => {
    it('should render unknown message types generically', async () => {
      const event: GatewayEvent = {
        kind: 'unknown',
        payload: {
          customField: 'custom value',
          numberField: 42,
          arrayField: [1, 2, 3]
        },
        meta: {
          msgId: 'test-131',
          transport: 'WebSocket',
          codec: 'MessagePack',
          ts: Date.now()
        }
      };

      const result = await englishizer.toPlainEnglish(event);
      
      expect(result.text).toContain('A message was received with 3 fields');
      expect(result.bullets).toContain('customField: "custom value"');
      expect(result.bullets).toContain('numberField: 42');
      expect(result.bullets).toContain('arrayField: 3 items');
      expect(result.confidence).toBe(0.3);
    });
  });

  describe('Redaction', () => {
    it('should redact sensitive information', async () => {
      const event: GatewayEvent = {
        kind: 'compute-request',
        payload: {
          op: 'login',
          args: {
            username: 'john_doe',
            password: 'secret123',
            email: 'john@example.com'
          }
        },
        meta: {
          msgId: 'test-132',
          transport: 'WebSocket',
          codec: 'MessagePack',
          ts: Date.now()
        }
      };

      const result = await englishizer.toPlainEnglish(event);
      
      expect(result.text).toContain('One agent asked the other to perform "login"');
      expect(result.text).toContain('username: "john_doe"');
      expect(result.text).not.toContain('secret123');
      expect(result.text).not.toContain('john@example.com');
      expect(result.redactions).toContain('args.password');
      expect(result.redactions).toContain('args.email');
    });
  });

  describe('Glossary Integration', () => {
    it('should include glossary terms', async () => {
      const event: GatewayEvent = {
        kind: 'handshake',
        payload: {
          hello: true,
          caps: {
            mtu: 16384,
            fec: true
          }
        },
        meta: {
          msgId: 'test-133',
          transport: 'WebSocket',
          codec: 'MessagePack',
          ts: Date.now()
        }
      };

      const result = await englishizer.toPlainEnglish(event);
      
      expect(result.glossary).toBeDefined();
      expect(result.glossary!['FEC']).toContain('Forward Error Correction');
      expect(result.glossary!['MTU']).toContain('Maximum Transmission Unit');
    });
  });

  describe('Options', () => {
    it('should respect maxSentences option', async () => {
      const englishizerWithOptions = createEnglishizer({ maxSentences: 2 });
      
      const event: GatewayEvent = {
        kind: 'handshake',
        payload: {
          hello: true,
          caps: {
            mtu: 16384,
            fec: true,
            compression: 'zstd',
            crypto: true
          }
        },
        meta: {
          msgId: 'test-134',
          transport: 'WebSocket',
          codec: 'MessagePack',
          ts: Date.now()
        }
      };

      const result = await englishizerWithOptions.toPlainEnglish(event);
      
      const sentenceCount = result.text.split(/[.!?]+/).filter(s => s.trim()).length;
      expect(sentenceCount).toBeLessThanOrEqual(2);
    });

    it('should exclude glossary when disabled', async () => {
      const englishizerWithOptions = createEnglishizer({ includeGlossary: false });
      
      const event: GatewayEvent = {
        kind: 'handshake',
        payload: {
          hello: true,
          caps: { mtu: 16384 }
        },
        meta: {
          msgId: 'test-135',
          transport: 'WebSocket',
          codec: 'MessagePack',
          ts: Date.now()
        }
      };

      const result = await englishizerWithOptions.toPlainEnglish(event);
      
      expect(result.glossary).toBeUndefined();
    });
  });
});
