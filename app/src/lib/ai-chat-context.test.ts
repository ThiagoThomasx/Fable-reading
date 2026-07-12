import { describe, it, expect } from 'vitest';
import { buildAiChatContext, AI_CHAT_SYSTEM_PROMPT } from './ai-chat-context';
import type { Book, ReadingAnnotation, ReadingSession, BookReview } from '../types/models';

function makeBook(overrides: Partial<Book> = {}): Book {
  const now = '2026-07-09T12:00:00.000Z';
  return {
    id: 'book-1',
    title: 'O Nome do Vento',
    totalPages: 200,
    currentPage: 89,
    status: 'reading',
    category: 'Fantasia',
    tags: [],
    coverSource: 'extracted',
    fileRef: 'book-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeAnnotation(overrides: Partial<ReadingAnnotation> = {}): ReadingAnnotation {
  const now = '2026-07-09T12:00:00.000Z';
  return {
    id: 'note-1',
    bookId: 'book-1',
    page: 12,
    type: 'highlight',
    quoteText: 'O silêncio sabe meu segredo.',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('buildAiChatContext', () => {
  it('returns empty context for an empty query', () => {
    const result = buildAiChatContext({
      query: '   ',
      books: [makeBook()],
      annotations: [],
      reviews: [],
      sessions: [],
    });
    expect(result.contextText).toBe('');
    expect(result.sources).toEqual([]);
  });

  it('returns empty context when there are no books at all', () => {
    const result = buildAiChatContext({
      query: 'vento',
      books: [],
      annotations: [],
      reviews: [],
      sessions: [],
    });
    expect(result.contextText).toBe('');
    expect(result.sources).toEqual([]);
  });

  it('retrieves matching highlights via the local search index', () => {
    const result = buildAiChatContext({
      query: 'silêncio',
      books: [makeBook()],
      annotations: [makeAnnotation()],
      reviews: [],
      sessions: [] as ReadingSession[],
    });
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].type).toBe('highlight');
    expect(result.contextText).toContain('O silêncio sabe meu segredo.');
    expect(result.contextText).toContain('100% localmente');
  });

  it('says clearly when no local snippet matches the query', () => {
    const result = buildAiChatContext({
      query: 'palavra-inexistente-xyz',
      books: [makeBook()],
      annotations: [makeAnnotation()],
      reviews: [] as BookReview[],
      sessions: [],
    });
    expect(result.sources).toEqual([]);
    expect(result.contextText).toContain('Nenhum trecho');
  });

  it('scopes retrieval to a single book when bookId is provided', () => {
    const otherBook = makeBook({ id: 'book-2', title: 'Outro Livro' });
    const otherAnnotation = makeAnnotation({
      id: 'note-2',
      bookId: 'book-2',
      quoteText: 'silêncio também aparece aqui',
    });
    const result = buildAiChatContext({
      query: 'silêncio',
      books: [makeBook(), otherBook],
      annotations: [makeAnnotation(), otherAnnotation],
      reviews: [],
      sessions: [],
      bookId: 'book-1',
    });
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].bookId).toBe('book-1');
  });

  it('caps results at maxSources', () => {
    const manyAnnotations: ReadingAnnotation[] = Array.from({ length: 10 }, (_, index) =>
      makeAnnotation({ id: `note-${index}`, quoteText: `silêncio número ${index}` }),
    );
    const result = buildAiChatContext({
      query: 'silêncio',
      books: [makeBook()],
      annotations: manyAnnotations,
      reviews: [],
      sessions: [],
      maxSources: 3,
    });
    expect(result.sources).toHaveLength(3);
  });

  it('exposes a system prompt constant instructing the model to stay within context', () => {
    expect(AI_CHAT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });
});
