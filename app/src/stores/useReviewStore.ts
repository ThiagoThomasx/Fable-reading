/**
 * Store global da review pessoal de um livro (Sprint 11). Segue o padrão de
 * useNoteStore: carrega sob demanda por livro, mutações imutáveis, sem
 * autosave — a UI decide quando chamar `save` (botão explícito). `allReviews`
 * é um cache leve carregado à parte, usado só para badges/rating na Biblioteca
 * (não substitui `review`, que é o registro do livro atualmente em edição).
 */
import { create } from 'zustand';
import type { BookReview, ReviewPatch } from '../types/models';
import { getReviewByBook, upsertReview, deleteReviewForBook, listAllReviews } from '../db/reviews-repo';

type ReviewState = {
  review: BookReview | null;
  loadedBookId: string | null;
  error: string | null;
  allReviews: BookReview[];
  isAllLoaded: boolean;
  loadForBook: (bookId: string) => Promise<void>;
  save: (bookId: string, patch: ReviewPatch) => Promise<BookReview>;
  remove: (bookId: string) => Promise<void>;
  loadAll: () => Promise<void>;
};

export const useReviewStore = create<ReviewState>((set, get) => ({
  review: null,
  loadedBookId: null,
  error: null,
  allReviews: [],
  isAllLoaded: false,

  loadForBook: async (bookId) => {
    try {
      const review = await getReviewByBook(bookId);
      set({ review: review ?? null, loadedBookId: bookId, error: null });
    } catch (error) {
      set({
        loadedBookId: bookId,
        error: error instanceof Error ? error.message : 'Falha ao carregar a review.',
      });
    }
  },

  save: async (bookId, patch) => {
    const now = new Date().toISOString();
    const state = get();
    const existing = state.loadedBookId === bookId ? state.review : undefined;
    const review: BookReview = {
      ...existing,
      ...patch,
      bookId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const saved = await upsertReview(review);
    set((current) => ({
      review: saved,
      loadedBookId: bookId,
      error: null,
      allReviews: current.isAllLoaded
        ? [...current.allReviews.filter((existingReview) => existingReview.bookId !== bookId), saved]
        : current.allReviews,
    }));
    return saved;
  },

  remove: async (bookId) => {
    await deleteReviewForBook(bookId);
    set((state) => ({
      review: state.loadedBookId === bookId ? null : state.review,
      allReviews: state.allReviews.filter((review) => review.bookId !== bookId),
    }));
  },

  loadAll: async () => {
    try {
      const allReviews = await listAllReviews();
      set({ allReviews, isAllLoaded: true });
    } catch {
      set({ isAllLoaded: true });
    }
  },
}));
