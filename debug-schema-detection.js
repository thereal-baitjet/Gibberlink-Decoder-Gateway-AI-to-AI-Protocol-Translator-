#!/usr/bin/env node

const { SchemaDetector } = require('./packages/englishizer/dist/index.js');

console.log('🔍 Debugging Schema Detection...');
console.log('==============================');

function debugSchemaDetection() {
    const detector = new SchemaDetector();

    const testCases = [
        {
            name: 'Temperature Sensor Read',
            payload: {
                op: 'sensor_read',
                sensor: 'temperature',
                value: 23.5,
                unit: 'celsius'
            }
        },
        {
            name: 'Battery Status Check',
            payload: {
                op: 'status_check',
                component: 'battery',
                level: 75,
                charging: true
            }
        },
        {
            name: 'Audio Error',
            payload: {
                error: 'AUDIO_ERROR',
                message: 'Audio processing error',
                code: 500
            }
        },
        {
            name: 'Handshake',
            payload: {
                hello: true,
                caps: { mtu: 16384, fec: true, compression: 'zstd' }
            }
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n📝 Testing: ${testCase.name}`);
        console.log(`📤 Payload: ${JSON.stringify(testCase.payload)}`);
        
        const detectedKind = detector.detectKind(testCase.payload);
        console.log(`🎯 Detected Kind: ${detectedKind}`);
    }
}

debugSchemaDetection();
