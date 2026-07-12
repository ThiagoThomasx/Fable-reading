import { describe, it, expect } from 'vitest';
import {
  generateBookMarkdownExport,
  sanitizeMarkdownFilename,
  formatMarkdownDate,
  formatMarkdownDuration,
  groupAnnotationsByPage,
  sortAnnotationsForExport,
  sortSessionsForExport,
} from './export-markdown';
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

describe('sanitizeMarkdownFilename', () => {
  it('slugifies a normal title', () => {
    expect(sanitizeMarkdownFilename('O Nome do Vento')).toBe('readquest-o-nome-do-vento.md');
  });

  it('strips diacritics and invalid filename characters', () => {
    expect(sanitizeMarkdownFilename('Á/B\\C: "Título"?*<>|')).toBe('readquest-a-b-c-titulo.md');
  });

  it('falls back to readquest-export.md when nothing usable remains', () => {
    expect(sanitizeMarkdownFilename('???')).toBe('readquest-export.md');
    expect(sanitizeMarkdownFilename('')).toBe('readquest-export.md');
  });
});

describe('formatMarkdownDate', () => {
  it('returns Nunca for undefined or invalid input', () => {
    expect(formatMarkdownDate(undefined)).toBe('Nunca');
    expect(formatMarkdownDate('not-a-date')).toBe('Nunca');
  });

  it('formats a valid ISO date as YYYY-MM-DD', () => {
    expect(formatMarkdownDate('2026-07-09T12:00:00.000Z')).toBe('2026-07-09');
  });
});

describe('formatMarkdownDuration', () => {
  it('mirrors dashboard-stats formatDuration output', () => {
    expect(formatMarkdownDuration(20 * 60_000)).toBe('20min');
    expect(formatMarkdownDuration(3_600_000 + 5 * 60_000)).toBe('1h 5min');
  });
});

describe('sortAnnotationsForExport', () => {
  it('sorts by page ascending, then createdAt ascending within the same page', () => {
    const annotations = [
      makeAnnotation({ id: 'b', page: 48 }),
      makeAnnotation({ id: 'a', page: 12, createdAt: '2026-07-09T10:00:00.000Z' }),
      makeAnnotation({ id: 'c', page: 12, createdAt: '2026-07-09T09:00:00.000Z' }),
    ];
    const sorted = sortAnnotationsForExport(annotations);
    expect(sorted.map((a) => a.id)).toEqual(['c', 'a', 'b']);
  });

  it('does not mutate the input array', () => {
    const annotations = [makeAnnotation({ id: 'b', page: 2 }), makeAnnotation({ id: 'a', page: 1 })];
    const original = [...annotations];
    sortAnnotationsForExport(annotations);
    expect(annotations).toEqual(original);
  });
});

describe('groupAnnotationsByPage', () => {
  it('groups multiple annotations on the same page together', () => {
    const annotations = [
      makeAnnotation({ id: 'a', page: 12, type: 'page_note' }),
      makeAnnotation({ id: 'b', page: 12, type: 'bookmark' }),
      makeAnnotation({ id: 'c', page: 48, type: 'page_note' }),
    ];
    const grouped = groupAnnotationsByPage(annotations);
    expect([...grouped.keys()]).toEqual([12, 48]);
    expect(grouped.get(12)?.map((a) => a.id)).toEqual(['a', 'b']);
    expect(grouped.get(48)?.map((a) => a.id)).toEqual(['c']);
  });

  it('returns an empty map for no annotations', () => {
    expect(groupAnnotationsByPage([]).size).toBe(0);
  });
});

describe('sortSessionsForExport', () => {
  it('sorts sessions ascending by startedAt', () => {
    const sessions = [
      makeSession({ id: 'newest', startedAt: '2026-07-09T10:00:00.000Z' }),
      makeSession({ id: 'oldest', startedAt: '2026-07-01T10:00:00.000Z' }),
    ];
    expect(sortSessionsForExport(sessions).map((s) => s.id)).toEqual(['oldest', 'newest']);
  });
});

