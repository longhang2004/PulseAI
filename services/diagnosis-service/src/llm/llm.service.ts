import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CircuitBreaker } from './circuit-breaker';

@Injectable()
export class LlmService {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly provider: string;
  private readonly anthropicKey: string;
  private readonly openAiKey: string;
  private readonly ollamaEndpoint: string;

  constructor(private readonly httpService: HttpService) {
    this.circuitBreaker = new CircuitBreaker(3, 120000); // 3 failures -> open for 2 mins

    this.provider = process.env.LLM_PROVIDER || 'anthropic';
    this.anthropicKey = process.env.ANTHROPIC_API_KEY || '';
    this.openAiKey = process.env.OPENAI_API_KEY || '';
    this.ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
  }

  async callLLM(prompt: string): Promise<{ text: string; model: string; inputTokens?: number; outputTokens?: number }> {
    return this.circuitBreaker.execute(() => this.executeLlmCall(prompt));
  }

  private async executeLlmCall(prompt: string): Promise<{ text: string; model: string; inputTokens?: number; outputTokens?: number }> {
    if (this.provider === 'anthropic') {
      return this.callAnthropic(prompt);
    } else if (this.provider === 'openai') {
      return this.callOpenAi(prompt);
    } else if (this.provider === 'ollama') {
      return this.callOllama(prompt);
    } else {
      throw new Error(`Unsupported LLM Provider: ${this.provider}`);
    }
  }

  private async callAnthropic(prompt: string) {
    if (!this.anthropicKey) {
      throw new InternalServerErrorException('Anthropic API key is not configured');
    }

    const model = 'claude-3-5-sonnet-20241022';
    const response = await firstValueFrom(
      this.httpService.post(
        'https://api.anthropic.com/v1/messages',
        {
          model,
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            'x-api-key': this.anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 10000, // 10s timeout constraint
        }
      )
    );

    const body = response.data;
    const text = body.content?.[0]?.text || '';
    const inputTokens = body.usage?.input_tokens;
    const outputTokens = body.usage?.output_tokens;

    return { text, model, inputTokens, outputTokens };
  }

  private async callOpenAi(prompt: string) {
    if (!this.openAiKey) {
      throw new InternalServerErrorException('OpenAI API key is not configured');
    }

    const model = 'gpt-4o';
    const response = await firstValueFrom(
      this.httpService.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${this.openAiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      )
    );

    const body = response.data;
    const text = body.choices?.[0]?.message?.content || '';
    const inputTokens = body.usage?.prompt_tokens;
    const outputTokens = body.usage?.completion_tokens;

    return { text, model, inputTokens, outputTokens };
  }

  private async callOllama(prompt: string) {
    const model = 'llama3';
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.ollamaEndpoint}/api/chat`,
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          format: 'json',
        },
        {
          timeout: 10000,
        }
      )
    );

    const body = response.data;
    const text = body.message?.content || '';

    return { text, model };
  }
}
