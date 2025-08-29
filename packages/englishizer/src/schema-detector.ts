import { GatewayEventKind, SchemaMatcher, RegisteredTemplate } from './types';

export class SchemaDetector {
  private templates: RegisteredTemplate[] = [];
  
  constructor() {
    this.registerDefaultTemplates();
  }
  
  /**
   * Detect the kind of message based on payload structure
   */
  detectKind(payload: any): GatewayEventKind {
    // Check registered templates first
    for (const template of this.templates) {
      if (template.matcher(payload)) {
        console.log(`🔍 Template match: ${template.kind} for payload with op: ${payload?.op}`);
        return template.kind as GatewayEventKind;
      }
    }
    
    // Fallback to heuristics
    const heuristicKind = this.detectByHeuristics(payload);
    console.log(`🔍 Heuristic fallback: ${heuristicKind} for payload with op: ${payload?.op}`);
    return heuristicKind;
  }
  
  /**
   * Register a custom template
   */
  registerTemplate(template: RegisteredTemplate): void {
    this.templates.push(template);
  }
  
  /**
   * Remove a template by kind
   */
  removeTemplate(kind: string): void {
    this.templates = this.templates.filter(t => t.kind !== kind);
  }
  
  /**
   * Get all registered templates
   */
  getTemplates(): RegisteredTemplate[] {
    return [...this.templates];
  }
  
  private registerDefaultTemplates(): void {
    // Audio error detection (most specific)
    this.registerTemplate({
      kind: 'audio-error',
      matcher: (payload) => {
        return payload?.error === 'AUDIO_ERROR' ||
               (payload?.error && payload?.message && payload?.code);
      },
      renderer: () => ({ text: '', fields: {}, glossary: {}, redactions: [], msgId: '', confidence: 0 })
    });
    
    // Sensor/Status detection (specific operations)
    this.registerTemplate({
      kind: 'sensor-status',
      matcher: (payload) => {
        return payload?.op === 'sensor_read' ||
               payload?.op === 'status_check' ||
               payload?.op === 'status' ||
               payload?.sensor !== undefined ||
               payload?.component !== undefined;
      },
      renderer: () => ({ text: '', fields: {}, glossary: {}, redactions: [], msgId: '', confidence: 0 })
    });
    
    // Handshake detection
    this.registerTemplate({
      kind: 'handshake',
      matcher: (payload) => {
        return payload?.hello === true || 
               payload?.handshake === true ||
               (payload?.caps && typeof payload.caps === 'object') ||
               (payload?.capabilities && typeof payload.capabilities === 'object');
      },
      renderer: () => ({ text: '', fields: {}, glossary: {}, redactions: [], msgId: '', confidence: 0 })
    });
    
    // Compute request detection (general - should be last)
    this.registerTemplate({
      kind: 'compute-request',
      matcher: (payload) => {
        return payload?.op !== undefined ||
               payload?.operation !== undefined ||
               payload?.action !== undefined ||
               (payload?.args !== undefined) ||
               (payload?.arguments !== undefined);
      },
      renderer: () => ({ text: '', fields: {}, glossary: {}, redactions: [], msgId: '', confidence: 0 })
    });
    
    // Acknowledgment detection
    this.registerTemplate({
      kind: 'ack',
      matcher: (payload) => {
        return payload?.ack === true ||
               payload?.acknowledgment === true ||
               payload?.msgIdRef !== undefined ||
               payload?.ref !== undefined ||
               payload?.reference !== undefined;
      },
      renderer: () => ({ text: '', fields: {}, glossary: {}, redactions: [], msgId: '', confidence: 0 })
    });
    
    // Error detection
    this.registerTemplate({
      kind: 'error',
      matcher: (payload) => {
        return payload?.error !== undefined ||
               payload?.err !== undefined ||
               payload?.errorCode !== undefined ||
               payload?.status === 'error' ||
               payload?.success === false;
      },
      renderer: () => ({ text: '', fields: {}, glossary: {}, redactions: [], msgId: '', confidence: 0 })
    });
    
    // Policy decision detection
    this.registerTemplate({
      kind: 'policy-decision',
      matcher: (payload) => {
        return payload?.policy !== undefined ||
               payload?.decision !== undefined ||
               payload?.rule !== undefined ||
               payload?.guard !== undefined;
      },
      renderer: () => ({ text: '', fields: {}, glossary: {}, redactions: [], msgId: '', confidence: 0 })
    });
    

  }
  
  private detectByHeuristics(payload: any): GatewayEventKind {
    // Check for specific patterns first (more specific before general)
    
    // Audio error detection (specific)
    if (payload?.error === 'AUDIO_ERROR' || (payload?.error && payload?.message && payload?.code)) {
      return 'audio-error';
    }
    
    // Sensor/Status detection (specific)
    if (payload?.op === 'sensor_read' || payload?.op === 'status_check' || payload?.op === 'status' || payload?.sensor !== undefined) {
      return 'sensor-status';
    }
    
    // Handshake detection
    if (payload?.hello === true || payload?.handshake === true) {
      return 'handshake';
    }
    
    // Error detection (general)
    if (payload?.error !== undefined || payload?.err !== undefined) {
      return 'error';
    }
    
    // Policy decision detection
    if (payload?.policy !== undefined || payload?.decision !== undefined) {
      return 'policy-decision';
    }
    
    // Acknowledgment detection
    if (payload?.ack === true || payload?.msgIdRef !== undefined) {
      return 'ack';
    }
    
    // Compute request detection (general - should be last)
    if (payload?.op !== undefined || payload?.operation !== undefined) {
      return 'compute-request';
    }
    
    // Default to unknown
    return 'unknown';
  }
}
