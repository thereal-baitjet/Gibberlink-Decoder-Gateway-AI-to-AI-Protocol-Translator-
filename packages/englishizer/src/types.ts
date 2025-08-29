export interface Englishized {
  text: string;                // final plain English (<= 6 sentences)
  bullets?: string[];          // optional highlights
  glossary?: Record<string, string>; // injected short defs when terms appear
  fields: Record<string, any>; // extracted normalized fields used in text
  redactions?: string[];       // list of redacted field paths
  msgId: string;               // original message id
  confidence: number;          // 0..1 (1 for deterministic templates)
  sourceMapping?: Record<string, string[]>; // words/sentences -> field paths for audit
}

export type GatewayEventKind = 
  | 'handshake' 
  | 'capabilities' 
  | 'message' 
  | 'ack' 
  | 'error' 
  | 'compute-request'
  | 'policy-decision'
  | 'unknown';

export interface GatewayEvent {
  kind: GatewayEventKind;
  payload: any;                // decoded JSON from codec layer
  meta: { 
    msgId: string; 
    transport: string; 
    codec: string; 
    ts: number;
    sessionId?: string;
  };
}

export interface EnglishizerOptions {
  maxSentences?: number;       // default: 6
  includeGlossary?: boolean;   // default: true
  includeBullets?: boolean;    // default: false
  includeSourceMapping?: boolean; // default: false
  redactionRules?: RedactionRule[];
  customTemplates?: Record<string, TemplateRenderer>;
}

export interface RedactionRule {
  pattern: RegExp | string;
  replacement: string;
  fieldPaths?: string[];       // specific JSON paths to check
}

export interface TemplateRenderer {
  (event: GatewayEvent): Englishized;
}

export interface SchemaMatcher {
  (payload: any): boolean;
}

export interface RegisteredTemplate {
  kind: string;
  matcher: SchemaMatcher;
  renderer: TemplateRenderer;
}

export interface LLMConfig {
  enabled: boolean;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  schema?: any; // JSON schema for output validation
}

export interface EnglishizerConfig {
  options: EnglishizerOptions;
  llm?: LLMConfig;
  templates: RegisteredTemplate[];
}
