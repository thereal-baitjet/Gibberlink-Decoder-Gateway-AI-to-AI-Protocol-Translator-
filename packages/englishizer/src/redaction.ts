import { RedactionRule } from './types';

// Default redaction rules for common sensitive data patterns
export const DEFAULT_REDACTION_RULES: RedactionRule[] = [
  // Passwords and tokens
  {
    pattern: /password/i,
    replacement: '«redacted»',
    fieldPaths: ['password', 'passwd', 'pwd', 'token', 'secret', 'key', 'apiKey', 'auth']
  },
  // Credit card numbers
  {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
    replacement: '«redacted»',
    fieldPaths: ['creditCard', 'cardNumber', 'cc', 'ccNumber']
  },
  // Social Security Numbers
  {
    pattern: /\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/,
    replacement: '«redacted»',
    fieldPaths: ['ssn', 'socialSecurity', 'social']
  },
  // Email addresses
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    replacement: '«redacted»',
    fieldPaths: ['email', 'e-mail', 'mail']
  },
  // Phone numbers
  {
    pattern: /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/,
    replacement: '«redacted»',
    fieldPaths: ['phone', 'telephone', 'mobile', 'cell']
  },
  // IP addresses
  {
    pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
    replacement: '«redacted»',
    fieldPaths: ['ip', 'ipAddress', 'address']
  },
  // Private keys and certificates
  {
    pattern: /-----BEGIN.*PRIVATE KEY-----/,
    replacement: '«redacted»',
    fieldPaths: ['privateKey', 'private_key', 'key', 'cert', 'certificate']
  }
];

export class Redactor {
  private rules: RedactionRule[];

  constructor(rules: RedactionRule[] = DEFAULT_REDACTION_RULES) {
    this.rules = rules;
  }

  /**
   * Redact sensitive data from a payload object
   */
  redactPayload(payload: any): { redacted: any; redactions: string[] } {
    const redactions: string[] = [];
    const redacted = this.redactObject(payload, '', redactions);
    return { redacted, redactions };
  }

  /**
   * Redact sensitive data from a string
   */
  redactString(text: string): { redacted: string; redactions: string[] } {
    const redactions: string[] = [];
    let redacted = text;

    for (const rule of this.rules) {
      if (typeof rule.pattern === 'string') {
        if (redacted.includes(rule.pattern)) {
          redacted = redacted.replace(new RegExp(rule.pattern, 'gi'), rule.replacement);
          redactions.push(`string:${rule.pattern}`);
        }
      } else {
        const matches = redacted.match(rule.pattern);
        if (matches) {
          redacted = redacted.replace(rule.pattern, rule.replacement);
          redactions.push(`regex:${rule.pattern.source}`);
        }
      }
    }

    return { redacted, redactions };
  }

  private redactObject(obj: any, path: string, redactions: string[]): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      const { redacted, redactions: stringRedactions } = this.redactString(obj);
      redactions.push(...stringRedactions.map(r => `${path}:${r}`));
      return redacted;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) => 
        this.redactObject(item, `${path}[${index}]`, redactions)
      );
    }

    if (typeof obj === 'object') {
      const redacted: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Check if this field should be redacted based on field paths
        const shouldRedact = this.rules.some(rule => 
          rule.fieldPaths?.some(fieldPath => 
            currentPath.toLowerCase().includes(fieldPath.toLowerCase())
          )
        );

        if (shouldRedact) {
          redacted[key] = '«redacted»';
          redactions.push(currentPath);
        } else {
          redacted[key] = this.redactObject(value, currentPath, redactions);
        }
      }

      return redacted;
    }

    return obj;
  }

  /**
   * Add a custom redaction rule
   */
  addRule(rule: RedactionRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a redaction rule by pattern
   */
  removeRule(pattern: RegExp | string): void {
    this.rules = this.rules.filter(rule => 
      rule.pattern !== pattern
    );
  }

  /**
   * Get all current redaction rules
   */
  getRules(): RedactionRule[] {
    return [...this.rules];
  }
}
