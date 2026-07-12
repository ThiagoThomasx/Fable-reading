import { describe, it, expect, beforeEach } from 'vitest';
import { useAiSettingsStore, DEFAULT_REAL_BASE_URL, DEFAULT_REAL_MODEL } from './useAiSettingsStore';

describe('useAiSettingsStore', () => {
  beforeEach(() => {
    useAiSettingsStore.setState({
      mode: 'mock',
      apiKey: '',
      baseUrl: DEFAULT_REAL_BASE_URL,
      model: DEFAULT_REAL_MODEL,
    });
  });

  it('defaults to mock mode with an empty apiKey', () => {
    const state = useAiSettingsStore.getState();
    expect(state.mode).toBe('mock');
    expect(state.apiKey).toBe('');
  });

  it('setMode switches between mock and real', () => {
    useAiSettingsStore.getState().setMode('real');
    expect(useAiSettingsStore.getState().mode).toBe('real');
    useAiSettingsStore.getState().setMode('mock');
    expect(useAiSettingsStore.getState().mode).toBe('mock');
  });

  it('setApiKey stores the key only in memory state', () => {
    useAiSettingsStore.getState().setApiKey('sk-test-123');
    expect(useAiSettingsStore.getState().apiKey).toBe('sk-test-123');
  });

  it('clearApiKey resets the key without touching other settings', () => {
    useAiSettingsStore.getState().setApiKey('sk-test-123');
    useAiSettingsStore.getState().setMode('real');
    useAiSettingsStore.getState().clearApiKey();
    const state = useAiSettingsStore.getState();
    expect(state.apiKey).toBe('');
    expect(state.mode).toBe('real');
  });

  it('setBaseUrl and setModel update independently', () => {
    useAiSettingsStore.getState().setBaseUrl('https://openrouter.ai/api/v1');
    useAiSettingsStore.getState().setModel('meta-llama/llama-3.1-8b-instruct');
    const state = useAiSettingsStore.getState();
    expect(state.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(state.model).toBe('meta-llama/llama-3.1-8b-instruct');
  });
});
