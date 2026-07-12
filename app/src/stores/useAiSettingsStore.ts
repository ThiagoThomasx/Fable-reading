/**
 * Sprint 15 — configuração do provider de IA usada pelo chat (features/ai-chat).
 * Deliberadamente SEM persistência (nem localStorage nem IndexedDB): a apiKey vive só
 * em memória do processo do navegador, é perdida ao recarregar a página e nunca é
 * escrita em disco. Ver decisão de segurança da Sprint 15 — persistir a chave exigiria
 * criptografia em repouso que este projeto não implementa nesta fase.
 */
import { create } from 'zustand';

export type AiProviderMode = 'mock' | 'real';

export const DEFAULT_REAL_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_REAL_MODEL = 'gpt-4o-mini';

type AiSettingsState = {
  mode: AiProviderMode;
  apiKey: string;
  baseUrl: string;
  model: string;
  setMode: (mode: AiProviderMode) => void;
  setApiKey: (apiKey: string) => void;
  setBaseUrl: (baseUrl: string) => void;
  setModel: (model: string) => void;
  clearApiKey: () => void;
};

export const useAiSettingsStore = create<AiSettingsState>((set) => ({
  mode: 'mock',
  apiKey: '',
  baseUrl: DEFAULT_REAL_BASE_URL,
  model: DEFAULT_REAL_MODEL,
  setMode: (mode) => set({ mode }),
  setApiKey: (apiKey) => set({ apiKey }),
  setBaseUrl: (baseUrl) => set({ baseUrl }),
  setModel: (model) => set({ model }),
  clearApiKey: () => set({ apiKey: '' }),
}));
