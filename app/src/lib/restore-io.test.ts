import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests, getDb } from '../db/db';
import { createBook } from '../db/books-repo';
import { saveFile } from '../db/files-repo';
import { createSession } from '../db/sessions-repo';
import { createAnnotation } from '../db/notes-repo';
import { upsertReview } from '../db/reviews-repo';
import { restoreFullBackup } from './restore-io';
import { assembleBackup } from './backup';
import { blobToBase64 } from './base64';
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

describe('restoreFullBackup', () => {
  it('populates an empty database from a backup', async () => {
    const pdfBytes = new Uint8Array([9, 8, 7, 6]);
    const backup = assembleBackup({
      books: [makeBook()],
      files: [
        {
          bookId: 'book-1',
          mimeType: 'application/pdf',
          size: pdfBytes.length,
          dataBase64: await blobToBase64(new Blob([pdfBytes])),
        },
      ],
      sessions: [makeSession()],
      annotations: [makeAnnotation()],
      reviews: [makeReview()],
      schemaVersion: 3,
      generatedAt: now,
    });

    await restoreFullBackup(backup);

    const db = await getDb();
    expect(await db.getAll('books')).toEqual([makeBook()]);
    expect(await db.getAll('sessions')).toEqual([makeSession()]);
    expect(await db.getAll('notes')).toEqual([makeAnnotation()]);
    expect(await db.getAll('reviews')).toEqual([makeReview()]);
    const restoredBlob = await db.get('files', 'book-1');
    expect(restoredBlob).toBeDefined();
    const restoredBytes = new Uint8Array(await restoredBlob!.arrayBuffer());
    expect(Array.from(restoredBytes)).toEqual(Array.from(pdfBytes));
  });

  it('replaces existing data entirely — old data not present in the backup is gone', async () => {
    // Arrange — dados atuais que NÃO estão no backup
    await createBook(makeBook({ id: 'old-book', fileRef: 'old-book', title: 'Livro antigo' }));
    await saveFile('old-book', new Blob(['old']));
    await createSession(makeSession({ id: 'old-session', bookId: 'old-book' }));
    await createAnnotation(makeAnnotation({ id: 'old-note', bookId: 'old-book' }));
    await upsertReview(makeReview({ bookId: 'old-book' }));

    const backup = assembleBackup({
      books: [makeBook({ id: 'new-book', fileRef: 'new-book' })],
      files: [],
      sessions: [],
      annotations: [],
      reviews: [],
      schemaVersion: 3,
      generatedAt: now,
    });

    // Act
    await restoreFullBackup(backup);

    // Assert
    const db = await getDb();
    const books = await db.getAll('books');
    expect(books.map((b) => b.id)).toEqual(['new-book']);
    expect(await db.get('files', 'old-book')).toBeUndefined();
    expect(await db.getAll('sessions')).toHaveLength(0);
    expect(await db.getAll('notes')).toHaveLength(0);
    expect(await db.getAll('reviews')).toHaveLength(0);
  });

  it('restores an empty backup by clearing all stores', async () => {
    await createBook(makeBook());
    await createSession(makeSession());
    await createAnnotation(makeAnnotation());
    await upsertReview(makeReview());

    const emptyBackup = assembleBackup({
      books: [],
      files: [],
      sessions: [],
      annotations: [],
      reviews: [],
      schemaVersion: 3,
      generatedAt: now,
    });

    await restoreFullBackup(emptyBackup);

    const db = await getDb();
    expect(await db.getAll('books')).toHaveLength(0);
    expect(await db.getAll('sessions')).toHaveLength(0);
    expect(await db.getAll('notes')).toHaveLength(0);
    expect(await db.getAll('reviews')).toHaveLength(0);
  });
});
