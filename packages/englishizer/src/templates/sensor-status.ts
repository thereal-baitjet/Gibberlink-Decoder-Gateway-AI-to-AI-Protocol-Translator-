import { GatewayEvent, Englishized } from '../types';
import { extractGlossaryTerms } from '../glossary';

export function renderSensorStatus(event: GatewayEvent): Englishized {
  const payload = event.payload;
  
  // Handle sensor read operations
  if (payload?.op === 'sensor_read' || payload?.sensor) {
    const sensor = payload.sensor || 'unknown sensor';
    const value = payload.value;
    const unit = payload.unit || '';
    
    let text = `The ${sensor} reported a reading of ${value}`;
    if (unit) {
      text += ` ${unit}`;
    }
    text += `.`;
    
    // Add context based on sensor type
    if (sensor === 'temperature') {
      if (value > 30) {
        text += ` The temperature is quite high.`;
      } else if (value < 10) {
        text += ` The temperature is quite low.`;
      } else {
        text += ` The temperature is within normal range.`;
      }
    } else if (sensor === 'humidity') {
      if (value > 70) {
        text += ` Humidity levels are elevated.`;
      } else if (value < 30) {
        text += ` Humidity levels are low.`;
      } else {
        text += ` Humidity is at a comfortable level.`;
      }
    } else if (sensor === 'pressure') {
      text += ` Atmospheric pressure is being monitored.`;
    }
    
    return {
      text,
      fields: { sensor, value, unit },
      glossary: extractGlossaryTerms(text),
      redactions: [],
      msgId: event.meta.msgId,
      confidence: 0.95,
      sourceMapping: {
        'sensor': ['payload.sensor'],
        'value': ['payload.value'],
        'unit': ['payload.unit']
      }
    };
  }
  
  // Handle status check operations
  if (payload?.op === 'status_check' || payload?.component) {
    const component = payload.component || 'system';
    const level = payload.level;
    const charging = payload.charging;
    
    let text = `The ${component} status was checked.`;
    
    if (level !== undefined) {
      if (component === 'battery') {
        if (level > 80) {
          text += ` Battery level is high at ${level}%.`;
        } else if (level > 50) {
          text += ` Battery level is moderate at ${level}%.`;
        } else if (level > 20) {
          text += ` Battery level is low at ${level}%.`;
        } else {
          text += ` Battery level is critical at ${level}%.`;
        }
        
        if (charging !== undefined) {
          if (charging) {
            text += ` The battery is currently charging.`;
          } else {
            text += ` The battery is not charging.`;
          }
        }
      } else {
        text += ` Current level is ${level}%.`;
      }
    }
    
    return {
      text,
      fields: { component, level, charging },
      glossary: extractGlossaryTerms(text),
      redactions: [],
      msgId: event.meta.msgId,
      confidence: 0.95,
      sourceMapping: {
        'component': ['payload.component'],
        'level': ['payload.level'],
        'charging': ['payload.charging']
      }
    };
  }
  
  // Handle general status operations
  if (payload?.op === 'status') {
    const component = payload.component || 'system';
    const value = payload.value;
    
    let text = `The ${component} reported a status value of ${value}.`;
    
    return {
      text,
      fields: { component, value },
      glossary: extractGlossaryTerms(text),
      redactions: [],
      msgId: event.meta.msgId,
      confidence: 0.9,
      sourceMapping: {
        'component': ['payload.component'],
        'value': ['payload.value']
      }
    };
  }
  
  // Fallback for unknown sensor/status messages
  return {
    text: `A sensor or status message was received from the audio stream.`,
    fields: payload,
    glossary: extractGlossaryTerms('sensor status message'),
    redactions: [],
    msgId: event.meta.msgId,
    confidence: 0.7,
    sourceMapping: {}
  };
}
