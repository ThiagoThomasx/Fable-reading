/**
 * Store global de livros (metadata apenas — Blobs vivem na store 'files' do
 * IndexedDB e nunca passam por aqui). Todas as mutações são imutáveis.
 */
import { create } from 'zustand';
import type { Book, BookPatch } from '../types/models';
import { listBooks, createBook, updateBook, deleteBook } from '../db/books-repo';
import { saveFile, deleteFile, loadFile } from '../db/files-repo';
import { deleteSessionsForBook } from '../db/sessions-repo';
import { deleteAnnotationsForBook } from '../db/notes-repo';
import { deleteReviewForBook } from '../db/reviews-repo';
import { imageFileToThumbnail } from '../lib/pdf/snapshot';
import { useSessionStore } from './useSessionStore';
import { useNoteStore } from './useNoteStore';
import { useReviewStore } from './useReviewStore';

/**
 * probe-pdf puxa o pdfjs-dist (~570KB min). Import dinâmico para mantê-lo fora
 * do bundle inicial da Biblioteca — critério de QA da Sprint 1.
 */
async function loadProbePdf() {
  const { probePdf } = await import('../lib/pdf/probe-pdf');
  return probePdf;
}

export type AddBookInput = {
  file: File;
  title: string;
  author?: string;
  category: string;
  coverSource: 'extracted' | 'manual';
  /** Obrigatório quando coverSource === 'manual'. */
  manualCoverFile?: File;
  /** Capa já extraída pela sondagem do diálogo (evita re-renderizar a 1ª página). */
  extractedCoverUrl?: string;
};

type BookState = {
  books: Book[];
  isLoaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (input: AddBookInput) => Promise<Book>;
  patch: (id: string, patch: BookPatch) => Promise<void>;
  remove: (id: string) => Promise<void>;
  extractCoverFromFile: (id: string) => Promise<string>;
};

async function resolveCover(input: AddBookInput): Promise<string> {
  if (input.coverSource === 'manual') {
    if (!input.manualCoverFile) {
      throw new Error('Capa manual selecionada, mas nenhuma imagem foi enviada');
    }
    return imageFileToThumbnail(input.manualCoverFile);
  }
  if (input.extractedCoverUrl) return input.extractedCoverUrl;
  const probePdf = await loadProbePdf();
  const probe = await probePdf(await input.file.arrayBuffer());
  return probe.coverDataUrl;
}

export const useBookStore = create<BookState>((set) => ({
  books: [],
  isLoaded: false,
  error: null,

  load: async () => {
    try {
      const books = await listBooks();
      set({ books, isLoaded: true, error: null });
    } catch (error) {
      set({
        isLoaded: true,
        error: error instanceof Error ? error.message : 'Falha ao carregar a biblioteca.',
      });
    }
  },

  add: async (input) => {
    if (!input.title.trim()) throw new Error('Título é obrigatório');
    // Sonda o PDF antes de persistir qualquer coisa (falha cedo em PDF corrompido)
    const probePdf = await loadProbePdf();
    const probe = await probePdf(await input.file.arrayBuffer());
    const coverUrl = await resolveCover(input);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const book: Book = {
      id,
      title: input.title.trim(),
      author: input.author?.trim() || undefined,
      totalPages: probe.totalPages,
      currentPage: 1,
      status: 'want_to_read',
      category: input.category.trim() || 'Geral',
      tags: [],
      coverSource: input.coverSource,
      coverUrl,
      fileRef: id,
      readingTheme: 'paper',
      createdAt: now,
      updatedAt: now,
    };

    await saveFile(id, input.file);
    try {
      await createBook(book);
    } catch (error) {
      await deleteFile(id).catch(() => undefined); // não deixar Blob órfão
      throw error;
    }
    set((state) => ({ books: [...state.books, book] }));
    return book;
  },

  patch: async (id, patch) => {
    const updated = await updateBook(id, patch);
    set((state) => ({
      books: state.books.map((book) => (book.id === id ? updated : book)),
    }));
  },

  /**
   * Cascade completo: livro + arquivo + sessões + anotações + review. Sem isso,
   * sessões, notas e reviews do livro excluído ficavam órfãs no IndexedDB
   * (bookId sem livro correspondente) — ver auditoria da Sprint 10.
   */
  remove: async (id) => {
    await deleteBook(id);
    await deleteFile(id).catch(() => undefined);
    await deleteSessionsForBook(id);
    await deleteAnnotationsForBook(id);
    await deleteReviewForBook(id);
    set((state) => ({ books: state.books.filter((book) => book.id !== id) }));
    useSessionStore.setState((state) => ({
      sessions: state.loadedBookId === id ? [] : state.sessions,
      allSessions: state.allSessions.filter((session) => session.bookId !== id),
    }));
    useNoteStore.setState((state) => ({
      annotations: state.loadedBookId === id ? [] : state.annotations,
      allAnnotations: state.allAnnotations.filter((annotation) => annotation.bookId !== id),
    }));
    useReviewStore.setState((state) => ({
      review: state.loadedBookId === id ? null : state.review,
      allReviews: state.allReviews.filter((review) => review.bookId !== id),
    }));
  },

  /** Re-extrai a capa da 1ª página a partir do Blob já salvo — usado para "voltar para capa extraída". */
  extractCoverFromFile: async (id) => {
    const blob = await loadFile(id);
    if (!blob) throw new Error('Arquivo do livro não encontrado.');
    const probePdf = await loadProbePdf();
    const probe = await probePdf(await blob.arrayBuffer());
    return probe.coverDataUrl;
  },
}));
