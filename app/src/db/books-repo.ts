/**
 * Acesso à store 'books'. Toda escrita é imutável: updateBook lê o registro,
 * cria uma cópia com o patch aplicado e persiste a cópia.
 */
import { getDb } from './db';
import type { Book, BookPatch } from '../types/models';

export async function listBooks(): Promise<Book[]> {
  const db = await getDb();
  return db.getAll('books');
}

export async function getBook(id: string): Promise<Book | undefined> {
  const db = await getDb();
  return db.get('books', id);
}

export async function createBook(book: Book): Promise<Book> {
  const db = await getDb();
  await db.add('books', book);
  return book;
}

export async function updateBook(id: string, patch: BookPatch): Promise<Book> {
  const db = await getDb();
  const existing = await db.get('books', id);
  if (!existing) {
    throw new Error(`Livro não encontrado: ${id}`);
  }
  const updated: Book = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await db.put('books', updated);
  return updated;
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('books', id);
}
