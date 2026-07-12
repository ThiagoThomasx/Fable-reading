import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests, getDb } from './db';
import { listBooks, getBook, createBook, updateBook } from './books-repo';
import { saveFile, loadFile } from './files-repo';
import type { Book } from '../types/models';

function makeBook(overrides: Partial<Book> = {}): Book {
  const now = '2026-07-09T12:00:00.000Z';
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

beforeEach(() => {
  // Banco novo e isolado por teste
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
});

describe('books-repo', () => {
  it('creates and lists books', async () => {
    // Arrange
    const book = makeBook();

    // Act
    await createBook(book);
    const all = await listBooks();

    // Assert
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(book);
  });

  it('updates only the patched fields and bumps updatedAt', async () => {
    // Arrange
    const book = makeBook();
    await createBook(book);

    // Act
    const updated = await updateBook('book-1', { currentPage: 150 });

    // Assert
    expect(updated.currentPage).toBe(150);
    expect(updated.title).toBe(book.title);
    expect(updated.createdAt).toBe(book.createdAt);
    expect(updated.updatedAt).not.toBe(book.updatedAt);
    expect(await getBook('book-1')).toEqual(updated);
  });

  it('persists lastPageSnapshot alongside currentPage', async () => {
    // Arrange
    await createBook(makeBook());
    const snapshot = 'data:image/jpeg;base64,AAAA';

    // Act
    await updateBook('book-1', { currentPage: 42, lastPageSnapshot: snapshot });

    // Assert
    const stored = await getBook('book-1');
    expect(stored?.currentPage).toBe(42);
    expect(stored?.lastPageSnapshot).toBe(snapshot);
  });

  it('throws when updating a missing book', async () => {
    await expect(updateBook('ghost', { currentPage: 2 })).rejects.toThrow(
      'Livro não encontrado',
    );
  });

  it('updating progress never touches the files store', async () => {
    // Arrange — Blob do "PDF" na store files + metadata na store books
    const pdfBytes = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/pdf' });
    await saveFile('book-1', pdfBytes);
    await createBook(makeBook());

    // Act — atualização de progresso como o reader faz
    await updateBook('book-1', { currentPage: 99, lastPageSnapshot: 'data:image/jpeg;base64,BB' });

    // Assert — Blob permanece intacto e é o mesmo objeto salvo
    const blob = await loadFile('book-1');
    expect(blob).toBeDefined();
    expect(blob?.size).toBe(4);
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  });

  it('indexes books by status', async () => {
    // Arrange
    await createBook(makeBook({ id: 'a', fileRef: 'a', status: 'reading' }));
    await createBook(makeBook({ id: 'b', fileRef: 'b', status: 'completed' }));

    // Act
    const db = await getDb();
    const reading = await db.getAllFromIndex('books', 'by-status', 'reading');

    // Assert
    expect(reading).toHaveLength(1);
    expect(reading[0]?.id).toBe('a');
  });
});
