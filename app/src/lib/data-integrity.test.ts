import { describe, it, expect } from 'vitest';
import {
  validateLibraryIntegrity,
  findBooksMissingFile,
  findOrphanFiles,
  findOrphanSessions,
  findOrphanAnnotations,
  findInvalidSessions,
  findInvalidAnnotations,
  findInvalidBooks,
  findDuplicateBookmarks,
  findOrphanReviews,
  findReviewsWithMissingFavorites,
} from './data-integrity';
import type { Book, ReadingAnnotation, ReadingSession, BookReview } from '../types/models';

const now = '2026-07-09T12:00:00.000Z';

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    title: 'A Metamorfose',
    totalPages: 100,
    currentPage: 1,
    status: 'want_to_read',
    category: 'Ficção',
    tags: [],
    coverSource: 'extracted',
    fileRef: 'book-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeSession(overrides: Partial<ReadingSession> = {}): ReadingSession {
  return {
    id: 'session-1',
    bookId: 'book-1',
    startedAt: now,
    endedAt: now,
    durationMs: 1000,
    startPage: 1,
    endPage: 10,
    pagesRead: 9,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeReview(overrides: Partial<BookReview> = {}): BookReview {
  return {
    bookId: 'book-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeAnnotation(overrides: Partial<ReadingAnnotation> = {}): ReadingAnnotation {
  return {
    id: 'note-1',
    bookId: 'book-1',
    page: 5,
    type: 'page_note',
    body: 'Nota',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('findBooksMissingFile', () => {
  it('returns empty when every book has a matching file', () => {
    expect(findBooksMissingFile([makeBook()], ['book-1'])).toHaveLength(0);
  });

  it('flags books whose fileRef has no Blob', () => {
    const result = findBooksMissingFile([makeBook()], []);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('book-1');
  });
});

describe('findOrphanFiles', () => {
  it('returns empty when every file is referenced', () => {
    expect(findOrphanFiles([makeBook()], ['book-1'])).toHaveLength(0);
  });

  it('flags files with no referencing book', () => {
    expect(findOrphanFiles([makeBook()], ['book-1', 'ghost'])).toEqual(['ghost']);
  });
});

describe('findOrphanSessions / findOrphanAnnotations', () => {
  it('returns empty when all sessions/annotations belong to an existing book', () => {
    expect(findOrphanSessions([makeSession()], [makeBook()])).toHaveLength(0);
    expect(findOrphanAnnotations([makeAnnotation()], [makeBook()])).toHaveLength(0);
  });

  it('flags sessions/annotations whose book no longer exists', () => {
    const session = makeSession({ bookId: 'ghost' });
    const annotation = makeAnnotation({ bookId: 'ghost' });
    expect(findOrphanSessions([session], [makeBook()])).toEqual([session]);
    expect(findOrphanAnnotations([annotation], [makeBook()])).toEqual([annotation]);
  });
});

describe('findInvalidSessions', () => {
  it('accepts sessions within the book page range', () => {
    expect(findInvalidSessions([makeSession()], [makeBook()])).toHaveLength(0);
  });

  it('flags a session with endPage beyond totalPages', () => {
    const session = makeSession({ endPage: 999 });
    expect(findInvalidSessions([session], [makeBook()])).toEqual([session]);
  });

  it('flags a session with endPage before startPage', () => {
    const session = makeSession({ startPage: 50, endPage: 10 });
    expect(findInvalidSessions([session], [makeBook()])).toEqual([session]);
  });

  it('ignores orphan sessions (no book to validate against)', () => {
    const session = makeSession({ bookId: 'ghost', endPage: 999 });
    expect(findInvalidSessions([session], [makeBook()])).toHaveLength(0);
  });
});

describe('findInvalidAnnotations', () => {
  it('accepts a page_note within range', () => {
    expect(findInvalidAnnotations([makeAnnotation()], [makeBook()])).toHaveLength(0);
  });

  it('flags an annotation with page beyond totalPages', () => {
    const annotation = makeAnnotation({ page: 999 });
    expect(findInvalidAnnotations([annotation], [makeBook()])).toEqual([annotation]);
  });

  it('flags a highlight missing quoteText', () => {
    const highlight = makeAnnotation({ type: 'highlight', body: undefined, quoteText: undefined });
    expect(findInvalidAnnotations([highlight], [makeBook()])).toEqual([highlight]);
  });

  it('flags a highlight missing textAnchor.rects', () => {
    const highlight = makeAnnotation({
      type: 'highlight',
      body: undefined,
      quoteText: 'Trecho',
      textAnchor: { page: 5, rects: [] },
    });
    expect(findInvalidAnnotations([highlight], [makeBook()])).toEqual([highlight]);
  });

  it('accepts a complete highlight', () => {
    const highlight = makeAnnotation({
      type: 'highlight',
      body: undefined,
      quoteText: 'Trecho',
      textAnchor: { page: 5, rects: [{ x: 0, y: 0, width: 0.1, height: 0.1 }] },
    });
    expect(findInvalidAnnotations([highlight], [makeBook()])).toHaveLength(0);
  });
});

describe('findInvalidBooks', () => {
  it('accepts currentPage within range', () => {
    expect(findInvalidBooks([makeBook({ currentPage: 50 })])).toHaveLength(0);
  });

  it('flags currentPage beyond totalPages', () => {
    const book = makeBook({ currentPage: 999 });
    expect(findInvalidBooks([book])).toEqual([book]);
  });

  it('flags currentPage below 1', () => {
    const book = makeBook({ currentPage: 0 });
    expect(findInvalidBooks([book])).toEqual([book]);
  });
});

describe('findDuplicateBookmarks', () => {
  it('returns empty when there is at most one bookmark per page', () => {
    const bookmarks = [
      makeAnnotation({ id: 'a', type: 'bookmark', body: undefined, page: 1 }),
      makeAnnotation({ id: 'b', type: 'bookmark', body: undefined, page: 2 }),
    ];
    expect(findDuplicateBookmarks(bookmarks)).toHaveLength(0);
  });

  it('flags every bookmark past the first (oldest) one on the same page', () => {
    const first = makeAnnotation({
      id: 'a',
      type: 'bookmark',
      body: undefined,
      page: 1,
      createdAt: '2026-07-01T00:00:00.000Z',
    });
    const second = makeAnnotation({
      id: 'b',
      type: 'bookmark',
      body: undefined,
      page: 1,
      createdAt: '2026-07-02T00:00:00.000Z',
    });
    const result = findDuplicateBookmarks([first, second]);
    expect(result.map((b) => b.id)).toEqual(['b']);
  });

  it('does not flag non-bookmark annotations on the same page', () => {
    const note = makeAnnotation({ id: 'a', type: 'page_note', page: 1 });
    const highlight = makeAnnotation({ id: 'b', type: 'highlight', body: undefined, page: 1 });
    expect(findDuplicateBookmarks([note, highlight])).toHaveLength(0);
  });
});

describe('findOrphanReviews', () => {
  it('flags a review whose bookId has no matching book', () => {
    const review = makeReview({ bookId: 'ghost' });
    expect(findOrphanReviews([review], [makeBook()])).toEqual([review]);
  });

  it('does not flag a review whose book still exists', () => {
    const review = makeReview({ bookId: 'book-1' });
    expect(findOrphanReviews([review], [makeBook()])).toHaveLength(0);
  });
});

describe('findReviewsWithMissingFavorites', () => {
  it('flags a review referencing a favoriteAnnotationId that does not exist', () => {
    const review = makeReview({ favoriteAnnotationIds: ['missing-highlight'] });
    expect(findReviewsWithMissingFavorites([review], [])).toEqual([review]);
  });

  it('does not flag a review whose favorites all exist', () => {
    const annotation = makeAnnotation({ id: 'kept-highlight' });
    const review = makeReview({ favoriteAnnotationIds: ['kept-highlight'] });
    expect(findReviewsWithMissingFavorites([review], [annotation])).toHaveLength(0);
  });

  it('does not flag a review with no favorites at all', () => {
    const review = makeReview();
    expect(findReviewsWithMissingFavorites([review], [])).toHaveLength(0);
  });
});

describe('validateLibraryIntegrity', () => {
  it('reports ok with no issues for a clean, empty library', () => {
    const report = validateLibraryIntegrity({
      books: [],
      fileIds: [],
      sessions: [],
      annotations: [],
      reviews: [],
    });
    expect(report).toEqual({ ok: true, issues: [] });
  });

  it('reports ok with no issues for a clean, populated library', () => {
    const report = validateLibraryIntegrity({
      books: [makeBook()],
      fileIds: ['book-1'],
      sessions: [makeSession()],
      annotations: [makeAnnotation()],
      reviews: [],
    });
    expect(report.ok).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it('aggregates every issue type and marks ok=false when any error is present', () => {
    const book = makeBook();
    const orphanSession = makeSession({ id: 'orphan-session', bookId: 'ghost' });
    const invalidAnnotation = makeAnnotation({ id: 'bad-page', page: 999 });

    const report = validateLibraryIntegrity({
      books: [book],
      fileIds: [], // book missing file
      sessions: [orphanSession],
      annotations: [invalidAnnotation],
      reviews: [],
    });

    expect(report.ok).toBe(false);
    const codes = report.issues.map((issue) => issue.code).sort();
    expect(codes).toEqual(['book-missing-file', 'invalid-annotation', 'orphan-session']);
  });

  it('is ok=true (warnings only) when the only issues are orphans/duplicates, no errors', () => {
    const book = makeBook();
    const orphanFile = 'ghost-file';
    const report = validateLibraryIntegrity({
      books: [book],
      fileIds: ['book-1', orphanFile],
      sessions: [],
      annotations: [],
      reviews: [],
    });
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([
      {
        severity: 'warning',
        code: 'orphan-file',
        message: expect.stringContaining(orphanFile),
        entityType: 'file',
        entityId: orphanFile,
      },
    ]);
  });

  it('flags an orphan review and a review with a missing favorite as warnings', () => {
    const book = makeBook();
    const orphanReview = makeReview({ bookId: 'ghost' });
    const reviewWithMissingFavorite = makeReview({
      bookId: 'book-1',
      favoriteAnnotationIds: ['missing-highlight'],
    });

    const report = validateLibraryIntegrity({
      books: [book],
      fileIds: ['book-1'],
      sessions: [],
      annotations: [],
      reviews: [orphanReview, reviewWithMissingFavorite],
    });

    expect(report.ok).toBe(true);
    const codes = report.issues.map((issue) => issue.code).sort();
    expect(codes).toEqual(['orphan-review', 'review-missing-favorite']);
  });
});
