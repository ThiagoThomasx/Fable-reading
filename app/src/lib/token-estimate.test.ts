import { describe, it, expect } from 'vitest';
import { estimateTokens, estimateMessagesTokens, estimateContextSize } from './token-estimate';

describe('estimateTokens', () => {
  it('returns 0 for empty or whitespace-only text', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('   ')).toBe(0);
  });

  it('estimates roughly 4 chars per token, rounded up', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
    expect(estimateTokens('a'.repeat(40))).toBe(10);
  });
});

describe('estimateMessagesTokens', () => {
  it('sums token estimates across all messages', () => {
    const total = estimateMessagesTokens([
      { role: 'system', content: 'a'.repeat(8) },
      { role: 'user', content: 'a'.repeat(4) },
    ]);
    expect(total).toBe(3);
  });

  it('returns 0 for an empty message list', () => {
    expect(estimateMessagesTokens([])).toBe(0);
  });
});

describe('estimateContextSize', () => {
  it('reports chars, words and approxTokens', () => {
    const result = estimateContextSize('quatro palavras aqui mesmo');
    expect(result.words).toBe(4);
    expect(result.chars).toBe('quatro palavras aqui mesmo'.length);
    expect(result.approxTokens).toBeGreaterThan(0);
  });

  it('reports zeros for empty text', () => {
    expect(estimateContextSize('')).toEqual({ chars: 0, words: 0, approxTokens: 0 });
  });
});
