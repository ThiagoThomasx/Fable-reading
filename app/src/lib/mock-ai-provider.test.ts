import { describe, it, expect } from 'vitest';
import { createMockAiProvider, MOCK_PROVIDER_NAME, MOCK_RESPONSE_DISCLAIMER } from './mock-ai-provider';

describe('createMockAiProvider', () => {
  it('exposes a name that signals it is local/mocked', () => {
    const provider = createMockAiProvider();
    expect(provider.name).toBe(MOCK_PROVIDER_NAME);
  });

  it('never rejects and always includes the mock disclaimer in the response', async () => {
    const provider = createMockAiProvider();
    const response = await provider.complete({
      messages: [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'O que diz o contexto?' },
      ],
    });
    expect(response.content).toContain(MOCK_RESPONSE_DISCLAIMER);
  });

  it('returns token usage estimates derived from the request/response text', async () => {
    const provider = createMockAiProvider();
    const response = await provider.complete({
      messages: [{ role: 'user', content: 'a'.repeat(40) }],
    });
    expect(response.usage?.inputTokens).toBeGreaterThan(0);
    expect(response.usage?.outputTokens).toBeGreaterThan(0);
    expect(response.usage?.totalTokens).toBe(
      (response.usage?.inputTokens ?? 0) + (response.usage?.outputTokens ?? 0),
    );
  });

  it('handles an empty messages array without throwing', async () => {
    const provider = createMockAiProvider();
    await expect(provider.complete({ messages: [] })).resolves.toBeDefined();
  });
});