describe('generateBookMarkdownExport', () => {
  it('produces a readable export for a book with no notes and no sessions', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [],
      generatedAt: '2026-07-09T12:00:00.000Z',
    });

    expect(md).toContain('# O Nome do Vento');
    expect(md).toContain('> Exportado do ReadQuest em 2026-07-09');
    expect(md).toContain('Nenhuma nota registrada.');
    expect(md).toContain('Nenhuma sessão registrada.');
    expect(md).toContain('- Tempo total lido: <1 min');
    expect(md).toContain('- Sessões registradas: 0');
    expect(md).toContain('- Book ID: book-1');
  });

  it('includes a single note under its page heading', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [makeAnnotation({ page: 12, type: 'page_note', body: 'Ótima virada de capítulo.' })],
    });

    expect(md).toContain('### Página 12');
    expect(md).toContain('#### Nota');
    expect(md).toContain('Ótima virada de capítulo.');
  });

  it('groups multiple notes on different pages under separate headings', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [
        makeAnnotation({ id: 'a', page: 12, body: 'Nota da página 12' }),
        makeAnnotation({ id: 'b', page: 48, body: 'Nota da página 48' }),
      ],
    });

    const page12Index = md.indexOf('### Página 12');
    const page48Index = md.indexOf('### Página 48');
    expect(page12Index).toBeGreaterThan(-1);
    expect(page48Index).toBeGreaterThan(page12Index);
  });

  it('renders a bookmark with no body as a clean line', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [makeAnnotation({ page: 30, type: 'bookmark', body: undefined })],
    });

    expect(md).toContain('#### Bookmark');
    expect(md).toContain('Página marcada como importante.');
  });

  it('renders a note and a bookmark on the same page together', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [
        makeAnnotation({ id: 'a', page: 20, type: 'page_note', body: 'Reflexão' }),
        makeAnnotation({ id: 'b', page: 20, type: 'bookmark' }),
      ],
    });

    const pageHeadingCount = md.split('### Página 20').length - 1;
    expect(pageHeadingCount).toBe(1);
    expect(md).toContain('#### Nota');
    expect(md).toContain('#### Bookmark');
  });

  it('includes a single highlight as a blockquote with its color', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [
        makeAnnotation({
          page: 42,
          type: 'highlight',
          color: 'green',
          quoteText: 'Texto destacado aqui.',
          textAnchor: { page: 42, text: 'Texto destacado aqui.', rects: [{ x: 0, y: 0, width: 0.5, height: 0.05 }] },
        }),
      ],
    });

    expect(md).toContain('### Página 42');
    expect(md).toContain('#### Highlight');
    expect(md).toContain('> Texto destacado aqui.');
    expect(md).toContain('Cor: green');
  });

  it('defaults highlight color to yellow when not set', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [makeAnnotation({ page: 10, type: 'highlight', quoteText: 'Sem cor definida' })],
    });

    expect(md).toContain('Cor: yellow');
  });

  it('preserves multi-line quote text as a multi-line blockquote', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [
        makeAnnotation({
          page: 7,
          type: 'highlight',
          quoteText: 'Primeira linha\nSegunda linha',
        }),
      ],
    });

    expect(md).toContain('> Primeira linha\n> Segunda linha');
  });

  it('escapes markdown-significant characters inside a highlight quote', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [makeAnnotation({ page: 7, type: 'highlight', quoteText: '# Não é título' })],
    });

    expect(md).toContain('> \\# Não é título');
  });

  it('renders a highlight, a note, and a bookmark on the same page together', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [
        makeAnnotation({ id: 'a', page: 55, type: 'page_note', body: 'Nota' }),
        makeAnnotation({ id: 'b', page: 55, type: 'bookmark' }),
        makeAnnotation({ id: 'c', page: 55, type: 'highlight', quoteText: 'Trecho' }),
      ],
    });

    const pageHeadingCount = md.split('### Página 55').length - 1;
    expect(pageHeadingCount).toBe(1);
    expect(md).toContain('#### Nota');
    expect(md).toContain('#### Bookmark');
    expect(md).toContain('#### Highlight');
  });

  it('does not break the export when there are no highlights at all', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [makeAnnotation({ page: 1, type: 'page_note', body: 'Só uma nota' })],
    });

    expect(md).not.toContain('#### Highlight');
  });

  it('includes multiple sessions grouped chronologically', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [
        makeSession({ id: 'a', startedAt: '2026-07-01T10:00:00.000Z', durationMs: 10 * 60_000 }),
        makeSession({ id: 'b', startedAt: '2026-07-05T10:00:00.000Z', durationMs: 20 * 60_000 }),
      ],
      annotations: [],
    });

    const firstIndex = md.indexOf('### 2026-07-01');
    const secondIndex = md.indexOf('### 2026-07-05');
    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(firstIndex);
    expect(md).toContain('- Sessões registradas: 2');
  });

  it('includes a session manual note when present', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [makeSession({ notes: 'Li no ônibus, meio distraído.' })],
      annotations: [],
    });

    expect(md).toContain('- Nota da sessão: Li no ônibus, meio distraído.');
  });

  it('handles a book with missing author and category', () => {
    const md = generateBookMarkdownExport({
      book: makeBook({ author: undefined, category: '' }),
      sessions: [],
      annotations: [],
    });

    expect(md).toContain('- Autor: Não informado');
    expect(md).toContain('- Categoria: Não informado');
  });

  it('escapes markdown-significant characters at the start of note lines without breaking layout', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [
        makeAnnotation({
          page: 5,
          type: 'page_note',
          body: '# Não é um título\n> Nem uma citação\n- Nem uma lista',
        }),
      ],
    });

    expect(md).toContain('\\# Não é um título');
    expect(md).toContain('\\> Nem uma citação');
    expect(md).toContain('\\- Nem uma lista');
    // Line breaks from the original note body are preserved.
    expect(md).toContain('\\# Não é um título\n\\> Nem uma citação\n\\- Nem uma lista');
  });

  it('computes progress and current page from book fields', () => {
    const md = generateBookMarkdownExport({
      book: makeBook({ currentPage: 89, totalPages: 212 }),
      sessions: [],
      annotations: [],
    });

    expect(md).toContain('- Página atual: 89 de 212');
    expect(md).toMatch(/- Progresso: \d+%/);
  });

  it('is defensive with an empty tags array and no optional fields at all', () => {
    const minimalBook = makeBook({
      author: undefined,
      coverUrl: undefined,
      lastPageSnapshot: undefined,
      readingTheme: undefined,
      startedAt: undefined,
      completedAt: undefined,
      lastOpenedAt: undefined,
    });

    expect(() =>
      generateBookMarkdownExport({ book: minimalBook, sessions: [], annotations: [] }),
    ).not.toThrow();
  });

  it('omits the Review section entirely when the book has no review', () => {
    const md = generateBookMarkdownExport({ book: makeBook(), sessions: [], annotations: [] });

    expect(md).not.toContain('## Review');
  });

  it('includes rating, finished date, title, body and takeaways when a review exists', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [],
      review: makeReview({
        rating: 4.5,
        title: 'Uma leitura e tanto',
        body: 'Gostei muito da construção do mundo.',
        mainTakeaways: ['Personagens bem construídos', 'Ritmo lento no meio'],
        finishedAt: '2026-07-09T12:00:00.000Z',
      }),
    });

    expect(md).toContain('## Review');
    expect(md).toContain('- Nota: 4.5 / 5');
    expect(md).toContain('- Finalizado em: 2026-07-09');
    expect(md).toContain('### Uma leitura e tanto');
    expect(md).toContain('Gostei muito da construção do mundo.');
    expect(md).toContain('### Principais ideias');
    expect(md).toContain('- Personagens bem construídos');
    expect(md).toContain('- Ritmo lento no meio');
  });

  it('renders a review with no rating and no takeaways without breaking', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [],
      review: makeReview({ body: 'Só um comentário rápido.' }),
    });

    expect(md).toContain('## Review');
    expect(md).not.toContain('- Nota:');
    expect(md).not.toContain('### Principais ideias');
    expect(md).toContain('Só um comentário rápido.');
  });

  it('resolves favorite highlight IDs from the review into their own section', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [
        makeAnnotation({ id: 'h1', page: 42, type: 'highlight', quoteText: 'Trecho favorito' }),
        makeAnnotation({ id: 'h2', page: 10, type: 'highlight', quoteText: 'Não favorito' }),
      ],
      review: makeReview({ favoriteAnnotationIds: ['h1'] }),
    });

    const reviewIndex = md.indexOf('## Review');
    const favoritesIndex = md.indexOf('### Highlights favoritos');
    const notesIndex = md.indexOf('## Notas e marcações');
    expect(favoritesIndex).toBeGreaterThan(reviewIndex);
    expect(notesIndex).toBeGreaterThan(favoritesIndex);

    // A seção de favoritos do Review deve trazer só o highlight marcado — o
    // outro highlight ainda aparece normalmente em "Notas e marcações" abaixo.
    const reviewSection = md.slice(reviewIndex, notesIndex);
    expect(reviewSection).toContain('#### Página 42');
    expect(reviewSection).toContain('> Trecho favorito');
    expect(reviewSection).not.toContain('Não favorito');
    expect(md).toContain('Não favorito');
  });

  it('does not break when a favorite annotation ID no longer exists', () => {
    const md = generateBookMarkdownExport({
      book: makeBook(),
      sessions: [],
      annotations: [],
      review: makeReview({ favoriteAnnotationIds: ['deleted-highlight'] }),
    });

    expect(md).toContain('## Review');
    expect(md).not.toContain('### Highlights favoritos');
  });
});
