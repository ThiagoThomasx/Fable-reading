import { describe, it, expect } from 'vitest';
import { buildSearchIndex, searchLibrary, type SearchIndexInput } from './search-index';
import type { Book, ReadingAnnotation, BookReview, ReadingSession } from '../types/models';

const NOW = '2026-07-11T12:00:00.000Z';

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    title: 'O Nome do Vento',
    author: 'Patrick Rothfuss',
    totalPages: 400,
    currentPage: 10,
    status: 'reading',
    category: 'Fantasia',
    tags: [],
    coverSource: 'extracted',
    fileRef: 'book-1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeAnnotation(overrides: Partial<ReadingAnnotation> = {}): ReadingAnnotation {
  return {
    id: 'annotation-1',
    bookId: 'book-1',
    page: 5,
    type: 'page_note',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeReview(overrides: Partial<BookReview> = {}): BookReview {
  return {
    bookId: 'book-1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeSession(overrides: Partial<ReadingSession> = {}): ReadingSession {
  return {
    id: 'session-1',
    bookId: 'book-1',
    startedAt: NOW,
    endedAt: NOW,
    durationMs: 60000,
    startPage: 1,
    endPage: 5,
    pagesRead: 4,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function emptyInput(overrides: Partial<SearchIndexInput> = {}): SearchIndexInput {
  return { books: [], annotations: [], reviews: [], sessions: [], ...overrides };
}

describe('buildSearchIndex', () => {
  it('indexes book title, author and category', () => {
    const index = buildSearchIndex(emptyInput({ books: [makeBook()] }));
    const types = index.map((r) => r.type).sort();
    expect(types).toEqual(['book_author', 'book_category', 'book_title']);
  });

  it('omits author/category entries when absent', () => {
    const book = makeBook({ author: undefined, category: '' });
    const index = buildSearchIndex(emptyInput({ books: [book] }));
    expect(index).toHaveLength(1);
    expect(index[0].type).toBe('book_title');
  });

  it('indexes a highlight with quoteText and a page number', () => {
    const book = makeBook();
    const annotation = makeAnnotation({ type: 'highlight', quoteText: 'Trecho marcante', page: 42 });
    const index = buildSearchIndex(emptyInput({ books: [book], annotations: [annotation] }));
    const highlight = index.find((r) => r.type === 'highlight');
    expect(highlight).toMatchObject({ page: 42, snippet: 'Trecho marcante', bookId: 'book-1' });
  });

  it('skips a highlight without quoteText', () => {
    const book = makeBook();
    const annotation = makeAnnotation({ type: 'highlight', quoteText: undefined });
    const index = buildSearchIndex(emptyInput({ books: [book], annotations: [annotation] }));
    expect(index.some((r) => r.type === 'highlight')).toBe(false);
  });

  it('indexes a page_note body', () => {
    const book = makeBook();
    const annotation = makeAnnotation({ type: 'page_note', body: 'Lembrar de reler isso' });
    const index = buildSearchIndex(emptyInput({ books: [book], annotations: [annotation] }));
    expect(index.find((r) => r.type === 'page_note')).toMatchObject({
      snippet: 'Lembrar de reler isso',
    });
  });

  it('skips a bookmark without a text body', () => {
    const book = makeBook();
    const annotation = makeAnnotation({ type: 'bookmark', body: undefined });
    const index = buildSearchIndex(emptyInput({ books: [book], annotations: [annotation] }));
    expect(index.some((r) => r.type === 'bookmark')).toBe(false);
  });

  it('indexes a bookmark that has a text body', () => {
    const book = makeBook();
    const annotation = makeAnnotation({ type: 'bookmark', body: 'Retomar aqui', page: 12 });
    const index = buildSearchIndex(emptyInput({ books: [book], annotations: [annotation] }));
    expect(index.find((r) => r.type === 'bookmark')).toMatchObject({ page: 12, snippet: 'Retomar aqui' });
  });

  it('drops an annotation whose book no longer exists (orphan)', () => {
    const annotation = makeAnnotation({ type: 'page_note', body: 'Órfã', bookId: 'missing-book' });
    const index = buildSearchIndex(emptyInput({ annotations: [annotation] }));
    expect(index).toHaveLength(0);
  });

  it('indexes review title/body as a single combined entry', () => {
    const book = makeBook();
    const review = makeReview({ title: 'Impressão geral', body: 'Gostei muito do ritmo' });
    const index = buildSearchIndex(emptyInput({ books: [book], reviews: [review] }));
    const reviewResult = index.find((r) => r.type === 'review');
    expect(reviewResult?.snippet).toContain('Impressão geral');
    expect(reviewResult?.snippet).toContain('Gostei muito do ritmo');
  });

  it('indexes each mainTakeaway as its own entry', () => {
    const book = makeBook();
    const review = makeReview({ mainTakeaways: ['Ideia um', 'Ideia dois', '   '] });
    const index = buildSearchIndex(emptyInput({ books: [book], reviews: [review] }));
    const takeaways = index.filter((r) => r.type === 'takeaway');
    expect(takeaways).toHaveLength(2);
    expect(takeaways.map((t) => t.snippet)).toEqual(['Ideia um', 'Ideia dois']);
  });

  it('skips a review with no title, body or takeaways', () => {
    const book = makeBook();
    const review = makeReview({ rating: 4 });
    const index = buildSearchIndex(emptyInput({ books: [book], reviews: [review] }));
    expect(index.some((r) => r.type === 'review' || r.type === 'takeaway')).toBe(false);
  });

  it('indexes a session manual note with its endPage', () => {
    const book = makeBook();
    const session = makeSession({ notes: 'Sessão produtiva hoje', endPage: 30 });
    const index = buildSearchIndex(emptyInput({ books: [book], sessions: [session] }));
    expect(index.find((r) => r.type === 'session_note')).toMatchObject({
      page: 30,
      snippet: 'Sessão produtiva hoje',
    });
  });

  it('skips a session without a manual note', () => {
    const book = makeBook();
    const session = makeSession({ notes: undefined });
    const index = buildSearchIndex(emptyInput({ books: [book], sessions: [session] }));
    expect(index.some((r) => r.type === 'session_note')).toBe(false);
  });
});

describe('searchLibrary', () => {
  it('returns an empty array for a blank query', () => {
    const index = buildSearchIndex(emptyInput({ books: [makeBook()] }));
    expect(searchLibrary('   ', index)).toEqual([]);
  });

  it('matches case-insensitively and ignores accents', () => {
    const index = buildSearchIndex(emptyInput({ books: [makeBook({ title: 'Café com Livros' })] }));
    const results = searchLibrary('CAFE', index);
    expect(results).toHaveLength(1);
    expect(results[0].snippet).toBe('Café com Livros');
  });

  it('ranks a book title above a highlight containing the same word', () => {
    const book = makeBook({ title: 'Duna' });
    const annotation = makeAnnotation({ type: 'highlight', quoteText: 'O deserto de Duna era vasto' });
    const index = buildSearchIndex(emptyInput({ books: [book], annotations: [annotation] }));
    const results = searchLibrary('Duna', index);
    expect(results[0].type).toBe('book_title');
  });

  it('does not return unrelated entries', () => {
    const book = makeBook({ title: 'Duna' });
    const index = buildSearchIndex(emptyInput({ books: [book] }));
    expect(searchLibrary('Xenofonte', index)).toEqual([]);
  });

  it('breaks ties by most recently updated first', () => {
    const older = makeBook({ id: 'a', title: 'Repetido', updatedAt: '2026-01-01T00:00:00.000Z' });
    const newer = makeBook({ id: 'b', title: 'Repetido', updatedAt: '2026-06-01T00:00:00.000Z' });
    const index = buildSearchIndex(emptyInput({ books: [older, newer] }));
    const results = searchLibrary('Repetido', index);
    expect(results.map((r) => r.bookId)).toEqual(['b', 'a']);
  });
});
