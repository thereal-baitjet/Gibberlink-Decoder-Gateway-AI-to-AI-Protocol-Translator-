import { GatewayEvent, Englishized } from '../types';
import { extractGlossaryTerms } from '../glossary';

export function renderAudioError(event: GatewayEvent): Englishized {
  const payload = event.payload;
  
  // Handle audio processing errors
  if (payload?.error === 'AUDIO_ERROR') {
    const message = payload.message || 'Unknown audio processing error';
    const code = payload.code || 500;
    
    let text = `An audio processing error occurred: ${message}.`;
    
    // Add context based on error code
    if (code === 500) {
      text += ` This appears to be a server-side processing issue.`;
    } else if (code === 400) {
      text += ` This appears to be a client-side request issue.`;
    } else if (code === 404) {
      text += ` The requested audio resource was not found.`;
    } else if (code === 403) {
      text += ` Access to the audio resource was denied.`;
    }
    
    // Add suggestions based on error type
    if (message.includes('processing')) {
      text += ` The audio signal may need to be re-transmitted.`;
    } else if (message.includes('format')) {
      text += ` The audio format may not be supported.`;
    } else if (message.includes('quality')) {
      text += ` The audio quality may be too low for processing.`;
    }
    
    return {
      text,
      fields: { error: payload.error, message, code },
      glossary: extractGlossaryTerms(text),
      redactions: [],
      msgId: event.meta.msgId,
      confidence: 0.9,
      sourceMapping: {
        'error': ['payload.error'],
        'message': ['payload.message'],
        'code': ['payload.code']
      }
    };
  }
  
  // Handle general error messages
  if (payload?.error) {
    const errorType = payload.error;
    const message = payload.message || 'Unknown error occurred';
    const code = payload.code;
    
    let text = `An error of type "${errorType}" occurred: ${message}.`;
    
    if (code) {
      text += ` Error code: ${code}.`;
    }
    
    return {
      text,
      fields: { error: errorType, message, code },
      glossary: extractGlossaryTerms(text),
      redactions: [],
      msgId: event.meta.msgId,
      confidence: 0.85,
      sourceMapping: {
        'error': ['payload.error'],
        'message': ['payload.message'],
        'code': ['payload.code']
      }
    };
  }
  
  // Fallback for unknown error messages
  return {
    text: `An error message was received from the audio stream.`,
    fields: payload,
    glossary: extractGlossaryTerms('error message'),
    redactions: [],
    msgId: event.meta.msgId,
    confidence: 0.7,
    sourceMapping: {}
  };
}
