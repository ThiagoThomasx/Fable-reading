import { describe, it, expect } from 'vitest';
import { generateAiContext, type AiContextSection } from './ai-context';
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

function makeSession(overrides: Partial<ReadingSession> = {}): ReadingSession {
  const now = '2026-07-09T12:00:00.000Z';
  return {
    id: 'session-1',
    bookId: 'book-1',
    startedAt: now,
    endedAt: '2026-07-09T12:20:00.000Z',
    durationMs: 20 * 60 * 1000,
    startPage: 1,
    endPage: 15,
    pagesRead: 14,
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
    type: 'page_note',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeReview(overrides: Partial<BookReview> = {}): BookReview {
  const now = '2026-07-09T12:00:00.000Z';
  return {
    bookId: 'book-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const ALL_SECTIONS: AiContextSection[] = [
  'metadata',
  'notes',
  'highlights',
  'bookmarks',
  'review',
  'sessions',
  'takeaways',
];

describe('generateAiContext', () => {
  it('includes the prompt instruction for the discussion type', () => {
    const output = generateAiContext({
      book: makeBook(),
      sessions: [],
      annotations: [],
      sections: ['metadata'],
      promptType: 'discussion',
      generatedAt: '2026-07-09T12:00:00.000Z',
    });
    expect(output).toContain('parceiro de leitura');
    expect(output).toContain('## Metadados');
  });

  it('omits the instruction block for the raw prompt type', () => {
    const output = generateAiContext({
      book: makeBook(),
      sessions: [],
      annotations: [],
      sections: ['metadata'],
      promptType: 'raw',
      generatedAt: '2026-07-09T12:00:00.000Z',
    });
    expect(output).not.toContain('parceiro de leitura');
    expect(output).not.toContain('perguntas de revisão');
  });

  it('only renders selected sections', () => {
    const output = generateAiContext({
      book: makeBook(),
      sessions: [makeSession()],
      annotations: [makeAnnotation({ type: 'highlight', quoteText: 'uma frase marcante' })],
      review: makeReview({ title: 'Ótimo livro' }),
      sections: ['metadata'],
      promptType: 'raw',
      generatedAt: '2026-07-09T12:00:00.000Z',
    });
    expect(output).toContain('## Metadados');
    expect(output).not.toContain('## Highlights');
    expect(output).not.toContain('## Review');
    expect(output).not.toContain('## Sessões de leitura');
  });

  it('separates notes, highlights and bookmarks into their own sections', () => {
    const output = generateAiContext({
      book: makeBook(),
      sessions: [],
      annotations: [
        makeAnnotation({ id: 'n1', type: 'page_note', body: 'nota de página' }),
        makeAnnotation({ id: 'h1', type: 'highlight', quoteText: 'trecho destacado' }),
        makeAnnotation({ id: 'b1', type: 'bookmark', page: 5 }),
      ],
      sections: ['notes', 'highlights', 'bookmarks'],
      promptType: 'raw',
      generatedAt: '2026-07-09T12:00:00.000Z',
    });
    expect(output).toContain('## Notas');
    expect(output).toContain('nota de página');
    expect(output).toContain('## Highlights');
    expect(output).toContain('trecho destacado');
    expect(output).toContain('## Marcadores');
    expect(output).toContain('Página marcada como importante.');
  });

  it('omits review and takeaways sections when there is no review, even if selected', () => {
    const output = generateAiContext({
      book: makeBook(),
      sessions: [],
      annotations: [],
      review: undefined,
      sections: ['review', 'takeaways'],
      promptType: 'raw',
      generatedAt: '2026-07-09T12:00:00.000Z',
    });
    expect(output).not.toContain('## Review');
    expect(output).not.toContain('## Principais ideias');
  });

  it('renders takeaways independently from the review section', () => {
    const output = generateAiContext({
      book: makeBook(),
      sessions: [],
      annotations: [],
      review: makeReview({ mainTakeaways: ['ideia 1', 'ideia 2'] }),
      sections: ['takeaways'],
      promptType: 'raw',
      generatedAt: '2026-07-09T12:00:00.000Z',
    });
    expect(output).not.toContain('## Review');
    expect(output).toContain('## Principais ideias');
    expect(output).toContain('- ideia 1');
    expect(output).toContain('- ideia 2');
  });

  it('escapes markdown-significant characters in note and review bodies', () => {
    const output = generateAiContext({
      book: makeBook(),
      sessions: [],
      annotations: [makeAnnotation({ type: 'page_note', body: '# não é um título' })],
      sections: ['notes'],
      promptType: 'raw',
      generatedAt: '2026-07-09T12:00:00.000Z',
    });
    expect(output).toContain('\\# não é um título');
  });

  it('renders all sections together without throwing and includes the footer disclaimer', () => {
    const output = generateAiContext({
      book: makeBook(),
      sessions: [makeSession()],
      annotations: [
        makeAnnotation({ id: 'n1', type: 'page_note', body: 'nota' }),
        makeAnnotation({ id: 'h1', type: 'highlight', quoteText: 'trecho' }),
        makeAnnotation({ id: 'b1', type: 'bookmark' }),
      ],
      review: makeReview({ rating: 4.5, mainTakeaways: ['insight'] }),
      sections: ALL_SECTIONS,
      promptType: 'quiz',
      generatedAt: '2026-07-09T12:00:00.000Z',
    });
    expect(output).toContain('perguntas de revisão');
    expect(output).toContain('100% local');
    expect(output).toContain('2026-07-09');
  });
});
