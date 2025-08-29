import { Englishized, GatewayEvent } from './types';

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface OpenAIAssistRequest {
  originalPayload: any;
  detectedKind: string;
  templateTranslation: string;
  confidence: number;
  context?: {
    previousMessages?: any[];
    sessionInfo?: any;
    timestamp?: string;
  };
}

export interface OpenAIAssistResponse {
  enhancedTranslation: string;
  confidence: number;
  reasoning: string;
  suggestions?: string[];
  contextInsights?: string[];
}

export class OpenAIAssist {
  private config: OpenAIConfig;
  private client: any;

  constructor(config: OpenAIConfig) {
    this.config = {
      model: 'gpt-4o-mini',
      maxTokens: 500,
      temperature: 0.3,
      ...config
    };
    
    // Initialize OpenAI client if API key is provided
    if (this.config.apiKey) {
      try {
        this.client = new (require('openai')).OpenAI({
          apiKey: this.config.apiKey
        });
      } catch (error) {
        console.warn('OpenAI client not available:', error.message);
        this.client = null;
      }
    }
  }

  async enhanceTranslation(request: OpenAIAssistRequest): Promise<OpenAIAssistResponse> {
    if (!this.client) {
      return {
        enhancedTranslation: request.templateTranslation,
        confidence: request.confidence,
        reasoning: 'OpenAI not available, using template translation'
      };
    }

    try {
      const prompt = this.buildPrompt(request);
      
      const requestConfig: any = {
        model: this.config.model!,
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that enhances technical protocol translations into natural, context-aware English. 
            
Your task is to:
1. Take a basic template translation and make it more natural and informative
2. Add relevant context and insights based on the payload data
3. Provide confidence scoring and reasoning
4. Suggest improvements or additional context when helpful

Guidelines:
- Keep translations concise but informative
- Add relevant technical context when helpful
- Maintain the original meaning while improving readability
- Consider the message type and context
- Provide confidence scores based on clarity and completeness`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: this.config.maxTokens
      };

      // Only add temperature if the model supports it
      if (this.config.model !== 'gpt-5') {
        requestConfig.temperature = this.config.temperature;
      }

      const response = await this.client.chat.completions.create(requestConfig);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      return this.parseResponse(content, request);
    } catch (error) {
      console.warn('OpenAI enhancement failed:', error.message);
      return {
        enhancedTranslation: request.templateTranslation,
        confidence: request.confidence,
        reasoning: `OpenAI enhancement failed: ${error.message}`
      };
    }
  }

  private buildPrompt(request: OpenAIAssistRequest): string {
    const { originalPayload, detectedKind, templateTranslation, confidence, context } = request;
    
    return `Please enhance this technical protocol translation:

ORIGINAL PAYLOAD:
${JSON.stringify(originalPayload, null, 2)}

DETECTED MESSAGE TYPE: ${detectedKind}
TEMPLATE TRANSLATION: ${templateTranslation}
CONFIDENCE: ${confidence}%

CONTEXT:
- Timestamp: ${context?.timestamp || 'unknown'}
- Previous messages: ${context?.previousMessages?.length || 0}
- Session info: ${JSON.stringify(context?.sessionInfo || {}, null, 2)}

Please provide:
1. Enhanced natural English translation
2. Updated confidence score (0-100%)
3. Brief reasoning for improvements
4. Any relevant context insights
5. Suggestions for additional information (if helpful)

Format your response as JSON:
{
  "enhancedTranslation": "your enhanced translation here",
  "confidence": 95,
  "reasoning": "explanation of improvements",
  "contextInsights": ["insight 1", "insight 2"],
  "suggestions": ["suggestion 1", "suggestion 2"]
}`;
  }

  private parseResponse(content: string, request: OpenAIAssistRequest): OpenAIAssistResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          enhancedTranslation: parsed.enhancedTranslation || request.templateTranslation,
          confidence: parsed.confidence || request.confidence,
          reasoning: parsed.reasoning || 'Enhanced by OpenAI',
          suggestions: parsed.suggestions || [],
          contextInsights: parsed.contextInsights || []
        };
      }
    } catch (error) {
      console.warn('Failed to parse OpenAI response as JSON:', error.message);
    }

    // Fallback: use the content as enhanced translation
    return {
      enhancedTranslation: content.trim(),
      confidence: Math.min(request.confidence + 5, 100),
      reasoning: 'OpenAI provided natural language enhancement',
      suggestions: [],
      contextInsights: []
    };
  }

  async batchEnhance(requests: OpenAIAssistRequest[]): Promise<OpenAIAssistResponse[]> {
    if (!this.client) {
      return requests.map(req => ({
        enhancedTranslation: req.templateTranslation,
        confidence: req.confidence,
        reasoning: 'OpenAI not available'
      }));
    }

    const results: OpenAIAssistResponse[] = [];
    
    // Process in batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(req => this.enhanceTranslation(req))
      );
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}
