#!/usr/bin/env node

import { createEnglishizer } from '../packages/englishizer/src/index';
import { GatewayEvent } from '../packages/englishizer/src/types';
import * as readline from 'readline';

const englishizer = createEnglishizer();

// Example payloads for demonstration
const examples = {
  handshake: {
    hello: true,
    caps: {
      mtu: 16384,
      fec: true,
      compression: 'zstd',
      crypto: false
    }
  },
  'compute-request': {
    op: 'sum',
    args: { a: 5, b: 9 },
    id: 'req-123'
  },
  ack: {
    msgIdRef: 'req-123',
    status: 'success',
    data: 'The result is 14'
  },
  error: {
    error: 'Invalid operation',
    code: 'INVALID_OP',
    msgIdRef: 'req-124'
  },
  'policy-decision': {
    decision: 'denied',
    policy: 'PII_guard',
    resource: 'user_data',
    reason: 'Contains sensitive information'
  },
  'sensitive-data': {
    op: 'login',
    args: {
      username: 'john_doe',
      password: 'secret123',
      email: 'john@example.com',
      ssn: '123-45-6789'
    }
  }
};

function createEvent(payload: any, kind?: string): GatewayEvent {
  return {
    kind: kind || 'unknown',
    payload,
    meta: {
      msgId: `demo-${Date.now()}`,
      transport: 'WebSocket',
      codec: 'MessagePack',
      ts: Date.now()
    }
  };
}

async function translatePayload(payload: any, kind?: string) {
  const event = createEvent(payload, kind);
  const result = await englishizer.toPlainEnglish(event);
  
  console.log('\n📝 Plain English Translation:');
  console.log('=' .repeat(50));
  console.log(result.text);
  
  if (result.bullets && result.bullets.length > 0) {
    console.log('\n📋 Details:');
    result.bullets.forEach(bullet => console.log(`  • ${bullet}`));
  }
  
  if (result.glossary && Object.keys(result.glossary).length > 0) {
    console.log('\n📚 Glossary:');
    Object.entries(result.glossary).forEach(([term, definition]) => {
      console.log(`  ${term}: ${definition}`);
    });
  }
  
  if (result.redactions && result.redactions.length > 0) {
    console.log('\n🔒 Redacted Fields:');
    result.redactions.forEach(redaction => console.log(`  • ${redaction}`));
  }
  
  console.log(`\n🎯 Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`📊 Message ID: ${result.msgId}`);
}

async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n🎤 Interactive Englishizer Demo');
  console.log('Type "help" for commands, "exit" to quit\n');

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  while (true) {
    const input = await question('> ');
    const trimmed = input.trim();

    if (trimmed === 'exit' || trimmed === 'quit') {
      break;
    }

    if (trimmed === 'help') {
      console.log('\nAvailable commands:');
      console.log('  help                    - Show this help');
      console.log('  examples                - Show available examples');
      console.log('  example <name>          - Run a specific example');
      console.log('  json <json-string>      - Translate JSON payload');
      console.log('  exit/quit               - Exit the demo\n');
      continue;
    }

    if (trimmed === 'examples') {
      console.log('\nAvailable examples:');
      Object.keys(examples).forEach(name => {
        console.log(`  ${name}`);
      });
      console.log('');
      continue;
    }

    if (trimmed.startsWith('example ')) {
      const exampleName = trimmed.substring(8);
      if (examples[exampleName as keyof typeof examples]) {
        const payload = examples[exampleName as keyof typeof examples];
        await translatePayload(payload, exampleName);
      } else {
        console.log(`❌ Example "${exampleName}" not found. Use "examples" to see available examples.`);
      }
      continue;
    }

    if (trimmed.startsWith('json ')) {
      try {
        const jsonString = trimmed.substring(5);
        const payload = JSON.parse(jsonString);
        await translatePayload(payload);
      } catch (error) {
        console.log('❌ Invalid JSON. Please provide valid JSON.');
      }
      continue;
    }

    if (trimmed === '') {
      continue;
    }

    console.log('❌ Unknown command. Type "help" for available commands.');
  }

  rl.close();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Interactive mode
    await interactiveMode();
    return;
  }

  if (args[0] === '--help' || args[0] === '-h') {
    console.log('Gibberlink Englishizer Demo');
    console.log('');
    console.log('Usage:');
    console.log('  node translator-demo.ts                    - Interactive mode');
    console.log('  node translator-demo.ts example <name>     - Run specific example');
    console.log('  node translator-demo.ts json <json-string> - Translate JSON');
    console.log('');
    console.log('Examples:');
    console.log('  node translator-demo.ts example handshake');
    console.log('  node translator-demo.ts json \'{"op":"sum","args":{"a":2,"b":3}}\'');
    return;
  }

  if (args[0] === 'example' && args[1]) {
    const exampleName = args[1];
    if (examples[exampleName as keyof typeof examples]) {
      const payload = examples[exampleName as keyof typeof examples];
      await translatePayload(payload, exampleName);
    } else {
      console.log(`❌ Example "${exampleName}" not found. Available examples:`);
      Object.keys(examples).forEach(name => console.log(`  ${name}`));
    }
    return;
  }

  if (args[0] === 'json' && args[1]) {
    try {
      const payload = JSON.parse(args[1]);
      await translatePayload(payload);
    } catch (error) {
      console.log('❌ Invalid JSON provided.');
      process.exit(1);
    }
    return;
  }

  console.log('❌ Invalid arguments. Use --help for usage information.');
  process.exit(1);
}

// Handle stdin input for pipe mode
if (!process.stdin.isTTY) {
  let input = '';
  process.stdin.on('data', (chunk) => {
    input += chunk;
  });
  
  process.stdin.on('end', async () => {
    try {
      const payload = JSON.parse(input.trim());
      await translatePayload(payload);
    } catch (error) {
      console.log('❌ Invalid JSON input.');
      process.exit(1);
    }
  });
} else {
  main().catch(console.error);
}
