# 🔗 Gibberlink Decoder Gateway

**AI-to-AI Protocol Translator Gateway**

A production-ready developer gateway that translates between human-readable API calls (JSON/HTTP) and an AI-to-AI optimized protocol ("Gibberlink"-style). Includes clean abstractions so the low-level protocol can be swapped (e.g., ggwave/sound, UDP, or WebRTC datachannels).

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start gateway and echo-peer
pnpm dev

# In another terminal, start the browser client
cd examples/browser-client
pnpm dev

# Or run the Node.js client
cd examples/node-client
pnpm build
node dist/index.js test
```

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Development](#development)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

The Gibberlink Decoder Gateway sits between human-facing applications and AI agents that prefer compact, non-natural protocols. It provides:

- **Protocol Translation**: Convert JSON to optimized binary formats (MessagePack, CBOR)
- **Transport Abstraction**: Support for WebSocket, UDP, and Audio transports
- **Error Correction**: Forward error correction with Reed-Solomon (stub implementation)
- **Security & Governance**: API key authentication, rate limiting, audit logging
- **Observability**: Complete audit trails and message transcripts

### Key Features

- ✅ **Multi-Transport Support**: WebSocket, UDP, Audio (with loopback simulator)
- ✅ **Multiple Codecs**: MessagePack, CBOR, JSON with optional zstd compression
- ✅ **Chunking & Reassembly**: Handle large messages across multiple frames
- ✅ **Forward Error Correction**: Stub Reed-Solomon implementation with simulated loss
- ✅ **Session Management**: Handshake negotiation and capability discovery
- ✅ **Audit Logging**: Complete audit trail with PII detection and redaction
- ✅ **Rate Limiting**: Per-API-key rate limiting with sliding window
- ✅ **Policy Engine**: Content filtering and governance controls
- ✅ **WebSocket Streaming**: Real-time message streaming
- ✅ **Docker Support**: Complete containerization with docker-compose

## 🏗️ Architecture

```
┌─────────────────┐    HTTP/WS     ┌──────────────────┐    Optimized    ┌──────────────┐
│   Human App     │ ──────────────► │  Gibberlink      │ ──────────────► │  AI Peer     │
│   (JSON/HTTP)   │                │  Gateway         │    Protocol    │              │
└─────────────────┘                └──────────────────┘                └──────────────┘
                                           │
                                           ▼
                                    ┌──────────────────┐
                                    │  Audit Log       │
                                    │  Transcripts     │
                                    └──────────────────┘
```

### Protocol Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│                    Transport Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ WebSocket   │  │    UDP      │  │       Audio         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Protocol Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Framer    │  │     FEC     │  │      Handshake      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Codec Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ MessagePack │  │    CBOR     │  │       JSON          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Frame Format

```
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│  Magic  │ Version │ Length  │  MsgID  │ Payload │  CRC32  │
│  (4B)   │  (1B)   │  (4B)   │  (4B)   │  (N)    │  (4B)   │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

## 📦 Installation

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker (optional)

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd gibberlink-decoder-gateway

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development servers
pnpm dev
```

### Docker Deployment

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🚀 Usage

### 1. Start Services

```bash
# Terminal 1: Start gateway
pnpm --filter @gibberlink/gateway dev

# Terminal 2: Start echo-peer
pnpm --filter @gibberlink/echo-peer dev

# Terminal 3: Start browser client
cd examples/browser-client
pnpm dev
```

### 2. Basic API Usage

#### Health Check
```bash
curl http://localhost:8080/v1/health
```

#### Establish Session
```bash
curl -X POST http://localhost:8080/v1/handshake \
  -H "x-api-key: devkey" \
  -H "content-type: application/json" \
  -d '{
    "transport": "ws",
    "target": "ws://localhost:9999",
    "features": {
      "compression": "zstd",
      "fec": true
    }
  }'
```

#### Send Message
```bash
curl -X POST http://localhost:8080/v1/encode \
  -H "x-api-key: devkey" \
  -H "content-type: application/json" \
  -d '{
    "sessionId": "session_123",
    "target": "ws://localhost:9999",
    "payload": {
      "op": "sum",
      "a": 2,
      "b": 3
    }
  }'
```

#### Decode Message
```bash
curl -X POST http://localhost:8080/v1/decode \
  -H "x-api-key: devkey" \
  -H "content-type: application/json" \
  -d '{
    "bytesBase64": "base64_encoded_bytes_here"
  }'
```

### 3. Node.js Client

```bash
# Run test with 10 messages
cd examples/node-client
pnpm build
node dist/index.js test -c 10 -d 1000

