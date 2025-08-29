#!/usr/bin/env node

const { Englishizer } = require('./packages/englishizer/dist/index.js');

console.log('🇬🇧 Direct Englishizer Test...');
console.log('=============================');

async function testEnglishizerDirect() {
    try {
        const englishizer = new Englishizer();
        
        const testPayload = {
            op: 'sensor_read',
            sensor: 'temperature',
            value: 23.5,
            unit: 'celsius'
        };
        
        const event = {
            kind: 'unknown',
            payload: testPayload,
            meta: {
                msgId: 'test-123',
                transport: 'Audio',
                codec: 'JSON',
                ts: Date.now()
            }
        };
        
        console.log('📤 Input payload:', JSON.stringify(testPayload));
        
        const result = await englishizer.toPlainEnglish(event);
        
        console.log('🎯 Detected kind:', event.kind);
        console.log('🇬🇧 Translation:', result.text);
        console.log('📊 Confidence:', (result.confidence * 100).toFixed(1) + '%');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testEnglishizerDirect();
