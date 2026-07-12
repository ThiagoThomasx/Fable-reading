import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests, getDb } from '../db/db';
import { createBook } from '../db/books-repo';
import { saveFile } from '../db/files-repo';
import { createSession } from '../db/sessions-repo';
import { createAnnotation } from '../db/notes-repo';
import { upsertReview } from '../db/reviews-repo';
import { useBookStore } from './useBookStore';
import { useSessionStore } from './useSessionStore';
import { useNoteStore } from './useNoteStore';
import { useReviewStore } from './useReviewStore';
import type { Book, ReadingAnnotation, ReadingSession, BookReview } from '../types/models';

const now = '2026-07-09T12:00:00.000Z';

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    title: 'A Metamorfose',
    totalPages: 212,
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
  return {
    id: 'note-1',
    bookId: 'book-1',
    page: 12,
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
  useBookStore.setState({ books: [], isLoaded: false, error: null });
  useSessionStore.setState({
    sessions: [],
    loadedBookId: null,
    error: null,
    allSessions: [],
    isAllLoaded: false,
    allError: null,
  });
  useNoteStore.setState({ annotations: [], loadedBookId: null, error: null });
  useReviewStore.setState({ review: null, loadedBookId: null, error: null, allReviews: [], isAllLoaded: false });
});

describe('useBookStore.remove — cascade delete', () => {
  it('removes the book, its file, its sessions and its annotations', async () => {
    // Arrange
    const book = makeBook();
    await createBook(book);
    await saveFile(book.id, new Blob(['pdf'], { type: 'application/pdf' }));
    await createSession(makeSession());
    await createAnnotation(makeAnnotation());
    await upsertReview(makeReview());
    useBookStore.setState({ books: [book], isLoaded: true, error: null });

    // Act
    await useBookStore.getState().remove(book.id);

    // Assert — nada órfão sobra no IndexedDB
    const db = await getDb();
    expect(await db.get('books', book.id)).toBeUndefined();
    expect(await db.get('files', book.id)).toBeUndefined();
    expect(await db.getAllFromIndex('sessions', 'by-book', book.id)).toHaveLength(0);
    expect(await db.getAllFromIndex('notes', 'by-book', book.id)).toHaveLength(0);
    expect(await db.get('reviews', book.id)).toBeUndefined();
    expect(useBookStore.getState().books).toHaveLength(0);
  });

  it('does not remove sessions or annotations belonging to other books', async () => {
    // Arrange
    const bookA = makeBook({ id: 'a', fileRef: 'a' });
    const bookB = makeBook({ id: 'b', fileRef: 'b' });
    await createBook(bookA);
    await createBook(bookB);
    await createSession(makeSession({ id: 's-a', bookId: 'a' }));
    await createSession(makeSession({ id: 's-b', bookId: 'b' }));
    await createAnnotation(makeAnnotation({ id: 'n-a', bookId: 'a' }));
    await createAnnotation(makeAnnotation({ id: 'n-b', bookId: 'b' }));
    useBookStore.setState({ books: [bookA, bookB], isLoaded: true, error: null });

    // Act
    await useBookStore.getState().remove('a');

    // Assert
    const db = await getDb();
    expect(await db.getAllFromIndex('sessions', 'by-book', 'b')).toHaveLength(1);
    expect(await db.getAllFromIndex('notes', 'by-book', 'b')).toHaveLength(1);
  });

  it('clears the session/note/review stores in-memory state when the deleted book was loaded', async () => {
    // Arrange
    const book = makeBook();
    await createBook(book);
    await createSession(makeSession());
    await createAnnotation(makeAnnotation());
    await upsertReview(makeReview());
    useBookStore.setState({ books: [book], isLoaded: true, error: null });
    await useSessionStore.getState().loadForBook(book.id);
    await useNoteStore.getState().loadForBook(book.id);
    await useReviewStore.getState().loadForBook(book.id);
    expect(useSessionStore.getState().sessions).toHaveLength(1);
    expect(useNoteStore.getState().annotations).toHaveLength(1);
    expect(useReviewStore.getState().review).not.toBeNull();

    // Act
    await useBookStore.getState().remove(book.id);

    // Assert
    expect(useSessionStore.getState().sessions).toHaveLength(0);
    expect(useNoteStore.getState().annotations).toHaveLength(0);
    expect(useReviewStore.getState().review).toBeNull();
  });
});
