#!/bin/bash

echo "🔗 Testing Gibberlink Decoder Gateway Setup"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm first."
    exit 1
fi

echo "✅ pnpm is installed"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build packages
echo "🔨 Building packages..."
pnpm build

# Run tests
echo "🧪 Running tests..."
pnpm test

# Check if gateway builds
echo "🏗️ Testing gateway build..."
cd apps/gateway
pnpm build
cd ../..

# Check if echo-peer builds
echo "🏗️ Testing echo-peer build..."
cd apps/echo-peer
pnpm build
cd ../..

# Check if browser client builds
echo "🏗️ Testing browser client build..."
cd examples/browser-client
pnpm build
cd ../..

# Check if node client builds
echo "🏗️ Testing node client build..."
cd examples/node-client
pnpm build
cd ../..

echo "✅ All builds successful!"

# Test OpenAPI validation
echo "📋 Validating OpenAPI specification..."
if command -v swagger-cli &> /dev/null; then
    swagger-cli validate openapi.yaml
    echo "✅ OpenAPI specification is valid"
else
    echo "⚠️  swagger-cli not installed, skipping OpenAPI validation"
fi

echo ""
echo "🎉 Setup test completed successfully!"
echo ""
echo "Next steps:"
echo "1. Start the gateway: pnpm --filter @gibberlink/gateway dev"
echo "2. Start the echo-peer: pnpm --filter @gibberlink/echo-peer dev"
echo "3. Start the browser client: cd examples/browser-client && pnpm dev"
echo "4. Or run the Node.js client: cd examples/node-client && node dist/index.js test"
echo ""
echo "For more information, see README.md"
