/**
 * Conexão única com o IndexedDB. Duas object stores deliberadamente separadas
 * (ver ARCHITECTURE.md): 'books' (metadata, pequena, lida com frequência) e
 * 'files' (Blobs de PDF, grandes, lidos apenas ao abrir um livro). Não misturar.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Book, BookStatus, ReadingSession, ReadingAnnotation, BookReview } from '../types/models';

export interface ReadQuestDB extends DBSchema {
  books: {
    key: string;
    value: Book;
    indexes: { 'by-status': BookStatus; 'by-category': string };
  };
  files: {
    key: string; // bookId (== Book.fileRef)
    value: Blob;
  };
  sessions: {
    key: string;
    value: ReadingSession;
    indexes: { 'by-book': string; 'by-started': string };
  };
  notes: {
    key: string;
    value: ReadingAnnotation;
    indexes: { 'by-book': string; 'by-type': string };
  };
  reviews: {
    key: string; // bookId — no máximo uma review por livro, sem índice necessário
    value: BookReview;
  };
}

const DB_NAME = 'readquest';
/** Exportado para uso no backup (schemaVersion) e na UI de Data Safety. */
export const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase<ReadQuestDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<ReadQuestDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ReadQuestDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const books = db.createObjectStore('books', { keyPath: 'id' });
          books.createIndex('by-status', 'status');
          books.createIndex('by-category', 'category');
          db.createObjectStore('files');
        }
        if (oldVersion < 2) {
          const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
          sessions.createIndex('by-book', 'bookId');
          sessions.createIndex('by-started', 'startedAt');
        }
        if (oldVersion < 3) {
          const notes = db.createObjectStore('notes', { keyPath: 'id' });
          notes.createIndex('by-book', 'bookId');
          notes.createIndex('by-type', 'type');
        }
        if (oldVersion < 4) {
          db.createObjectStore('reviews', { keyPath: 'bookId' });
        }
      },
    });
  }
  return dbPromise;
}

/** Descarta a conexão memoizada — usado apenas pelos testes para isolar cada caso. */
export function resetDbForTests(): void {
  dbPromise = null;
}
