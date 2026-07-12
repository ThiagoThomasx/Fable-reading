/**
 * Sprint 14 (spike) — estimativa aproximada de tokens, sem depender de um tokenizer
 * real (tiktoken etc.). Heurística padrão da indústria para texto em português/inglês:
 * ~4 caracteres por token. Suficiente para dar ao usuário uma noção de custo/tamanho
 * antes de uma eventual integração real — não é precisa e não deve ser tratada como tal.
 */
import type { AIProviderMessage } from './ai-provider';

const CHARS_PER_TOKEN = 4;

/** Estimativa aproximada (arredondada para cima); string vazia ou só espaços = 0. */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length / CHARS_PER_TOKEN);
}

export function estimateMessagesTokens(messages: AIProviderMessage[]): number {
  return messages.reduce((sum, message) => sum + estimateTokens(message.content), 0);
}

export type ContextSizeEstimate = {
  chars: number;
  words: number;
  approxTokens: number;
};

/** Resumo de tamanho para exibir na UI antes de enviar um contexto/prompt. */
export function estimateContextSize(text: string): ContextSizeEstimate {
  const trimmed = text.trim();
  const chars = trimmed.length;
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  return { chars, words, approxTokens: estimateTokens(text) };
}
