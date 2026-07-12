import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests, getDb } from '../db/db';
import { createBook } from '../db/books-repo';
import { saveFile } from '../db/files-repo';
import { createSession } from '../db/sessions-repo';
import { createAnnotation } from '../db/notes-repo';
import { upsertReview } from '../db/reviews-repo';
import { repairLibrary } from './repair';
import { loadLibrarySnapshot } from './integrity-io';
import { validateLibraryIntegrity } from './data-integrity';
import type { Book, ReadingAnnotation, ReadingSession, BookReview } from '../types/models';

const now = '2026-07-10T12:00:00.000Z';

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

function makeReview(overrides: Partial<BookReview> = {}): BookReview {
  return {
    bookId: 'book-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
});

describe('repairLibrary', () => {
  it('removes an orphan file (Blob with no matching book)', async () => {
    await saveFile('ghost-file', new Blob(['x']));
    const snapshot = await loadLibrarySnapshot();

    const summary = await repairLibrary(snapshot);

    expect(summary.removedOrphanFiles).toBe(1);
    const db = await getDb();
    expect(await db.get('files', 'ghost-file')).toBeUndefined();
  });

  it('removes orphan sessions and annotations (bookId with no matching book)', async () => {
    await createSession(makeSession({ id: 's-orphan', bookId: 'ghost' }));
    await createAnnotation(makeAnnotation({ id: 'n-orphan', bookId: 'ghost' }));
    const snapshot = await loadLibrarySnapshot();

    const summary = await repairLibrary(snapshot);

    expect(summary.removedOrphanSessions).toBe(1);
    expect(summary.removedOrphanAnnotations).toBe(1);
    const db = await getDb();
    expect(await db.get('sessions', 's-orphan')).toBeUndefined();
    expect(await db.get('notes', 'n-orphan')).toBeUndefined();
  });

  it('clamps a book currentPage that is beyond totalPages', async () => {
    const book = makeBook({ currentPage: 9999, totalPages: 100 });
    await createBook(book);
    const snapshot = await loadLibrarySnapshot();

    const summary = await repairLibrary(snapshot);

    expect(summary.fixedBooksCurrentPage).toBe(1);
    const db = await getDb();
    const updated = await db.get('books', book.id);
    expect(updated?.currentPage).toBe(100);
  });

  it('clamps a book currentPage that is below 1', async () => {
    const book = makeBook({ currentPage: 0, totalPages: 100 });
    await createBook(book);
    const snapshot = await loadLibrarySnapshot();

    await repairLibrary(snapshot);

    const db = await getDb();
    const updated = await db.get('books', book.id);
    expect(updated?.currentPage).toBe(1);
  });

  it('removes duplicate bookmarks, keeping the oldest one', async () => {
    const book = makeBook();
    await createBook(book);
    await createAnnotation(
      makeAnnotation({
        id: 'bm-old',
        type: 'bookmark',
        body: undefined,
        page: 3,
        createdAt: '2026-07-01T00:00:00.000Z',
      }),
    );
    await createAnnotation(
      makeAnnotation({
        id: 'bm-new',
        type: 'bookmark',
        body: undefined,
        page: 3,
        createdAt: '2026-07-02T00:00:00.000Z',
      }),
    );
    const snapshot = await loadLibrarySnapshot();

    const summary = await repairLibrary(snapshot);

    expect(summary.removedDuplicateBookmarks).toBe(1);
    const db = await getDb();
    expect(await db.get('notes', 'bm-old')).toBeDefined();
    expect(await db.get('notes', 'bm-new')).toBeUndefined();
  });

  it('does not touch valid data', async () => {
    const book = makeBook();
    await createBook(book);
    await saveFile(book.fileRef, new Blob(['pdf']));
    await createSession(makeSession());
    await createAnnotation(makeAnnotation());
    const snapshot = await loadLibrarySnapshot();

    const summary = await repairLibrary(snapshot);

    expect(summary).toEqual({
      removedOrphanFiles: 0,
      removedOrphanSessions: 0,
      removedOrphanAnnotations: 0,
      fixedBooksCurrentPage: 0,
      removedDuplicateBookmarks: 0,
      removedOrphanReviews: 0,
      cleanedReviewFavorites: 0,
    });
  });

  it('removes an orphan review (bookId with no matching book)', async () => {
    await upsertReview(makeReview({ bookId: 'ghost' }));
    const snapshot = await loadLibrarySnapshot();

    const summary = await repairLibrary(snapshot);

    expect(summary.removedOrphanReviews).toBe(1);
    const db = await getDb();
    expect(await db.get('reviews', 'ghost')).toBeUndefined();
  });

  it('cleans favoriteAnnotationIds that reference a deleted annotation, without touching the rest', async () => {
    const book = makeBook();
    await createBook(book);
    const annotation = makeAnnotation({ id: 'kept-highlight', type: 'highlight', quoteText: 'trecho' });
    await createAnnotation(annotation);
    await upsertReview(
      makeReview({ bookId: book.id, favoriteAnnotationIds: ['kept-highlight', 'deleted-highlight'] }),
    );
    const snapshot = await loadLibrarySnapshot();

    const summary = await repairLibrary(snapshot);

    expect(summary.cleanedReviewFavorites).toBe(1);
    expect(summary.removedOrphanReviews).toBe(0);
    const db = await getDb();
    const updated = await db.get('reviews', book.id);
    expect(updated?.favoriteAnnotationIds).toEqual(['kept-highlight']);
  });

  it('produces a clean (ok=true, no issues) integrity report after repairing a messy library', async () => {
    // Arrange — mistura de problemas detectáveis e reparáveis
    const book = makeBook({ currentPage: 9999 });
    await createBook(book);
    await saveFile(book.fileRef, new Blob(['pdf']));
    await saveFile('ghost-file', new Blob(['x']));
    await createSession(makeSession({ id: 's-orphan', bookId: 'ghost' }));
    await createAnnotation(makeAnnotation({ id: 'n-orphan', bookId: 'ghost' }));
    await createAnnotation(
      makeAnnotation({ id: 'bm-a', type: 'bookmark', body: undefined, page: 1, createdAt: '2026-01-01T00:00:00.000Z' }),
    );
    await createAnnotation(
      makeAnnotation({ id: 'bm-b', type: 'bookmark', body: undefined, page: 1, createdAt: '2026-01-02T00:00:00.000Z' }),
    );

    // Act
    await repairLibrary(await loadLibrarySnapshot());
    const report = validateLibraryIntegrity(await loadLibrarySnapshot());

    // Assert
    expect(report).toEqual({ ok: true, issues: [] });
  });
});
