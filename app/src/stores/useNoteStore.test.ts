import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests } from '../db/db';
import { useNoteStore } from './useNoteStore';

const BOOK_ID = 'book-1';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  useNoteStore.setState({
    annotations: [],
    loadedBookId: null,
    error: null,
    allAnnotations: [],
    isAllLoaded: false,
  });
});

describe('useNoteStore.toggleBookmark', () => {
  it('creates a bookmark on the current page when none exists', async () => {
    // Arrange
    await useNoteStore.getState().loadForBook(BOOK_ID);

    // Act
    await useNoteStore.getState().toggleBookmark(BOOK_ID, 5);

    // Assert
    const { annotations } = useNoteStore.getState();
    expect(annotations).toHaveLength(1);
    expect(annotations[0]).toMatchObject({ bookId: BOOK_ID, page: 5, type: 'bookmark' });
  });

  it('removes the existing bookmark instead of creating a duplicate', async () => {
    // Arrange
    await useNoteStore.getState().loadForBook(BOOK_ID);
    await useNoteStore.getState().toggleBookmark(BOOK_ID, 5);
    expect(useNoteStore.getState().annotations).toHaveLength(1);

    // Act
    await useNoteStore.getState().toggleBookmark(BOOK_ID, 5);

    // Assert
    expect(useNoteStore.getState().annotations).toHaveLength(0);
  });

  it('does not affect a bookmark on a different page', async () => {
    // Arrange
    await useNoteStore.getState().loadForBook(BOOK_ID);
    await useNoteStore.getState().toggleBookmark(BOOK_ID, 5);

    // Act
    await useNoteStore.getState().toggleBookmark(BOOK_ID, 9);

    // Assert
    const { annotations } = useNoteStore.getState();
    expect(annotations).toHaveLength(2);
    expect(annotations.map((a) => a.page).sort()).toEqual([5, 9]);
  });

  it('keeps at most one bookmark per page across repeated toggles', async () => {
    // Arrange
    await useNoteStore.getState().loadForBook(BOOK_ID);

    // Act
    await useNoteStore.getState().toggleBookmark(BOOK_ID, 3);
    await useNoteStore.getState().toggleBookmark(BOOK_ID, 3);
    await useNoteStore.getState().toggleBookmark(BOOK_ID, 3);

    // Assert
    expect(useNoteStore.getState().annotations).toHaveLength(1);
  });
});

describe('useNoteStore highlight lifecycle', () => {
  it('creates a highlight via add() and keeps it in state', async () => {
    // Arrange
    await useNoteStore.getState().loadForBook(BOOK_ID);
    const now = new Date().toISOString();

    // Act
    await useNoteStore.getState().add({
      id: 'h1',
      bookId: BOOK_ID,
      page: 7,
      type: 'highlight',
      color: 'green',
      quoteText: 'Trecho importante',
      textAnchor: { page: 7, rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.05 }] },
      createdAt: now,
      updatedAt: now,
    });

    // Assert
    const { annotations } = useNoteStore.getState();
    expect(annotations).toHaveLength(1);
    expect(annotations[0]).toMatchObject({ type: 'highlight', page: 7, quoteText: 'Trecho importante' });
  });

  it('removes a highlight via remove()', async () => {
    // Arrange
    await useNoteStore.getState().loadForBook(BOOK_ID);
    const now = new Date().toISOString();
    await useNoteStore.getState().add({
      id: 'h1',
      bookId: BOOK_ID,
      page: 7,
      type: 'highlight',
      quoteText: 'Trecho',
      createdAt: now,
      updatedAt: now,
    });

    // Act
    await useNoteStore.getState().remove('h1');

    // Assert
    expect(useNoteStore.getState().annotations).toHaveLength(0);
  });

  it('keeps a page_note, a bookmark and a highlight on the same page coexisting', async () => {
    // Arrange
    await useNoteStore.getState().loadForBook(BOOK_ID);
    const now = new Date().toISOString();

    // Act
    await useNoteStore.getState().add({
      id: 'note',
      bookId: BOOK_ID,
      page: 3,
      type: 'page_note',
      body: 'Nota',
      createdAt: now,
      updatedAt: now,
    });
    await useNoteStore.getState().toggleBookmark(BOOK_ID, 3);
    await useNoteStore.getState().add({
      id: 'highlight',
      bookId: BOOK_ID,
      page: 3,
      type: 'highlight',
      quoteText: 'Trecho',
      createdAt: now,
      updatedAt: now,
    });

    // Assert
    const { annotations } = useNoteStore.getState();
    const page3Types = annotations.filter((a) => a.page === 3).map((a) => a.type).sort();
    expect(page3Types).toEqual(['bookmark', 'highlight', 'page_note']);
  });
});

describe('useNoteStore.loadAll', () => {
  it('loads annotations across all books', async () => {
    // Arrange
    await useNoteStore.getState().loadForBook(BOOK_ID);
    const now = new Date().toISOString();
    await useNoteStore.getState().add({
      id: 'note-book-1',
      bookId: BOOK_ID,
      page: 1,
      type: 'page_note',
      body: 'Nota do livro 1',
      createdAt: now,
      updatedAt: now,
    });
    await useNoteStore.getState().loadForBook('book-2');
    await useNoteStore.getState().add({
      id: 'note-book-2',
      bookId: 'book-2',
      page: 1,
      type: 'page_note',
      body: 'Nota do livro 2',
      createdAt: now,
      updatedAt: now,
    });

    // Act
    await useNoteStore.getState().loadAll();

    // Assert
    const { allAnnotations, isAllLoaded } = useNoteStore.getState();
    expect(isAllLoaded).toBe(true);
    expect(allAnnotations.map((a) => a.bookId).sort()).toEqual([BOOK_ID, 'book-2']);
  });

  it('keeps allAnnotations in sync when a new annotation is added after loadAll', async () => {
    // Arrange
    await useNoteStore.getState().loadAll();

    // Act
    await useNoteStore.getState().loadForBook(BOOK_ID);
    await useNoteStore.getState().toggleBookmark(BOOK_ID, 7);

    // Assert
    expect(useNoteStore.getState().allAnnotations).toHaveLength(1);
  });
});
