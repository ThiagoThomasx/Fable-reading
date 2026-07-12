import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests, DB_VERSION } from '../db/db';
import { createBook } from '../db/books-repo';
import { saveFile } from '../db/files-repo';
import { createSession } from '../db/sessions-repo';
import { createAnnotation } from '../db/notes-repo';
import { upsertReview } from '../db/reviews-repo';
import { createFullBackup } from './backup-io';
import { base64ToBlob } from './base64';
import type { Book, ReadingAnnotation, ReadingSession } from '../types/models';

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

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
});

describe('createFullBackup', () => {
  it('produces an empty-but-valid backup for an empty library', async () => {
    const backup = await createFullBackup(now);

    expect(backup).toEqual({
      app: 'readquest',
      version: 1,
      generatedAt: now,
      schemaVersion: DB_VERSION,
      books: [],
      files: [],
      sessions: [],
      annotations: [],
      reviews: [],
    });
  });

  it('includes books, the PDF blob as base64, sessions and annotations', async () => {
    const book = makeBook();
    const pdfBytes = new Uint8Array([1, 2, 3, 4, 5]);
    await createBook(book);
    await saveFile(book.fileRef, new Blob([pdfBytes], { type: 'application/pdf' }));
    await createSession(makeSession());
    await createAnnotation(makeAnnotation());
    await upsertReview({ bookId: book.id, rating: 4, createdAt: now, updatedAt: now });

    const backup = await createFullBackup(now);

    expect(backup.books).toEqual([book]);
    expect(backup.sessions).toHaveLength(1);
    expect(backup.annotations).toHaveLength(1);
    expect(backup.files).toHaveLength(1);
    expect(backup.reviews).toHaveLength(1);
    expect(backup.reviews[0]?.rating).toBe(4);

    const fileEntry = backup.files[0];
    expect(fileEntry?.bookId).toBe(book.fileRef);
    expect(fileEntry?.mimeType).toBe('application/pdf');
    expect(fileEntry?.size).toBe(pdfBytes.length);

    const restoredBlob = base64ToBlob(fileEntry!.dataBase64, fileEntry!.mimeType);
    const restoredBytes = new Uint8Array(await restoredBlob.arrayBuffer());
    expect(Array.from(restoredBytes)).toEqual(Array.from(pdfBytes));
  });

  it('includes orphan files/sessions/annotations too — backup must not lose data', async () => {
    // Arrange: sem nenhum livro cadastrado, mas com um Blob e registros órfãos
    await saveFile('orphan-file', new Blob([new Uint8Array([9])]));
    await createSession(makeSession({ bookId: 'ghost' }));
    await createAnnotation(makeAnnotation({ bookId: 'ghost' }));

    // Act
    const backup = await createFullBackup(now);

    // Assert
    expect(backup.files).toHaveLength(1);
    expect(backup.sessions).toHaveLength(1);
    expect(backup.annotations).toHaveLength(1);
  });
});
