import { GatewayEvent, Englishized } from '../types';
import { extractGlossaryTerms } from '../glossary';

export function renderAck(event: GatewayEvent): Englishized {
  const payload = event.payload;
  
  // Extract acknowledgment details
  const msgIdRef = payload?.msgIdRef || payload?.ref || payload?.reference || 'unknown';
  const status = payload?.status || payload?.result || 'success';
  const data = payload?.data || payload?.result || payload?.response;
  
  // Build the text
  let text = `The agent acknowledged receipt of message ${msgIdRef}.`;
  
  if (status !== 'success') {
    text += ` The status is "${status}".`;
  }
  
  if (data !== undefined) {
    if (typeof data === 'string' && data.length < 100) {
      text += ` The response is "${data}".`;
    } else if (typeof data === 'number') {
      text += ` The result is ${data}.`;
    } else if (typeof data === 'boolean') {
      text += ` The result is ${data}.`;
    } else if (Array.isArray(data)) {
      text += ` The response contains ${data.length} items.`;
    } else if (typeof data === 'object' && data !== null) {
      const keyCount = Object.keys(data).length;
      text += ` The response contains ${keyCount} fields.`;
    }
  }
  
  // Extract glossary terms
  const glossary = extractGlossaryTerms(text);
  
  return {
    text,
    fields: { msgIdRef, status, data },
    glossary,
    redactions: [],
    msgId: event.meta.msgId,
    confidence: 1,
    sourceMapping: {
      'messageId': ['payload.msgIdRef', 'payload.ref', 'payload.reference'],
      'status': ['payload.status', 'payload.result'],
      'response': ['payload.data', 'payload.result', 'payload.response']
    }
  };
}
