import { GatewayEvent, Englishized } from '../types';
import { extractGlossaryTerms } from '../glossary';

export function renderGeneric(event: GatewayEvent): Englishized {
  const payload = event.payload;
  
  // Build a generic description
  let text = `A message was received with ${Object.keys(payload).length} fields.`;
  
  // Try to extract some meaningful information
  const fields: Record<string, any> = {};
  const bullets: string[] = [];
  
  for (const [key, value] of Object.entries(payload)) {
    fields[key] = value;
    
    if (typeof value === 'string' && value.length < 50) {
      bullets.push(`${key}: "${value}"`);
    } else if (typeof value === 'number') {
      bullets.push(`${key}: ${value}`);
    } else if (typeof value === 'boolean') {
      bullets.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      bullets.push(`${key}: ${value.length} items`);
    } else if (typeof value === 'object' && value !== null) {
      bullets.push(`${key}: ${Object.keys(value).length} fields`);
    }
  }
  
  // Limit bullets to keep it readable
  if (bullets.length > 5) {
    bullets.splice(5);
    bullets.push('... and more fields');
  }
  
  // Extract glossary terms
  const glossary = extractGlossaryTerms(text);
  
  return {
    text,
    bullets,
    fields,
    glossary,
    redactions: [],
    msgId: event.meta.msgId,
    confidence: 0.3, // Low confidence for generic rendering
    sourceMapping: Object.fromEntries(
      Object.keys(payload).map(key => [key, [`payload.${key}`]])
    )
  };
}
