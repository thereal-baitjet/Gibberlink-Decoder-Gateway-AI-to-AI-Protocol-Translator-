import { GatewayEvent, Englishized } from '../types';
import { extractGlossaryTerms } from '../glossary';

export function renderHandshake(event: GatewayEvent): Englishized {
  const { transport, codec } = event.meta;
  const payload = event.payload;
  
  // Extract capabilities
  const caps = payload?.caps || payload?.capabilities || {};
  const mtu = caps?.mtu || caps?.maxMtu || 1500;
  const fec = caps?.fec || false;
  const compression = caps?.compression || caps?.compress || 'none';
  const encryption = caps?.crypto || caps?.encryption || false;
  
  // Build the text
  let text = `The agents agreed to communicate over ${transport} using the ${codec} codec.`;
  
  if (compression !== 'none') {
    text += ` They will use ${compression} compression.`;
  }
  
  if (fec) {
    text += ` Forward error correction is enabled.`;
  }
  
  if (encryption) {
    text += ` Messages will be encrypted.`;
  }
  
  text += ` The maximum frame size is ${formatBytes(mtu)}. The session is ready.`;
  
  // Extract glossary terms
  const glossary = extractGlossaryTerms(text);
  
  return {
    text,
    fields: { 
      transport, 
      codec, 
      mtu, 
      fec, 
      compression, 
      encryption 
    },
    glossary,
    redactions: [],
    msgId: event.meta.msgId,
    confidence: 1,
    sourceMapping: {
      'transport': ['meta.transport'],
      'codec': ['meta.codec'],
      'compression': ['payload.caps.compression', 'payload.capabilities.compress'],
      'fec': ['payload.caps.fec', 'payload.capabilities.fec'],
      'encryption': ['payload.caps.crypto', 'payload.capabilities.encryption'],
      'mtu': ['payload.caps.mtu', 'payload.capabilities.maxMtu']
    }
  };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${bytes} bytes`;
  }
}
