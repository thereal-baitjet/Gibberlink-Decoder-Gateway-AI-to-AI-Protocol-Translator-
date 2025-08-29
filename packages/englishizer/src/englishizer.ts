import { 
  GatewayEvent, 
  Englishized, 
  EnglishizerOptions, 
  TemplateRenderer,
  LLMConfig 
} from './types';
import { Redactor } from './redaction';
import { SchemaDetector } from './schema-detector';
import { renderHandshake } from './templates/handshake';
import { renderComputeRequest } from './templates/compute-request';
import { renderAck } from './templates/ack';
import { renderError } from './templates/error';
import { renderPolicyDecision } from './templates/policy-decision';
import { renderGeneric } from './templates/generic';
import { renderSensorStatus } from './templates/sensor-status';
import { renderAudioError } from './templates/audio-error';
import { extractGlossaryTerms, markGlossaryTerms } from './glossary';
import { OpenAIAssist, OpenAIConfig } from './openai-assist';

export class Englishizer {
  private redactor: Redactor;
  private schemaDetector: SchemaDetector;
  private options: EnglishizerOptions;
  private llmConfig?: LLMConfig;
  private customTemplates: Map<string, TemplateRenderer> = new Map();
  private openaiAssist?: OpenAIAssist;
  private messageHistory: GatewayEvent[] = [];

  constructor(options: EnglishizerOptions = {}, llmConfig?: LLMConfig, openaiConfig?: OpenAIConfig) {
    this.options = {
      maxSentences: 6,
      includeGlossary: true,
      includeBullets: false,
      includeSourceMapping: false,
      ...options
    };
    
    this.redactor = new Redactor(options.redactionRules);
    this.schemaDetector = new SchemaDetector();
    this.llmConfig = llmConfig;
    
    // Initialize OpenAI assistant if config provided
    if (openaiConfig?.apiKey) {
      this.openaiAssist = new OpenAIAssist(openaiConfig);
    }
    
    // Register custom templates
    if (options.customTemplates) {
      for (const [kind, renderer] of Object.entries(options.customTemplates)) {
        this.customTemplates.set(kind, renderer);
      }
    }
  }

  /**
   * Convert a gateway event to plain English
   */
  async toPlainEnglish(event: GatewayEvent): Promise<Englishized> {
    // First, redact sensitive data
    const { redacted: redactedPayload, redactions } = this.redactor.redactPayload(event.payload);
    
    // Create a new event with redacted payload
    const redactedEvent: GatewayEvent = {
      ...event,
      payload: redactedPayload
    };

    // Detect the message kind
    const kind = this.schemaDetector.detectKind(redactedPayload);
    redactedEvent.kind = kind;

    // Get the appropriate renderer
    const renderer = this.getRenderer(kind);
    
    // Render the English text
    let englishized = renderer(redactedEvent);
    
    // Add redactions
    englishized.redactions = redactions;
    
    // Apply options
    englishized = this.applyOptions(englishized);
    
    // Add to message history for context
    this.messageHistory.push(redactedEvent);
    if (this.messageHistory.length > 10) {
      this.messageHistory.shift(); // Keep only last 10 messages
    }
    
    // Try OpenAI enhancement if available
    if (this.openaiAssist && this.shouldEnhanceWithOpenAI(englishized)) {
      try {
        const enhanced = await this.enhanceWithOpenAI(redactedEvent, englishized);
        if (enhanced) {
          englishized = enhanced;
        }
      } catch (error) {
        console.warn('OpenAI enhancement failed:', error);
      }
    }
    
    // If LLM is enabled and confidence is low, try LLM enhancement
    if (this.llmConfig?.enabled && englishized.confidence < 0.5) {
      try {
        const enhanced = await this.enhanceWithLLM(redactedEvent, englishized);
        if (enhanced) {
          englishized = enhanced;
        }
      } catch (error) {
        console.warn('LLM enhancement failed:', error);
      }
    }
    
    return englishized;
  }

