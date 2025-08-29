#!/usr/bin/env node

const { Englishizer } = require('./packages/englishizer/dist/index.js');

console.log('🇬🇧 Testing Improved JSON to English Translations...');
console.log('==================================================');

async function testImprovedEnglish() {
    try {
        // Create Englishizer with enhanced templates
        const englishizer = new Englishizer({
            maxSentences: 4,
            includeGlossary: true,
            includeSourceMapping: false
        });

        console.log('✅ Englishizer created with enhanced templates');

        // Test cases for different message types
        const testCases = [
            {
                name: 'Temperature Sensor Read',
                payload: {
                    op: 'sensor_read',
                    sensor: 'temperature',
                    value: 23.5,
                    unit: 'celsius',
                    timestamp: Date.now()
                },
                expectedKind: 'sensor-status'
            },
            {
                name: 'Battery Status Check',
                payload: {
                    op: 'status_check',
                    component: 'battery',
                    level: 75,
                    charging: true
                },
                expectedKind: 'sensor-status'
            },
            {
                name: 'General Status',
                payload: {
                    op: 'status',
                    component: 'sensor',
                    value: 49
                },
                expectedKind: 'sensor-status'
            },
            {
                name: 'Audio Processing Error',
                payload: {
                    error: 'AUDIO_ERROR',
                    message: 'Audio processing error',
                    code: 500
                },
                expectedKind: 'audio-error'
            },
            {
                name: 'Handshake Message',
                payload: {
                    hello: true,
                    caps: { mtu: 16384, fec: true, compression: 'zstd' }
                },
                expectedKind: 'handshake'
            },
            {
                name: 'Compute Request',
                payload: {
                    op: 'sum',
                    args: { a: 42, b: 58 },
                    id: 'req-123'
                },
                expectedKind: 'compute-request'
            }
        ];

        console.log('\n🧪 Testing Enhanced Translations:');
        console.log('================================');

        for (const testCase of testCases) {
            console.log(`\n📝 Test: ${testCase.name}`);
            console.log(`📤 Input: ${JSON.stringify(testCase.payload)}`);

            const event = {
                kind: 'unknown',
                payload: testCase.payload,
                meta: {
                    msgId: `test-${Date.now()}`,
                    transport: 'Audio',
                    codec: 'JSON',
                    ts: Date.now()
                }
            };

            try {
                const englishized = await englishizer.toPlainEnglish(event);
                
                console.log(`🎯 Detected Kind: ${event.kind || 'unknown'}`);
                console.log(`🇬🇧 Translation: ${englishized.text}`);
                console.log(`📊 Confidence: ${(englishized.confidence * 100).toFixed(1)}%`);
                
                if (englishized.glossary && Object.keys(englishized.glossary).length > 0) {
                    console.log(`📚 Glossary Terms: ${Object.keys(englishized.glossary).join(', ')}`);
                }
                
                if (englishized.redactions && englishized.redactions.length > 0) {
                    console.log(`🔒 Redactions: ${englishized.redactions.length} items redacted`);
                }

                // Check if we got the expected kind
                if (event.kind === testCase.expectedKind) {
                    console.log(`✅ Correctly detected as ${testCase.expectedKind}`);
                } else {
                    console.log(`⚠️ Expected ${testCase.expectedKind}, got ${event.kind}`);
                }

            } catch (error) {
                console.error(`❌ Translation failed: ${error.message}`);
            }
        }

        console.log('\n🎉 Improved English translation test completed!');
        console.log('==============================================');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testImprovedEnglish();
