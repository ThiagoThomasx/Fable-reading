/**
 * Sprint 15 — adapter real de AIProvider para endpoints compatíveis com o formato
 * "OpenAI chat completions" (OpenAI, OpenRouter, Groq, Ollama local, etc.). Implementa
 * o mesmo contrato de lib/ai-provider.ts (ver mock-ai-provider.ts) via fetch puro — sem
 * SDK novo. Nunca chama nada sozinho: só executa quando `complete()` é invocado
 * explicitamente pela UI, após confirmação do usuário (ver features/ai-chat/AiChat.tsx).
 * A apiKey nunca é logada nem incluída em mensagens de erro.
 */
import type { AIProvider, AIProviderRequest, AIProviderResponse } from './ai-provider';

export type OpenAiCompatibleConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

type ChatCompletionsResponseBody = {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function assertConfig(config: OpenAiCompatibleConfig): void {
  if (!config.apiKey.trim()) throw new Error('Configure uma API key antes de usar o provider real.');
  if (!config.baseUrl.trim()) throw new Error('Configure a URL base do provider real.');
  if (!config.model.trim()) throw new Error('Configure o modelo do provider real.');
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body?.error?.message) return body.error.message;
  } catch {
    // corpo não é JSON ou está vazio — segue com a mensagem genérica
  }
  return `HTTP ${response.status}`;
}

/**
 * Cria um AIProvider real. Lança sincronamente se a config estiver incompleta, para que a
 * UI possa validar antes de sequer permitir a etapa de confirmação de envio.
 */
export function createOpenAiCompatibleProvider(config: OpenAiCompatibleConfig): AIProvider {
  assertConfig(config);
  const baseUrl = normalizeBaseUrl(config.baseUrl);

  return {
    name: `OpenAI-compatible (${baseUrl})`,
    async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
          temperature: request.temperature,
          max_tokens: request.maxTokens,
        }),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(`Falha ao chamar o provider real: ${message}`);
      }

      const body = (await response.json()) as ChatCompletionsResponseBody;
      const content = body.choices?.[0]?.message?.content ?? '';
      if (!content) throw new Error('O provider real respondeu sem conteúdo utilizável.');

      return {
        content,
        usage: body.usage
          ? {
              inputTokens: body.usage.prompt_tokens,
              outputTokens: body.usage.completion_tokens,
              totalTokens: body.usage.total_tokens,
            }
          : undefined,
      };
    },
  };
}