  /**
   * Get the appropriate renderer for a message kind
   */
  private getRenderer(kind: string): TemplateRenderer {
    // Check custom templates first
    if (this.customTemplates.has(kind)) {
      return this.customTemplates.get(kind)!;
    }
    
    // Use built-in templates
    switch (kind) {
      case 'handshake':
        return renderHandshake;
      case 'compute-request':
        return renderComputeRequest;
      case 'ack':
        return renderAck;
      case 'error':
        return renderError;
      case 'policy-decision':
        return renderPolicyDecision;
      case 'sensor-status':
        return renderSensorStatus;
      case 'audio-error':
        return renderAudioError;
      default:
        return renderGeneric;
    }
  }

  /**
   * Apply options to the Englishized result
   */
  private applyOptions(englishized: Englishized): Englishized {
    // Limit sentences if needed
    if (this.options.maxSentences && this.options.maxSentences < 6) {
      const sentences = englishized.text.split(/[.!?]+/).filter(s => s.trim());
      if (sentences.length > this.options.maxSentences) {
        englishized.text = sentences.slice(0, this.options.maxSentences).join('. ') + '.';
      }
    }

    // Remove glossary if not requested
    if (!this.options.includeGlossary) {
      englishized.glossary = undefined;
    }

    // Remove bullets if not requested
    if (!this.options.includeBullets) {
      englishized.bullets = undefined;
    }

    // Remove source mapping if not requested
    if (!this.options.includeSourceMapping) {
      englishized.sourceMapping = undefined;
    }

    // Mark glossary terms if glossary is included
    if (englishized.glossary && Object.keys(englishized.glossary).length > 0) {
      englishized.text = markGlossaryTerms(englishized.text, englishized.glossary);
    }

    return englishized;
  }

  /**
   * Determine if we should enhance with OpenAI
   */
  private shouldEnhanceWithOpenAI(englishized: Englishized): boolean {
    // Enhance if confidence is low or if it's a complex message type
    return englishized.confidence < 0.7 || 
           englishized.text.length > 100 ||
           this.options.includeGlossary;
  }

  /**
   * Enhance the result with OpenAI
   */
  private async enhanceWithOpenAI(event: GatewayEvent, current: Englishized): Promise<Englishized | null> {
    if (!this.openaiAssist) {
      return null;
    }

    try {
      const request = {
        originalPayload: event.payload,
        detectedKind: event.kind || 'unknown',
        templateTranslation: current.text,
        confidence: current.confidence * 100,
        context: {
          previousMessages: this.messageHistory.slice(-3), // Last 3 messages
          sessionInfo: { sessionId: event.meta?.sessionId },
          timestamp: event.meta?.timestamp
        }
      };

      const response = await this.openaiAssist.enhanceTranslation(request);
      
      if (response.enhancedTranslation !== current.text) {
        return {
          ...current,
          text: response.enhancedTranslation,
          confidence: response.confidence / 100,
          sourceMapping: {
            ...current.sourceMapping,
            openaiEnhanced: true,
            openaiReasoning: response.reasoning,
            openaiSuggestions: response.suggestions,
            openaiContextInsights: response.contextInsights
          }
        };
      }
    } catch (error) {
      console.warn('OpenAI enhancement failed:', error);
    }

    return null;
  }

  /**
   * Enhance the result with LLM (optional)
   */
  private async enhanceWithLLM(event: GatewayEvent, current: Englishized): Promise<Englishized | null> {
    if (!this.llmConfig?.enabled || !this.llmConfig.apiKey) {
      return null;
    }

    // This is a placeholder for LLM integration
    // In a real implementation, you would call an LLM API here
    console.log('LLM enhancement would be called here');
    return null;
  }

  /**
   * Register a custom template
   */
  registerTemplate(kind: string, renderer: TemplateRenderer): void {
    this.customTemplates.set(kind, renderer);
  }

  /**
   * Remove a custom template
   */
  removeTemplate(kind: string): void {
    this.customTemplates.delete(kind);
  }

  /**
   * Add a redaction rule
   */
  addRedactionRule(pattern: RegExp | string, replacement: string, fieldPaths?: string[]): void {
    this.redactor.addRule({ pattern, replacement, fieldPaths });
  }

  /**
   * Get current configuration
   */
  getConfig(): { options: EnglishizerOptions; llmConfig?: LLMConfig } {
    return {
      options: { ...this.options },
      llmConfig: this.llmConfig ? { ...this.llmConfig } : undefined
    };
  }
}
