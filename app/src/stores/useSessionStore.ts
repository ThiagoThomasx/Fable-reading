/**
 * Store global de sessões de leitura. Todas as mutações são imutáveis.
 * Carrega sob demanda por livro (não há necessidade de manter todas as
 * sessões de todos os livros em memória).
 */
import { create } from 'zustand';
import type { ReadingSession, SessionPatch } from '../types/models';
import {
  listSessionsForBook,
  listAllSessions,
  createSession,
  updateSession,
  deleteSession,
} from '../db/sessions-repo';

type SessionState = {
  sessions: ReadingSession[];
  loadedBookId: string | null;
  error: string | null;
  loadForBook: (bookId: string) => Promise<void>;
  add: (session: ReadingSession) => Promise<void>;
  patch: (id: string, patch: SessionPatch) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Todas as sessões, de todos os livros — usadas apenas pelo Dashboard. */
  allSessions: ReadingSession[];
  isAllLoaded: boolean;
  allError: string | null;
  loadAll: () => Promise<void>;
};

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  loadedBookId: null,
  error: null,
  allSessions: [],
  isAllLoaded: false,
  allError: null,

  loadForBook: async (bookId) => {
    try {
      const sessions = await listSessionsForBook(bookId);
      sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
      set({ sessions, loadedBookId: bookId, error: null });
    } catch (error) {
      set({
        loadedBookId: bookId,
        error: error instanceof Error ? error.message : 'Falha ao carregar o histórico de sessões.',
      });
    }
  },

  loadAll: async () => {
    try {
      const allSessions = await listAllSessions();
      set({ allSessions, isAllLoaded: true, allError: null });
    } catch (error) {
      set({
        isAllLoaded: true,
        allError: error instanceof Error ? error.message : 'Falha ao carregar as sessões de leitura.',
      });
    }
  },

  add: async (session) => {
    await createSession(session);
    set((state) => ({
      sessions:
        state.loadedBookId === session.bookId ? [...state.sessions, session] : state.sessions,
      allSessions: state.isAllLoaded ? [...state.allSessions, session] : state.allSessions,
    }));
  },

  patch: async (id, patch) => {
    const updated = await updateSession(id, patch);
    set((state) => ({
      sessions: state.sessions.map((session) => (session.id === id ? updated : session)),
      allSessions: state.allSessions.map((session) => (session.id === id ? updated : session)),
    }));
  },

  remove: async (id) => {
    await deleteSession(id);
    set((state) => ({
      sessions: state.sessions.filter((session) => session.id !== id),
      allSessions: state.allSessions.filter((session) => session.id !== id),
    }));
  },
}));
