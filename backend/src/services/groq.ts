import Groq from 'groq-sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Fallback models in order of preference
const FALLBACK_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it'
];

export class GroqService {
  private client: Groq;
  private model: string;
  private fallbackModels: string[];
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is required');
    }

    this.client = new Groq({ apiKey });
    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    this.fallbackModels = FALLBACK_MODELS.filter(m => m !== this.model);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRateLimitError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      return (error as { status: number }).status === 429;
    }
    return false;
  }

  private isModelError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      // 400 can indicate model issues, 404 for model not found
      return status === 400 || status === 404;
    }
    return false;
  }

  private getRetryAfter(error: unknown): number {
    // Try to extract retry-after from error headers
    if (error && typeof error === 'object' && 'headers' in error) {
      const headers = (error as { headers: Record<string, string> }).headers;
      const retryAfter = headers['retry-after'];
      if (retryAfter) {
        return parseInt(retryAfter, 10) * 1000;
      }
    }
    return this.retryDelay;
  }

  async chat(messages: ChatMessage[]): Promise<GroqResponse> {
    let lastError: unknown;
    let currentModel = this.model;
    const modelsToTry = [this.model, ...this.fallbackModels];

    for (const model of modelsToTry) {
      currentModel = model;

      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        try {
          const response = await this.client.chat.completions.create({
            model: currentModel,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1024,
            top_p: 1,
            stream: false
          });

          const content = response.choices[0]?.message?.content || '';
          const usage = response.usage;

          return {
            content,
            usage: usage ? {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens
            } : undefined
          };
        } catch (error) {
          lastError = error;
          console.error(`Groq API error (model: ${currentModel}, attempt ${attempt + 1}):`,
            error instanceof Error ? error.message : error);

          // If rate limited, wait and retry
          if (this.isRateLimitError(error)) {
            const waitTime = this.getRetryAfter(error);
            console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
            await this.sleep(waitTime);
            continue;
          }

          // If model error, try next model
          if (this.isModelError(error)) {
            console.log(`Model ${currentModel} failed. Trying next model...`);
            break; // Break inner loop to try next model
          }

          // For other errors, wait briefly and retry
          if (attempt < this.maxRetries - 1) {
            await this.sleep(this.retryDelay * (attempt + 1));
          }
        }
      }
    }

    // If all retries and fallbacks failed, throw a user-friendly error
    console.error('All Groq API attempts failed:', lastError);
    throw new Error('AI service is temporarily unavailable. Please try again in a moment.');
  }

  async chatWithFunctions(
    messages: ChatMessage[],
    tools: Groq.Chat.ChatCompletionTool[]
  ): Promise<{
    content: string | null;
    toolCalls?: Groq.Chat.ChatCompletionMessageToolCall[];
  }> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log(`[Groq] chatWithFunctions attempt ${attempt + 1}, messages: ${messages.length}, tools: ${tools.length}`);
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: messages,
          tools: tools,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 1024
        });

        const message = response.choices[0]?.message;
        console.log(`[Groq] Response received. Content: ${message?.content?.substring(0, 50) || 'null'}, ToolCalls: ${message?.tool_calls?.length || 0}`);

        return {
          content: message?.content || null,
          toolCalls: message?.tool_calls
        };
      } catch (error) {
        lastError = error;
        console.error(`Groq API error (attempt ${attempt + 1}):`,
          error instanceof Error ? error.message : error);

        // Special handling for tool_use_failed - extract the failed_generation
        // and return it as content so the fallback parser can handle it
        if (error && typeof error === 'object' && 'error' in error) {
          const errorObj = (error as { error?: { error?: { code?: string; failed_generation?: string } } }).error?.error;
          if (errorObj?.code === 'tool_use_failed' && errorObj?.failed_generation) {
            console.log('[Groq] Tool use failed, returning failed_generation for fallback parsing');
            return {
              content: errorObj.failed_generation,
              toolCalls: undefined
            };
          }
        }

        if (this.isRateLimitError(error)) {
          const waitTime = this.getRetryAfter(error);
          console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
          await this.sleep(waitTime);
          continue;
        }

        if (attempt < this.maxRetries - 1) {
          await this.sleep(this.retryDelay * (attempt + 1));
        }
      }
    }

    console.error('All Groq API attempts failed:', lastError);
    throw new Error('AI service is temporarily unavailable. Please try again in a moment.');
  }
}

export const groqService = new GroqService();
