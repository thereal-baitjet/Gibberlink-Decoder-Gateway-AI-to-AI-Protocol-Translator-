#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    let filePath = req.url === '/' ? '/advanced-ui.html' : req.url;
    filePath = path.join(__dirname, filePath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }

        // Set appropriate content type
        const ext = path.extname(filePath);
        const contentTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
        };

        res.setHeader('Content-Type', contentTypes[ext] || 'text/plain');
        res.writeHead(200);
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`🎨 Advanced UI server running at http://localhost:${PORT}`);
    console.log(`🔗 Gateway API: http://localhost:8080`);
    console.log(`📱 Open your browser to http://localhost:${PORT}`);
    console.log('');
    console.log('✨ Features:');
    console.log('   • Real-time WebSocket communication');
    console.log('   • Plain-English message translation');
    console.log('   • Interactive message templates');
    console.log('   • Live statistics and monitoring');
    console.log('   • PII redaction visualization');
    console.log('   • Glossary term definitions');
    console.log('   • Copy-to-clipboard functionality');
    console.log('');
    console.log('🚀 Ready to test the Gibberlink Decoder Gateway!');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down UI server...');
    server.close(() => {
        console.log('✅ UI server stopped');
        process.exit(0);
    });
});
