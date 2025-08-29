// Core types and interfaces
export * from './types';

// Main Englishizer class
export { Englishizer } from './englishizer';

// Redaction utilities
export { Redactor, DEFAULT_REDACTION_RULES } from './redaction';

// Schema detection
export { SchemaDetector } from './schema-detector';

// Glossary utilities
export { 
  PROTOCOL_GLOSSARY, 
  extractGlossaryTerms, 
  markGlossaryTerms, 
  getTermDefinition,
  addCustomTerms 
} from './glossary';

// Template renderers
export { renderHandshake } from './templates/handshake';
export { renderComputeRequest } from './templates/compute-request';
export { renderAck } from './templates/ack';
export { renderError } from './templates/error';
export { renderPolicyDecision } from './templates/policy-decision';
export { renderSensorStatus } from './templates/sensor-status';
export { renderAudioError } from './templates/audio-error';
export { OpenAIAssist, OpenAIConfig } from './openai-assist';
export { renderGeneric } from './templates/generic';

// Factory function for easy creation
export function createEnglishizer(options?: any, llmConfig?: any) {
  return new (require('./englishizer').Englishizer)(options, llmConfig);
}
