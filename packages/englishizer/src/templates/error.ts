import { GatewayEvent, Englishized } from '../types';
import { extractGlossaryTerms } from '../glossary';

export function renderError(event: GatewayEvent): Englishized {
  const payload = event.payload;
  
  // Extract error details
  const error = payload?.error || payload?.err || payload?.message || 'unknown error';
  const code = payload?.code || payload?.errorCode || payload?.status || 'unknown';
  const msgIdRef = payload?.msgIdRef || payload?.ref || payload?.reference;
  const details = payload?.details || payload?.context || payload?.stack;
  
  // Build the text
  let text = `An error occurred: ${error}.`;
  
  if (code !== 'unknown') {
    text += ` The error code is ${code}.`;
  }
  
  if (msgIdRef) {
    text += ` This relates to message ${msgIdRef}.`;
  }
  
  if (details) {
    if (typeof details === 'string' && details.length < 200) {
      text += ` Additional details: ${details}.`;
    } else if (typeof details === 'object' && details !== null) {
      const detailCount = Object.keys(details).length;
      text += ` There are ${detailCount} additional error details.`;
    }
  }
  
  // Extract glossary terms
  const glossary = extractGlossaryTerms(text);
  
  return {
    text,
    fields: { error, code, msgIdRef, details },
    glossary,
    redactions: [],
    msgId: event.meta.msgId,
    confidence: 1,
    sourceMapping: {
      'error': ['payload.error', 'payload.err', 'payload.message'],
      'code': ['payload.code', 'payload.errorCode', 'payload.status'],
      'reference': ['payload.msgIdRef', 'payload.ref', 'payload.reference'],
      'details': ['payload.details', 'payload.context', 'payload.stack']
    }
  };
}
