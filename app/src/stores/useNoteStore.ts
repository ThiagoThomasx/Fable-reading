/**
 * Store global de anotações de leitura (notas por página + marcadores). Todas as
 * mutações são imutáveis. Carrega sob demanda por livro — usado tanto pelo painel
 * lateral da Reading Surface quanto pela lista fora do reader (EditBookDialog).
 */
import { create } from 'zustand';
import type { ReadingAnnotation, AnnotationPatch } from '../types/models';
import {
  listAnnotationsForBook,
  listAllAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from '../db/notes-repo';

type NoteState = {
  annotations: ReadingAnnotation[];
  loadedBookId: string | null;
  error: string | null;
  loadForBook: (bookId: string) => Promise<void>;
  add: (annotation: ReadingAnnotation) => Promise<void>;
  patch: (id: string, patch: AnnotationPatch) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /**
   * Centraliza a regra de "no máximo um bookmark por página": remove se já existir,
   * cria caso contrário. Usado tanto pelo atalho de teclado (B) quanto pelo botão do
   * painel — evita duplicar a lógica e permite testar a prevenção de duplicidade.
   */
  toggleBookmark: (bookId: string, page: number) => Promise<void>;
  /** Todas as anotações, de todos os livros — usadas pela busca global (Sprint 12). */
  allAnnotations: ReadingAnnotation[];
  isAllLoaded: boolean;
  loadAll: () => Promise<void>;
};

export const useNoteStore = create<NoteState>((set, get) => ({
  annotations: [],
  loadedBookId: null,
  error: null,
  allAnnotations: [],
  isAllLoaded: false,

  loadForBook: async (bookId) => {
    try {
      const annotations = await listAnnotationsForBook(bookId);
      annotations.sort((a, b) => a.page - b.page);
      set({ annotations, loadedBookId: bookId, error: null });
    } catch (error) {
      set({
        loadedBookId: bookId,
        error: error instanceof Error ? error.message : 'Falha ao carregar as anotações.',
      });
    }
  },

  add: async (annotation) => {
    await createAnnotation(annotation);
    set((state) => ({
      annotations:
        state.loadedBookId === annotation.bookId
          ? [...state.annotations, annotation].sort((a, b) => a.page - b.page)
          : state.annotations,
      allAnnotations: state.isAllLoaded ? [...state.allAnnotations, annotation] : state.allAnnotations,
    }));
  },

  patch: async (id, patch) => {
    const updated = await updateAnnotation(id, patch);
    set((state) => ({
      annotations: state.annotations
        .map((annotation) => (annotation.id === id ? updated : annotation))
        .sort((a, b) => a.page - b.page),
      allAnnotations: state.allAnnotations.map((annotation) =>
        annotation.id === id ? updated : annotation,
      ),
    }));
  },

  remove: async (id) => {
    await deleteAnnotation(id);
    set((state) => ({
      annotations: state.annotations.filter((annotation) => annotation.id !== id),
      allAnnotations: state.allAnnotations.filter((annotation) => annotation.id !== id),
    }));
  },

  toggleBookmark: async (bookId, page) => {
    const state = get();
    const existing =
      state.loadedBookId === bookId
        ? state.annotations.find((a) => a.type === 'bookmark' && a.page === page)
        : undefined;

    if (existing) {
      await deleteAnnotation(existing.id);
      set((current) => ({
        annotations: current.annotations.filter((a) => a.id !== existing.id),
        allAnnotations: current.allAnnotations.filter((a) => a.id !== existing.id),
      }));
      return;
    }

    const now = new Date().toISOString();
    const bookmark: ReadingAnnotation = {
      id: crypto.randomUUID(),
      bookId,
      page,
      type: 'bookmark',
      createdAt: now,
      updatedAt: now,
    };
    await createAnnotation(bookmark);
    set((current) => ({
      annotations:
        current.loadedBookId === bookId
          ? [...current.annotations, bookmark].sort((a, b) => a.page - b.page)
          : current.annotations,
      allAnnotations: current.isAllLoaded
        ? [...current.allAnnotations, bookmark]
        : current.allAnnotations,
    }));
  },

  loadAll: async () => {
    try {
      const allAnnotations = await listAllAnnotations();
      set({ allAnnotations, isAllLoaded: true });
    } catch {
      set({ isAllLoaded: true });
    }
  },
}));
