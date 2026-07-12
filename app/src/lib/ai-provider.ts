/**
 * Sprint 14 (spike) — abstração de provider de IA, desacoplada de qualquer SDK
 * (OpenAI/Anthropic/etc). Nenhuma implementação real existe nesta sprint — apenas
 * o contrato e o MockAIProvider (ver mock-ai-provider.ts). Trocar por um provider
 * real no futuro não deve exigir mudanças na UI de chat, só uma nova implementação
 * desta interface.
 */
export type AIProviderMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AIProviderRequest = {
  messages: AIProviderMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type AIProviderResponse = {
  content: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

export type AIProvider = {
  name: string;
  complete(request: AIProviderRequest): Promise<AIProviderResponse>;
};
