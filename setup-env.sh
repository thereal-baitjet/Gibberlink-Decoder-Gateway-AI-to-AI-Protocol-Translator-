#!/bin/bash

# Gibberlink Environment Setup Script
# This script helps you set up environment variables for OpenAI integration

echo "🤖 Gibberlink OpenAI Environment Setup"
echo "======================================"
echo ""

# Check if .env file exists
if [ -f ".env" ]; then
    echo "📁 .env file already exists"
    echo "Current OpenAI configuration:"
    if grep -q "OPENAI_API_KEY" .env; then
        current_key=$(grep "OPENAI_API_KEY" .env | cut -d'=' -f2)
        if [ "$current_key" = "your_openai_api_key_here" ]; then
            echo "❌ OPENAI_API_KEY not configured (using placeholder)"
        else
            echo "✅ OPENAI_API_KEY is configured"
        fi
    else
        echo "❌ OPENAI_API_KEY not found in .env"
    fi
    echo ""
else
    echo "📁 Creating .env file from template..."
    cp env.example .env
    echo "✅ .env file created"
    echo ""
fi

echo "🔑 To configure OpenAI API key:"
echo "1. Get your API key from: https://platform.openai.com/account/api-keys"
echo "2. Edit the .env file:"
echo "   nano .env"
echo "3. Replace 'your_openai_api_key_here' with your actual API key"
echo "4. Save the file"
echo ""

echo "🚀 To start the gateway with OpenAI:"
echo "1. Make sure .env is configured"
echo "2. Run: cd apps/gateway && node dist/index.js"
echo "3. Or run: npm run start"
echo ""

echo "🧪 To test OpenAI integration:"
echo "1. Set your API key in .env"
echo "2. Run: node test-simple-openai.js"
echo "3. Or run: node test-mock-openai.js (for demo without API key)"
echo ""

echo "📋 Available environment variables:"
echo "OPENAI_API_KEY     - Your OpenAI API key"
echo "OPENAI_MODEL       - Model to use (default: gpt-4o-mini)"
echo "OPENAI_MAX_TOKENS  - Max tokens per request (default: 500)"
echo "OPENAI_TEMPERATURE - Response creativity (default: 0.3)"
echo ""

if [ -f ".env" ]; then
    echo "💡 Current .env contents:"
    echo "========================"
    cat .env | grep -E "^(OPENAI_|PORT=|API_KEYS=)" | head -10
    echo ""
fi

echo "🎉 Setup complete! Configure your API key and start the gateway."
