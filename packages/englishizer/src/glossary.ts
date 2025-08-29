// Protocol term definitions for the Englishizer
export const PROTOCOL_GLOSSARY: Record<string, string> = {
  // Core protocol terms
  'frame': 'A complete message unit containing header, payload, and error checking.',
  'CRC': 'Cyclic Redundancy Check; verifies data integrity by detecting transmission errors.',
  'FEC': 'Forward Error Correction; adds redundancy so receivers can fix some errors.',
  'MTU': 'Maximum Transmission Unit; the largest frame size allowed.',
  'handshake': 'Initial protocol negotiation to establish communication parameters.',
  'codec': 'Coder/decoder; converts data between different formats.',
  'payload': 'The actual data being transmitted in a message.',
  'session': 'A logical connection between two agents for exchanging messages.',
  
  // Transport terms
  'WebSocket': 'A persistent connection protocol for real-time bidirectional communication.',
  'UDP': 'User Datagram Protocol; fast but unreliable network transport.',
  'TCP': 'Transmission Control Protocol; reliable but slower network transport.',
  
  // Compression terms
  'zstd': 'Zstandard compression; provides high compression ratios with fast speed.',
  'gzip': 'GNU zip compression; widely supported but slower than zstd.',
  'deflate': 'Standard compression algorithm used in many protocols.',
  
  // Security terms
  'encryption': 'Scrambling data so only authorized parties can read it.',
  'authentication': 'Verifying the identity of communication parties.',
  'signature': 'Digital proof that a message came from a specific sender.',
  
  // Policy terms
  'policy': 'Rules that control what operations are allowed.',
  'redaction': 'Removing sensitive information before displaying or storing.',
  'audit': 'Recording all actions for security and compliance purposes.',
  
  // Error terms
  'timeout': 'When an operation takes too long and is cancelled.',
  'retry': 'Attempting an operation again after it failed.',
  'backoff': 'Waiting longer between retry attempts to avoid overwhelming the system.',
  
  // Compute terms
  'operation': 'A specific task or calculation to be performed.',
  'argument': 'Data passed to an operation to control its behavior.',
  'result': 'The output produced by an operation.',
  
  // Quality terms
  'latency': 'Time delay between sending a message and receiving a response.',
  'throughput': 'Amount of data that can be processed in a given time.',
  'reliability': 'How often operations complete successfully.',
  
  // Status terms
  'ack': 'Acknowledgment; confirmation that a message was received.',
  'nack': 'Negative acknowledgment; indicating a message was not processed.',
  'pending': 'An operation that has been requested but not yet completed.',
  'completed': 'An operation that has finished successfully.',
  'failed': 'An operation that encountered an error and could not complete.'
};

/**
 * Get glossary definitions for terms found in text
 */
export function extractGlossaryTerms(text: string): Record<string, string> {
  const found: Record<string, string> = {};
  const lowerText = text.toLowerCase();
  
  for (const [term, definition] of Object.entries(PROTOCOL_GLOSSARY)) {
    if (lowerText.includes(term.toLowerCase())) {
      found[term] = definition;
    }
  }
  
  return found;
}

/**
 * Add superscript markers to terms in text
 */
export function markGlossaryTerms(text: string, glossary: Record<string, string>): string {
  let marked = text;
  let counter = 1;
  
  for (const term of Object.keys(glossary)) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    marked = marked.replace(regex, `${term}${counter}`);
    counter++;
  }
  
  return marked;
}

/**
 * Get a short definition for a specific term
 */
export function getTermDefinition(term: string): string | undefined {
  return PROTOCOL_GLOSSARY[term] || PROTOCOL_GLOSSARY[term.toLowerCase()];
}

/**
 * Add custom terms to the glossary
 */
export function addCustomTerms(customTerms: Record<string, string>): void {
  Object.assign(PROTOCOL_GLOSSARY, customTerms);
}
