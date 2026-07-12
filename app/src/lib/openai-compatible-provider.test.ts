import { describe, it, expect, vi, afterEach } from 'vitest';
import { createOpenAiCompatibleProvider } from './openai-compatible-provider';

const validConfig = { apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' };

describe('createOpenAiCompatibleProvider', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('throws synchronously when apiKey is missing', () => {
    expect(() => createOpenAiCompatibleProvider({ ...validConfig, apiKey: '' })).toThrow(/API key/);
  });

  it('throws synchronously when baseUrl is missing', () => {
    expect(() => createOpenAiCompatibleProvider({ ...validConfig, baseUrl: '' })).toThrow(/URL base/);
  });

  it('throws synchronously when model is missing', () => {
    expect(() => createOpenAiCompatibleProvider({ ...validConfig, model: '' })).toThrow(/modelo/);
  });

  it('never fires a request during construction', () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    createOpenAiCompatibleProvider(validConfig);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends the apiKey as a Bearer token and never in the URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'olá' } }] }),
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const provider = createOpenAiCompatibleProvider(validConfig);
    await provider.complete({ messages: [{ role: 'user', content: 'oi' }] });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain(validConfig.apiKey);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${validConfig.apiKey}`);
  });

  it('parses content and usage from a successful response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'resposta real' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    }) as unknown as typeof fetch;

    const provider = createOpenAiCompatibleProvider(validConfig);
    const response = await provider.complete({ messages: [{ role: 'user', content: 'oi' }] });

    expect(response.content).toBe('resposta real');
    expect(response.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
  });

  it('throws a descriptive error on a non-ok response without leaking the apiKey', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    }) as unknown as typeof fetch;

    const provider = createOpenAiCompatibleProvider(validConfig);
    await expect(provider.complete({ messages: [{ role: 'user', content: 'oi' }] })).rejects.toThrow(
      'Invalid API key',
    );
    await expect(provider.complete({ messages: [{ role: 'user', content: 'oi' }] })).rejects.not.toThrow(
      validConfig.apiKey,
    );
  });

  it('falls back to a generic HTTP status message when the error body is not JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    }) as unknown as typeof fetch;

    const provider = createOpenAiCompatibleProvider(validConfig);
    await expect(provider.complete({ messages: [{ role: 'user', content: 'oi' }] })).rejects.toThrow('HTTP 500');
  });

  it('throws when the response has no usable content', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    }) as unknown as typeof fetch;

    const provider = createOpenAiCompatibleProvider(validConfig);
    await expect(provider.complete({ messages: [{ role: 'user', content: 'oi' }] })).rejects.toThrow(
      /sem conteúdo/,
    );
  });

  it('strips a trailing slash from baseUrl before building the request URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const provider = createOpenAiCompatibleProvider({ ...validConfig, baseUrl: 'https://api.openai.com/v1/' });
    await provider.complete({ messages: [{ role: 'user', content: 'oi' }] });

    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
  });
});
