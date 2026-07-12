import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests, getDb } from './db';
import {
  listSessionsForBook,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  deleteSessionsForBook,
} from './sessions-repo';
import type { ReadingSession } from '../types/models';

function makeSession(overrides: Partial<ReadingSession> = {}): ReadingSession {
  const now = '2026-07-09T12:00:00.000Z';
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

beforeEach(() => {
  // Banco novo e isolado por teste
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
});

describe('sessions-repo', () => {
  it('creates a session and lists it by book', async () => {
    // Arrange
    const session = makeSession();

    // Act
    await createSession(session);
    const forBook = await listSessionsForBook('book-1');

    // Assert
    expect(forBook).toHaveLength(1);
    expect(forBook[0]).toEqual(session);
  });

  it('does not return sessions from other books', async () => {
    // Arrange
    await createSession(makeSession({ id: 'a', bookId: 'book-1' }));
    await createSession(makeSession({ id: 'b', bookId: 'book-2' }));

    // Act
    const forBook1 = await listSessionsForBook('book-1');

    // Assert
    expect(forBook1).toHaveLength(1);
    expect(forBook1[0]?.id).toBe('a');
  });

  it('updates only the patched fields and bumps updatedAt', async () => {
    // Arrange
    const session = makeSession();
    await createSession(session);

    // Act
    const updated = await updateSession('session-1', { notes: 'Capítulo 3 foi denso' });

    // Assert
    expect(updated.notes).toBe('Capítulo 3 foi denso');
    expect(updated.durationMs).toBe(session.durationMs);
    expect(updated.createdAt).toBe(session.createdAt);
    expect(updated.updatedAt).not.toBe(session.updatedAt);
    expect(await getSession('session-1')).toEqual(updated);
  });

  it('allows manual edit of durationMs', async () => {
    // Arrange
    await createSession(makeSession());

    // Act
    const updated = await updateSession('session-1', { durationMs: 45 * 60 * 1000 });

    // Assert
    expect(updated.durationMs).toBe(45 * 60 * 1000);
  });

  it('throws when updating a missing session', async () => {
    await expect(updateSession('ghost', { notes: 'x' })).rejects.toThrow('Sessão não encontrada');
  });

  it('deletes a session', async () => {
    // Arrange
    await createSession(makeSession());

    // Act
    await deleteSession('session-1');

    // Assert
    expect(await getSession('session-1')).toBeUndefined();
  });

  it('deletes all sessions for a book without touching other books', async () => {
    // Arrange
    await createSession(makeSession({ id: 'a', bookId: 'book-1' }));
    await createSession(makeSession({ id: 'b', bookId: 'book-1' }));
    await createSession(makeSession({ id: 'c', bookId: 'book-2' }));

    // Act
    await deleteSessionsForBook('book-1');

    // Assert
    expect(await listSessionsForBook('book-1')).toHaveLength(0);
    expect(await listSessionsForBook('book-2')).toHaveLength(1);
  });

  it('indexes sessions by startedAt', async () => {
    // Arrange
    await createSession(makeSession({ id: 'a', startedAt: '2026-07-08T10:00:00.000Z' }));
    await createSession(makeSession({ id: 'b', startedAt: '2026-07-09T10:00:00.000Z' }));

    // Act
    const db = await getDb();
    const all = await db.getAllFromIndex('sessions', 'by-started');

    // Assert
    expect(all.map((s) => s.id)).toEqual(['a', 'b']);
  });
});
