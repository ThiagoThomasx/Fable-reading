/**
 * Acesso à store 'sessions'. Toda escrita é imutável: updateSession lê o
 * registro, cria uma cópia com o patch aplicado e persiste a cópia.
 */
import { getDb } from './db';
import type { ReadingSession, SessionPatch } from '../types/models';

export async function listSessionsForBook(bookId: string): Promise<ReadingSession[]> {
  const db = await getDb();
  return db.getAllFromIndex('sessions', 'by-book', bookId);
}

export async function listAllSessions(): Promise<ReadingSession[]> {
  const db = await getDb();
  return db.getAll('sessions');
}

export async function getSession(id: string): Promise<ReadingSession | undefined> {
  const db = await getDb();
  return db.get('sessions', id);
}

export async function createSession(session: ReadingSession): Promise<ReadingSession> {
  const db = await getDb();
  await db.add('sessions', session);
  return session;
}

export async function updateSession(id: string, patch: SessionPatch): Promise<ReadingSession> {
  const db = await getDb();
  const existing = await db.get('sessions', id);
  if (!existing) {
    throw new Error(`Sessão não encontrada: ${id}`);
  }
  const updated: ReadingSession = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await db.put('sessions', updated);
  return updated;
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('sessions', id);
}

/** Remove todas as sessões de um livro — usado no cascade de exclusão de livro. */
export async function deleteSessionsForBook(bookId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('sessions', 'readwrite');
  const keys = await tx.store.index('by-book').getAllKeys(bookId);
  await Promise.all(keys.map((key) => tx.store.delete(key)));
  await tx.done;
}
