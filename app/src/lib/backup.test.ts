import { describe, it, expect } from 'vitest';
import { assembleBackup, serializeBackup, backupFilename } from './backup';
import { BACKUP_FORMAT_VERSION } from '../types/backup';
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

describe('assembleBackup', () => {
  it('builds a valid backup structure for an empty library', () => {
    const backup = assembleBackup({
      books: [],
      files: [],
      sessions: [],
      annotations: [],
      reviews: [],
      schemaVersion: 3,
      generatedAt: now,
    });

    expect(backup).toEqual({
      app: 'readquest',
      version: BACKUP_FORMAT_VERSION,
      generatedAt: now,
      schemaVersion: 3,
      books: [],
      files: [],
      sessions: [],
      annotations: [],
      reviews: [],
    });
  });

  it('builds a valid backup structure for a populated library', () => {
    const book = makeBook();
    const session = makeSession();
    const annotation = makeAnnotation();
    const file = { bookId: 'book-1', mimeType: 'application/pdf', size: 4, dataBase64: 'AAAA' };

    const backup = assembleBackup({
      books: [book],
      files: [file],
      sessions: [session],
      annotations: [annotation],
      reviews: [],
      schemaVersion: 3,
      generatedAt: now,
    });

    expect(backup.books).toEqual([book]);
    expect(backup.files).toEqual([file]);
    expect(backup.sessions).toEqual([session]);
    expect(backup.annotations).toEqual([annotation]);
    expect(backup.app).toBe('readquest');
  });

  it('defaults generatedAt to now when omitted', () => {
    const before = Date.now();
    const backup = assembleBackup({
      books: [],
      files: [],
      sessions: [],
      annotations: [],
      reviews: [],
      schemaVersion: 3,
    });
    const after = Date.now();
    const generatedAtMs = new Date(backup.generatedAt).getTime();
    expect(generatedAtMs).toBeGreaterThanOrEqual(before);
    expect(generatedAtMs).toBeLessThanOrEqual(after);
  });
});

describe('serializeBackup', () => {
  it('produces valid, parseable JSON round-tripping to the same structure', () => {
    const backup = assembleBackup({
      books: [makeBook()],
      files: [],
      sessions: [],
      annotations: [],
      reviews: [],
      schemaVersion: 3,
      generatedAt: now,
    });

    const json = serializeBackup(backup);
    expect(JSON.parse(json)).toEqual(backup);
  });
});

describe('backupFilename', () => {
  it('produces a filesystem-safe filename with the timestamp embedded', () => {
    const filename = backupFilename('2026-07-10T12:34:56.789Z');
    expect(filename).toBe('readquest-backup-2026-07-10T12-34-56-789Z.json');
  });
});
