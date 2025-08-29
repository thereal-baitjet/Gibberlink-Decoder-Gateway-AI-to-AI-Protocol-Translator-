import { GatewayEvent, Englishized } from '../types';
import { extractGlossaryTerms } from '../glossary';

export function renderComputeRequest(event: GatewayEvent): Englishized {
  const payload = event.payload;
  
  // Extract operation details
  const op = payload?.op || payload?.operation || payload?.action || 'unknown';
  const args = payload?.args || payload?.arguments || payload?.params || payload?.parameters || {};
  const id = payload?.id || payload?.requestId || payload?.msgId || 'unknown';
  
  // Build the text
  let text = `One agent asked the other to perform "${op}"`;
  
  if (Object.keys(args).length > 0) {
    const argList = formatArguments(args);
    text += ` with ${argList}`;
  }
  
  text += ` and return the result.`;
  
  // Add request ID if available
  if (id !== 'unknown') {
    text += ` The request ID is ${id}.`;
  }
  
  // Extract glossary terms
  const glossary = extractGlossaryTerms(text);
  
  return {
    text,
    fields: { op, args, id },
    glossary,
    redactions: [],
    msgId: event.meta.msgId,
    confidence: 1,
    sourceMapping: {
      'operation': ['payload.op', 'payload.operation', 'payload.action'],
      'arguments': ['payload.args', 'payload.arguments', 'payload.params', 'payload.parameters'],
      'requestId': ['payload.id', 'payload.requestId', 'payload.msgId']
    }
  };
}

function formatArguments(args: any): string {
  if (typeof args === 'string') {
    return `"${args}"`;
  }
  
  if (typeof args === 'number') {
    return args.toString();
  }
  
  if (typeof args === 'boolean') {
    return args ? 'true' : 'false';
  }
  
  if (Array.isArray(args)) {
    if (args.length === 0) {
      return 'no arguments';
    }
    if (args.length === 1) {
      return formatArguments(args[0]);
    }
    return args.map(formatArguments).join(', ');
  }
  
  if (typeof args === 'object' && args !== null) {
    const entries = Object.entries(args);
    if (entries.length === 0) {
      return 'no arguments';
    }
    if (entries.length === 1) {
      const [key, value] = entries[0];
      return `${key}: ${formatArguments(value)}`;
    }
    return entries.map(([key, value]) => `${key}: ${formatArguments(value)}`).join(', ');
  }
  
  return 'unknown arguments';
}
