# 🤖 OpenAI Integration Setup Guide

This guide will help you set up OpenAI integration for enhanced Gibberlink message translations.

## 🔑 Getting Your OpenAI API Key

1. **Visit OpenAI Platform**: Go to [https://platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys)

2. **Create API Key**: 
   - Click "Create new secret key"
   - Give it a name (e.g., "Gibberlink Translator")
   - Copy the generated key (it starts with `sk-`)

3. **Important**: Keep your API key secure and never share it publicly!

## 📁 Environment Configuration

### Option 1: Using the Setup Script (Recommended)

```bash
# Run the setup script
./setup-env.sh

# Edit the .env file with your API key
nano .env
```

### Option 2: Manual Setup

```bash
# Copy the example environment file
cp env.example .env

# Edit the .env file
nano .env
```

### Environment Variables

Update your `.env` file with these values:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.3

# Gateway Configuration
PORT=8080
API_KEYS=devkey:testkey
```

## 🚀 Starting the System

### 1. Build the Packages
```bash
# Build Englishizer with OpenAI support
cd packages/englishizer && pnpm build

# Build Gateway with environment support
cd ../../apps/gateway && pnpm build
```

### 2. Start the Gateway
```bash
# From the project root
cd apps/gateway && node dist/index.js
```

### 3. Start the UI Server
```bash
# From the project root
node serve-ui.js
```

## 🧪 Testing the Integration

### Test 1: Basic Functionality (No API Key Required)
```bash
node test-mock-openai.js
```

### Test 2: OpenAI Enhancement (Requires API Key)
```bash
node test-simple-openai.js
```

### Test 3: Full System Test
```bash
node test-openai-integration.js
```

## 🎯 What You'll See

### Without OpenAI API Key:
- ✅ Template-based translations work
- 📝 Clear, structured English output
- 🔍 Schema detection and context awareness

### With OpenAI API Key:
- 🤖 AI-enhanced natural language
- 💡 Context insights and suggestions
- 🎯 Improved confidence scoring
- 🔄 Adaptive translations based on message complexity

## 📊 Example Translations

### Template-based (No OpenAI):
```
"The temperature reported a reading of 23.5 celsius. The temperature is within normal range."
```

### OpenAI-enhanced:
```
"The temperature sensor in server room 1 detected 23.5°C, which is well within the optimal operating range for server equipment. This reading indicates normal environmental conditions."
```

## 🔧 Troubleshooting

### API Key Issues
- **401 Error**: Check your API key is correct and active
- **Rate Limit**: You may have exceeded your OpenAI quota
- **Model Not Found**: Ensure you're using a valid model name

### Environment Issues
- **Variables Not Loading**: Make sure `.env` file is in the project root
- **Gateway Not Starting**: Check port 8080 is available
- **Build Errors**: Run `pnpm install` to ensure all dependencies are installed

### Testing Issues
- **WebSocket Connection**: Ensure gateway is running on port 8080
- **Audio Processing**: Check microphone permissions in browser
- **Translation Quality**: Verify the message format matches expected schemas

## 💰 Cost Considerations

- **GPT-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Typical Usage**: ~100-500 tokens per translation
- **Estimated Cost**: ~$0.0001-0.0005 per translation

## 🔒 Security Notes

- Never commit your `.env` file to version control
- Use environment variables in production
- Consider using OpenAI API key rotation
- Monitor your API usage regularly

## 🎉 Success Indicators

✅ Gateway starts without errors  
✅ Environment variables are loaded  
✅ OpenAI client initializes successfully  
✅ Translations show enhanced natural language  
✅ Confidence scores improve with AI enhancement  

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify your OpenAI API key is valid
3. Ensure all packages are built and up to date
4. Check the gateway logs for error messages

---

**Happy translating! 🚀**
