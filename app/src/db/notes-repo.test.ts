import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests, getDb } from './db';
import {
  listAnnotationsForBook,
  getAnnotation,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  deleteAnnotationsForBook,
} from './notes-repo';
import type { ReadingAnnotation } from '../types/models';

function makeAnnotation(overrides: Partial<ReadingAnnotation> = {}): ReadingAnnotation {
  const now = '2026-07-09T12:00:00.000Z';
  return {
    id: 'note-1',
    bookId: 'book-1',
    page: 12,
    type: 'page_note',
    body: 'Ideia interessante sobre o capítulo 2',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  // Banco novo e isolado por teste
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
});

describe('notes-repo', () => {
  it('creates an annotation and lists it by book', async () => {
    // Arrange
    const annotation = makeAnnotation();

    // Act
    await createAnnotation(annotation);
    const forBook = await listAnnotationsForBook('book-1');

    // Assert
    expect(forBook).toHaveLength(1);
    expect(forBook[0]).toEqual(annotation);
  });

  it('does not return annotations from other books', async () => {
    // Arrange
    await createAnnotation(makeAnnotation({ id: 'a', bookId: 'book-1' }));
    await createAnnotation(makeAnnotation({ id: 'b', bookId: 'book-2' }));

    // Act
    const forBook1 = await listAnnotationsForBook('book-1');

    // Assert
    expect(forBook1).toHaveLength(1);
    expect(forBook1[0]?.id).toBe('a');
  });

  it('creates a bookmark without body', async () => {
    // Arrange
    const bookmark = makeAnnotation({ id: 'b', type: 'bookmark', body: undefined, page: 5 });

    // Act
    await createAnnotation(bookmark);
    const stored = await getAnnotation('b');

    // Assert
    expect(stored?.type).toBe('bookmark');
    expect(stored?.body).toBeUndefined();
  });

  it('updates only the patched fields and bumps updatedAt', async () => {
    // Arrange
    const annotation = makeAnnotation();
    await createAnnotation(annotation);

    // Act
    const updated = await updateAnnotation('note-1', { body: 'Texto revisado' });

    // Assert
    expect(updated.body).toBe('Texto revisado');
    expect(updated.page).toBe(annotation.page);
    expect(updated.createdAt).toBe(annotation.createdAt);
    expect(updated.updatedAt).not.toBe(annotation.updatedAt);
    expect(await getAnnotation('note-1')).toEqual(updated);
  });

  it('throws when updating a missing annotation', async () => {
    await expect(updateAnnotation('ghost', { body: 'x' })).rejects.toThrow(
      'Anotação não encontrada',
    );
  });

  it('deletes an annotation', async () => {
    // Arrange
    await createAnnotation(makeAnnotation());

    // Act
    await deleteAnnotation('note-1');

    // Assert
    expect(await getAnnotation('note-1')).toBeUndefined();
  });

  it('indexes annotations by type', async () => {
    // Arrange
    await createAnnotation(makeAnnotation({ id: 'a', type: 'page_note' }));
    await createAnnotation(makeAnnotation({ id: 'b', type: 'bookmark', body: undefined }));

    // Act
    const db = await getDb();
    const bookmarks = await db.getAllFromIndex('notes', 'by-type', 'bookmark');

    // Assert
    expect(bookmarks.map((note) => note.id)).toEqual(['b']);
  });

  it('creates a highlight with quoteText and relative rects', async () => {
    // Arrange
    const highlight = makeAnnotation({
      id: 'h1',
      type: 'highlight',
      body: undefined,
      color: 'yellow',
      quoteText: 'Trecho destacado',
      textAnchor: {
        page: 12,
        text: 'Trecho destacado',
        rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
      },
    });

    // Act
    await createAnnotation(highlight);
    const stored = await getAnnotation('h1');

    // Assert
    expect(stored?.type).toBe('highlight');
    expect(stored?.quoteText).toBe('Trecho destacado');
    expect(stored?.textAnchor?.rects).toEqual([{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }]);
  });

  it('lists highlights for a book filtered by page alongside notes and bookmarks', async () => {
    // Arrange — nota, bookmark e highlight coexistindo na mesma página
    await createAnnotation(makeAnnotation({ id: 'note', type: 'page_note', page: 12 }));
    await createAnnotation(
      makeAnnotation({ id: 'bookmark', type: 'bookmark', body: undefined, page: 12 }),
    );
    await createAnnotation(
      makeAnnotation({
        id: 'highlight',
        type: 'highlight',
        body: undefined,
        page: 12,
        quoteText: 'Trecho',
        textAnchor: { page: 12, rects: [{ x: 0, y: 0, width: 0.1, height: 0.1 }] },
      }),
    );
    await createAnnotation(makeAnnotation({ id: 'other-page', type: 'highlight', page: 99 }));

    // Act
    const forBook = await listAnnotationsForBook('book-1');
    const page12 = forBook.filter((a) => a.page === 12);

    // Assert
    expect(page12.map((a) => a.id).sort()).toEqual(['bookmark', 'highlight', 'note']);
    expect(forBook.find((a) => a.id === 'other-page')).toBeDefined();
  });

  it('deletes a highlight', async () => {
    // Arrange
    await createAnnotation(makeAnnotation({ id: 'h1', type: 'highlight', body: undefined }));

    // Act
    await deleteAnnotation('h1');

    // Assert
    expect(await getAnnotation('h1')).toBeUndefined();
  });

  it('indexes highlights by type alongside notes and bookmarks', async () => {
    // Arrange
    await createAnnotation(makeAnnotation({ id: 'a', type: 'page_note' }));
    await createAnnotation(makeAnnotation({ id: 'b', type: 'bookmark', body: undefined }));
    await createAnnotation(makeAnnotation({ id: 'c', type: 'highlight', body: undefined }));

    // Act
    const db = await getDb();
    const highlights = await db.getAllFromIndex('notes', 'by-type', 'highlight');

    // Assert
    expect(highlights.map((note) => note.id)).toEqual(['c']);
  });

  it('deletes all annotations for a book without touching other books', async () => {
    // Arrange
    await createAnnotation(makeAnnotation({ id: 'a', bookId: 'book-1' }));
    await createAnnotation(makeAnnotation({ id: 'b', bookId: 'book-1', type: 'bookmark', body: undefined }));
    await createAnnotation(makeAnnotation({ id: 'c', bookId: 'book-2' }));

    // Act
    await deleteAnnotationsForBook('book-1');

    // Assert
    expect(await listAnnotationsForBook('book-1')).toHaveLength(0);
    expect(await listAnnotationsForBook('book-2')).toHaveLength(1);
  });

  it('never touches the sessions or books stores when creating a note', async () => {
    // Arrange
    const db = await getDb();

    // Act
    await createAnnotation(makeAnnotation());

    // Assert
    expect(await db.getAll('sessions')).toHaveLength(0);
    expect(await db.getAll('books')).toHaveLength(0);
  });
});
