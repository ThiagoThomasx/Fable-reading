/** Estado de navegação do app (sem router nesta fase — quatro views apenas). */
import { create } from 'zustand';

export type AppView =
  | { name: 'library' }
  /** `page` opcional: presente quando a navegação veio de um resultado de busca ancorado a uma página. */
  | { name: 'reader'; bookId: string; page?: number }
  | { name: 'dashboard' }
  | { name: 'search' }
  | { name: 'ai-assistant' }
  | { name: 'ai-chat' };

type UIState = {
  view: AppView;
  openReader: (bookId: string, page?: number) => void;
  closeReader: () => void;
  openDashboard: () => void;
  openLibrary: () => void;
  openSearch: () => void;
  openAiAssistant: () => void;
  openAiChat: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  view: { name: 'library' },
  openReader: (bookId, page) => set({ view: { name: 'reader', bookId, page } }),
  closeReader: () => set({ view: { name: 'library' } }),
  openDashboard: () => set({ view: { name: 'dashboard' } }),
  openLibrary: () => set({ view: { name: 'library' } }),
  openSearch: () => set({ view: { name: 'search' } }),
  openAiAssistant: () => set({ view: { name: 'ai-assistant' } }),
  openAiChat: () => set({ view: { name: 'ai-chat' } }),
}));
