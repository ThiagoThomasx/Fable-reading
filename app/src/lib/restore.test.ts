import { describe, it, expect } from 'vitest';
import { parseBackupJson, validateBackup } from './restore';
import { assembleBackup, serializeBackup } from './backup';
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

function validBackupJson(): string {
  const backup = assembleBackup({
    books: [makeBook()],
    files: [{ bookId: 'book-1', mimeType: 'application/pdf', size: 4, dataBase64: 'AAAA' }],
    sessions: [makeSession()],
    annotations: [makeAnnotation()],
    reviews: [makeReview()],
    schemaVersion: 3,
    generatedAt: now,
  });
  return serializeBackup(backup);
}

describe('parseBackupJson', () => {
  it('parses valid JSON', () => {
    const result = parseBackupJson('{"a": 1}');
    expect(result).toEqual({ ok: true, data: { a: 1 } });
  });

  it('returns an error for malformed JSON without throwing', () => {
    const result = parseBackupJson('{not valid json');
    expect(result.ok).toBe(false);
  });
});

describe('validateBackup', () => {
  it('accepts a well-formed backup with books/files/sessions/annotations', () => {
    const parsed = parseBackupJson(validBackupJson());
    expect(parsed.ok).toBe(true);
    const result = validateBackup((parsed as { ok: true; data: unknown }).data);
    expect(result.valid).toBe(true);
  });

  it('accepts a well-formed empty backup', () => {
    const backup = assembleBackup({
      books: [],
      files: [],
      sessions: [],
      annotations: [],
      reviews: [],
      schemaVersion: 3,
      generatedAt: now,
    });
    const result = validateBackup(backup);
    expect(result.valid).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(validateBackup(null).valid).toBe(false);
    expect(validateBackup('a string').valid).toBe(false);
    expect(validateBackup(42).valid).toBe(false);
    expect(validateBackup([]).valid).toBe(false);
  });

  it('rejects when app !== "readquest"', () => {
    const backup = JSON.parse(validBackupJson());
    backup.app = 'other-app';
    const result = validateBackup(backup);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('app'))).toBe(true);
    }
  });

  it('rejects an unsupported (future) backup version', () => {
    const backup = JSON.parse(validBackupJson());
    backup.version = 999;
    const result = validateBackup(backup);
    expect(result.valid).toBe(false);
  });

  it('rejects when schemaVersion is missing', () => {
    const backup = JSON.parse(validBackupJson());
    delete backup.schemaVersion;
    const result = validateBackup(backup);
    expect(result.valid).toBe(false);
  });

  it('rejects when books is missing', () => {
    const backup = JSON.parse(validBackupJson());
    delete backup.books;
    const result = validateBackup(backup);
    expect(result.valid).toBe(false);
  });

  it('rejects when a book is missing required fields', () => {
    const backup = JSON.parse(validBackupJson());
    backup.books[0].title = undefined;
    delete backup.books[0].title;
    const result = validateBackup(backup);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('books[0].title'))).toBe(true);
    }
  });

  it('rejects when a file has invalid base64', () => {
    const backup = JSON.parse(validBackupJson());
    backup.files[0].dataBase64 = 'not-base64!!!';
    const result = validateBackup(backup);
    expect(result.valid).toBe(false);
  });

  it('accepts a file with empty dataBase64 (zero-byte edge case)', () => {
    const backup = JSON.parse(validBackupJson());
    backup.files[0].dataBase64 = '';
    backup.files[0].size = 0;
    const result = validateBackup(backup);
    expect(result.valid).toBe(true);
  });

  it('rejects when a session has an invalid type for a numeric field', () => {
    const backup = JSON.parse(validBackupJson());
    backup.sessions[0].durationMs = 'not-a-number';
    const result = validateBackup(backup);
    expect(result.valid).toBe(false);
  });

  it('rejects when an annotation is missing bookId', () => {
    const backup = JSON.parse(validBackupJson());
    delete backup.annotations[0].bookId;
    const result = validateBackup(backup);
    expect(result.valid).toBe(false);
  });

  it('rejects when reviews is missing', () => {
    const backup = JSON.parse(validBackupJson());
    delete backup.reviews;
    const result = validateBackup(backup);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('reviews'))).toBe(true);
    }
  });

  it('rejects when a review is missing bookId', () => {
    const backup = JSON.parse(validBackupJson());
    delete backup.reviews[0].bookId;
    const result = validateBackup(backup);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('reviews[0].bookId'))).toBe(true);
    }
  });

  it('rejects when a review has an invalid type for rating', () => {
    const backup = JSON.parse(validBackupJson());
    backup.reviews[0].rating = 'five stars';
    const result = validateBackup(backup);
    expect(result.valid).toBe(false);
  });

  it('accepts a review with no optional fields at all', () => {
    const backup = assembleBackup({
      books: [makeBook()],
      files: [],
      sessions: [],
      annotations: [],
      reviews: [makeReview()],
      schemaVersion: 3,
      generatedAt: now,
    });
    const result = validateBackup(JSON.parse(serializeBackup(backup)));
    expect(result.valid).toBe(true);
  });

  it('does not throw or crash on deeply malformed input', () => {
    expect(() => validateBackup({ app: 'readquest', books: 'not-an-array' })).not.toThrow();
  });
});