# Decode a message
node dist/index.js decode -b "base64_encoded_bytes"

# Get transcript
node dist/index.js transcript -m "message_id"
```

### 4. WebSocket Streaming

```javascript
const ws = new WebSocket('ws://localhost:8080/v1/messages?sessionId=session_123');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'send',
    payload: { op: 'sum', a: 2, b: 3 },
    timestamp: new Date().toISOString()
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

## 📚 API Reference

### Base URL
```
http://localhost:8080
```

### Authentication
All endpoints (except `/v1/health`) require an API key in the `x-api-key` header.

### Endpoints

#### `GET /v1/health`
Health check endpoint (no authentication required).

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "transports": ["ws", "udp", "audio"],
  "codecs": ["msgpack", "cbor", "json"],
  "version": "1.0.0"
}
```

#### `POST /v1/handshake`
Establish a session with capability negotiation.

**Request:**
```json
{
  "transport": "ws",
  "target": "ws://localhost:9999",
  "features": {
    "compression": "zstd",
    "fec": true,
    "crypto": false,
    "maxMtu": 1500
  }
}
```

**Response:**
```json
{
  "sessionId": "session_abc123",
  "negotiated": {
    "compression": "zstd",
    "fec": true,
    "crypto": false,
    "maxMtu": 1500
  },
  "peerAddress": "ws://localhost:9999",
  "expiresAt": "2024-01-01T00:30:00.000Z"
}
```

#### `POST /v1/encode`
Encode and send a message.

**Request:**
```json
{
  "sessionId": "session_abc123",
  "target": "ws://localhost:9999",
  "payload": {
    "op": "sum",
    "a": 2,
    "b": 3
  },
  "requireTranscript": true
}
```

**Response:**
```json
{
  "msgId": "msg_xyz789",
  "bytesBase64": "base64_encoded_bytes",
  "frames": 1,
  "size": 256,
  "transcriptId": "msg_xyz789"
}
```

#### `POST /v1/decode`
Decode a message from base64 bytes.

**Request:**
```json
{
  "bytesBase64": "base64_encoded_bytes"
}
```

**Response:**
```json
{
  "msgId": "msg_xyz789",
  "payload": {
    "op": "sum",
    "a": 2,
    "b": 3
  },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "transport": "ws",
    "codec": "msgpack",
    "compression": "none",
    "fec": false,
    "size": 256,
    "frames": 1,
    "crc32": "a1b2c3d4"
  }
}
```

#### `GET /v1/transcript/:msgId`
Get message transcript with audit information.

**Response:**
```json
{
  "msgId": "msg_xyz789",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "payload": {
    "op": "sum",
    "a": 2,
    "b": 3
  },
  "metadata": { ... },
  "audit": {
    "actor": "devkey",
    "route": "/v1/encode",
    "policyDecision": "allow",
    "piiDetected": false,
    "redactedFields": [],
    "hash": "sha256_hash"
  },
  "rawFrames": ["base64_frame_1", "base64_frame_2"]
}
```

#### `GET /v1/messages`
WebSocket endpoint for real-time message streaming.

**Query Parameters:**
- `sessionId`: Session ID for authentication

**Message Format:**
```json
{
  "type": "send|recv|heartbeat|error",
  "msgId": "msg_xyz789",
  "payload": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🔧 Examples

### Browser Client
The browser client provides a web interface for testing the gateway:

1. Navigate to `http://localhost:3000`
2. Configure connection settings
3. Establish a handshake
4. Send messages and view metrics

### Node.js Client
The Node.js client provides CLI tools for testing:

```bash
# Basic test
node dist/index.js test

# Custom test
node dist/index.js test \
  --url http://localhost:8080 \
  --key devkey \
  --transport ws \
  --target ws://localhost:9999 \
  --payload '{"op":"sum","a":2,"b":3}' \
  --count 10 \
  --delay 1000

# Decode message
node dist/index.js decode --bytes "base64_encoded_bytes"

# Get transcript
node dist/index.js transcript --msgId "msg_xyz789"
```

### cURL Examples

```bash
# Health check
curl http://localhost:8080/v1/health

# Handshake
curl -X POST http://localhost:8080/v1/handshake \
  -H "x-api-key: devkey" \
  -H "content-type: application/json" \
  -d '{"transport":"ws","target":"ws://localhost:9999"}'

# Send message
curl -X POST http://localhost:8080/v1/encode \
  -H "x-api-key: devkey" \
  -H "content-type: application/json" \
  -d '{
    "sessionId":"session_123",
    "target":"ws://localhost:9999",
    "payload":{"op":"sum","a":2,"b":3}
  }'
```

## 🛠️ Development

### Project Structure

```
gibberlink-decoder-gateway/
├── packages/
│   ├── protocol-core/     # Core protocol implementation
│   └── transports/        # Transport layer implementations
├── apps/
│   ├── gateway/           # HTTP/WebSocket server
│   └── echo-peer/         # Echo peer for testing
├── examples/
│   ├── browser-client/    # Browser-based client
│   └── node-client/       # Node.js CLI client
├── docker-compose.yml     # Docker orchestration
├── Dockerfile            # Multi-stage Docker build
└── openapi.yaml          # API specification
```

### Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint code
pnpm lint

# Type check
pnpm typecheck

# Start development servers
pnpm dev

# Validate OpenAPI spec
pnpm validate:openapi
```

### Adding a New Transport

1. Create transport implementation in `packages/transports/src/`
2. Implement the `Transport` interface
3. Add to `TransportFactory`
4. Update tests and documentation

### Adding a New Codec

1. Create codec implementation in `packages/protocol-core/src/codec.ts`
2. Implement the `Codec` interface
3. Add to `codecs` export
4. Update tests and documentation

### Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @gibberlink/protocol-core test

# Run tests with coverage
pnpm test:coverage

# Run integration tests
pnpm --filter @gibberlink/gateway test:integration
```

## 🔒 Security

### Authentication
- API key authentication via `x-api-key` header
- HMAC-SHA256 signature validation (optional)
- Session-based authentication for WebSocket connections

### Rate Limiting
- Per-API-key rate limiting
- Sliding window algorithm
- Configurable limits and windows

### Content Filtering
- PII detection and redaction
- Denylist field filtering
- Payload size limits
- Policy-based content governance

### Audit Logging
- Complete audit trail
- Message transcripts
- Policy decision logging
- PII detection logging

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Eavesdropping/MITM | TLS termination, optional payload HMAC |
| Replay attacks | Nonce and time window validation |
| DoS attacks | Rate limiting, bounded queues, circuit breakers |
| Data exfiltration | Policy engine, content filtering, audit logging |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

### Development Setup

```bash
# Fork and clone
git clone <your-fork-url>
cd gibberlink-decoder-gateway

# Install dependencies
pnpm install

# Create feature branch
git checkout -b feature/your-feature

# Make changes and test
pnpm test
pnpm lint
pnpm typecheck

# Commit and push
git commit -m "feat: add your feature"
git push origin feature/your-feature
```

## 📄 License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

For commercial use, please contact [baitjet@gmail.com](mailto:baitjet@gmail.com).

## 🆘 Support

- **Documentation**: [README.md](README.md)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Email**: [baitjet@gmail.com](mailto:baitjet@gmail.com)
- **Website**: [juansantosrealty.com](https://juansantosrealty.com)

## 🗺️ Roadmap

- [ ] **Audio Transport**: Real ggwave integration
- [ ] **WebRTC DataChannel**: Cross-NAT peer communication
- [ ] **Redis Sessions**: Distributed session storage
- [ ] **Prometheus Metrics**: Monitoring and alerting
- [ ] **Key Rotation**: Automated API key rotation
- [ ] **Multi-tenant**: Per-tenant policy files
- [ ] **Plugin System**: Extensible transport and codec plugins

---

**1. Open-Source License (AGPLv3)**
This license is for individuals and organizations using the software in projects that are also released under an open-source license. If you distribute an application that uses this software, the AGPLv3 requires that you also make your application's source code available to your users.

**Key Terms:**
*   **For Open-Source Projects:** You are free to use, modify, and distribute this software in your own open-source projects under the terms of the GNU Affero General Public License, Version 3 (AGPLv3).
*   **Contribution Friendly:** We welcome contributions from the community. All contributions will be licensed under the AGPLv3.

**2. Commercial License**
This license is for organizations and individuals who wish to use this software in a closed-source, proprietary application or for commercial purposes without the obligations of the AGPLv3.

**Commercial Benefits:**
*   **Proprietary Use:** Use our software in your proprietary, closed-source applications without being required to open-source your own code.
*   **Premium Support:** Access dedicated support and faster bug-fix turnarounds.
*   **Royalty-Based or Subscription Pricing:** Your commercial license includes a structured payment model, which may involve royalties based on sales, per-seat licensing, or other terms.

**How to Purchase a Commercial License:**
To obtain a commercial license or learn more about our pricing and royalty options, please visit our website at **[juansantosrealty.com]** or contact us at **[baitjet@gmail.com]**.

---
*For more information, reach me.*

---

**Built with ❤️ by Juan Santos**
