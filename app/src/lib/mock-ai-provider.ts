/**
 * Sprint 14 (spike) — implementação mock de AIProvider. Nunca faz rede: gera uma resposta
 * determinística e claramente sinalizada como simulada, só para validar a UX do chat e o
 * fluxo de contexto/tokens. Não deve ser confundida com um provider real — não adicione
 * aqui nenhuma chave de API ou chamada fetch/XHR.
 */
import type { AIProvider, AIProviderMessage, AIProviderRequest, AIProviderResponse } from './ai-provider';
import { estimateMessagesTokens, estimateTokens } from './token-estimate';

export const MOCK_PROVIDER_NAME = 'Mock (local, sem rede)';

export const MOCK_RESPONSE_DISCLAIMER =
  'Resposta simulada (spike técnico da Sprint 14) — nenhuma chamada externa foi feita.';

function lastUserMessage(messages: AIProviderMessage[]): AIProviderMessage | undefined {
  return [...messages].reverse().find((message) => message.role === 'user');
}

/** Conta seções "## " no texto — usado para estimar quantos trechos de contexto foram enviados. */
function countSourceSections(content: string): number {
  const matches = content.match(/^## /gm);
  return matches ? matches.length : 0;
}

function buildMockReplyContent(request: AIProviderRequest): string {
  const question = lastUserMessage(request.messages);
  const sourceCount = question ? countSourceSections(question.content) : 0;

  const lines: string[] = [];
  lines.push(MOCK_RESPONSE_DISCLAIMER, '');
  if (question?.content.trim()) {
    lines.push(`Você perguntou algo relacionado ao contexto acima.`, '');
  }
  lines.push(
    sourceCount > 0
      ? `Em uma integração real, a IA usaria os ${sourceCount} trecho(s) recuperados da sua ` +
        'biblioteca local (ver painel de contexto) para responder com base neles.'
      : 'Nenhum trecho local foi recuperado para esta pergunta — uma IA real provavelmente ' +
        'pediria mais contexto ou avisaria que não encontrou dados suficientes.',
  );
  return lines.join('\n');
}

/** Simula uma latência de rede pequena e variável, sem nenhuma chamada real. */
function simulateLatency(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 300));
}

export function createMockAiProvider(): AIProvider {
  return {
    name: MOCK_PROVIDER_NAME,
    async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
      await simulateLatency();
      const content = buildMockReplyContent(request);
      return {
        content,
        usage: {
          inputTokens: estimateMessagesTokens(request.messages),
          outputTokens: estimateTokens(content),
          totalTokens: estimateMessagesTokens(request.messages) + estimateTokens(content),
        },
      };
    },
  };
}
