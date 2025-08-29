import { GatewayEvent, Englishized } from '../types';
import { extractGlossaryTerms } from '../glossary';

export function renderPolicyDecision(event: GatewayEvent): Englishized {
  const payload = event.payload;
  
  // Extract policy decision details
  const decision = payload?.decision || payload?.action || payload?.result || 'unknown';
  const reason = payload?.reason || payload?.explanation || payload?.message;
  const policy = payload?.policy || payload?.rule || payload?.guard || 'unknown';
  const resource = payload?.resource || payload?.target || payload?.operation;
  const actor = payload?.actor || payload?.user || payload?.sessionId;
  
  // Build the text
  let text = `The policy engine ${decision} the request.`;
  
  if (policy !== 'unknown') {
    text += ` This was based on policy "${policy}".`;
  }
  
  if (resource) {
    text += ` The affected resource is "${resource}".`;
  }
  
  if (actor) {
    text += ` The request was made by ${actor}.`;
  }
  
  if (reason) {
    if (typeof reason === 'string' && reason.length < 150) {
      text += ` Reason: ${reason}.`;
    } else if (typeof reason === 'object' && reason !== null) {
      const reasonCount = Object.keys(reason).length;
      text += ` There are ${reasonCount} reason details.`;
    }
  }
  
  // Extract glossary terms
  const glossary = extractGlossaryTerms(text);
  
  return {
    text,
    fields: { decision, policy, resource, actor, reason },
    glossary,
    redactions: [],
    msgId: event.meta.msgId,
    confidence: 1,
    sourceMapping: {
      'decision': ['payload.decision', 'payload.action', 'payload.result'],
      'policy': ['payload.policy', 'payload.rule', 'payload.guard'],
      'resource': ['payload.resource', 'payload.target', 'payload.operation'],
      'actor': ['payload.actor', 'payload.user', 'payload.sessionId'],
      'reason': ['payload.reason', 'payload.explanation', 'payload.message']
    }
  };
}
