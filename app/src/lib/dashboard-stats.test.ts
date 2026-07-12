import { describe, it, expect } from 'vitest';
import {
  getTotalReadingTime,
  getTotalPagesRead,
  getRecentSessions,
  getBookActivitySummary,
  getLast7DaysActivity,
  getActiveBookCount,
  formatDuration,
  resolveBookTitle,
} from './dashboard-stats';
import type { Book, ReadingSession } from '../types/models';

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

function makeBook(overrides: Partial<Book> = {}): Book {
  const now = '2026-07-09T12:00:00.000Z';
  return {
    id: 'book-1',
    title: 'O Nome do Vento',
    totalPages: 200,
    currentPage: 15,
    status: 'reading',
    category: 'Fantasia',
    tags: [],
    coverSource: 'extracted',
    fileRef: 'book-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('getTotalReadingTime', () => {
  it('returns 0 for no sessions', () => {
    expect(getTotalReadingTime([])).toBe(0);
  });

  it('sums durationMs across sessions', () => {
    const sessions = [
      makeSession({ id: 'a', durationMs: 60_000 }),
      makeSession({ id: 'b', durationMs: 120_000 }),
    ];
    expect(getTotalReadingTime(sessions)).toBe(180_000);
  });
});

describe('getTotalPagesRead', () => {
  it('returns 0 for no sessions', () => {
    expect(getTotalPagesRead([])).toBe(0);
  });

  it('sums pagesRead across sessions, including zero-page sessions', () => {
    const sessions = [
      makeSession({ id: 'a', pagesRead: 10 }),
      makeSession({ id: 'b', pagesRead: 0 }),
      makeSession({ id: 'c', pagesRead: 5 }),
    ];
    expect(getTotalPagesRead(sessions)).toBe(15);
  });
});

describe('getRecentSessions', () => {
  it('returns empty array for no sessions', () => {
    expect(getRecentSessions([], 5)).toEqual([]);
  });

  it('orders by most recent startedAt first and respects the limit', () => {
    const sessions = [
      makeSession({ id: 'old', startedAt: '2026-07-01T10:00:00.000Z' }),
      makeSession({ id: 'newest', startedAt: '2026-07-09T10:00:00.000Z' }),
      makeSession({ id: 'mid', startedAt: '2026-07-05T10:00:00.000Z' }),
    ];
    const result = getRecentSessions(sessions, 2);
    expect(result.map((s) => s.id)).toEqual(['newest', 'mid']);
  });
});

describe('getBookActivitySummary', () => {
  it('returns empty array for no sessions', () => {
    expect(getBookActivitySummary([], 5)).toEqual([]);
  });

  it('aggregates a single session for a single book', () => {
    const sessions = [makeSession({ bookId: 'book-1', durationMs: 60_000, pagesRead: 10 })];
    const result = getBookActivitySummary(sessions, 5);
    expect(result).toEqual([
      {
        bookId: 'book-1',
        totalDurationMs: 60_000,
        totalPagesRead: 10,
        sessionCount: 1,
        lastReadAt: sessions[0].startedAt,
      },
    ]);
  });

  it('aggregates multiple sessions of the same book', () => {
    const sessions = [
      makeSession({ id: 'a', bookId: 'book-1', durationMs: 60_000, pagesRead: 5, startedAt: '2026-07-01T10:00:00.000Z' }),
      makeSession({ id: 'b', bookId: 'book-1', durationMs: 30_000, pagesRead: 3, startedAt: '2026-07-05T10:00:00.000Z' }),
    ];
    const result = getBookActivitySummary(sessions, 5);
    expect(result).toEqual([
      {
        bookId: 'book-1',
        totalDurationMs: 90_000,
        totalPagesRead: 8,
        sessionCount: 2,
        lastReadAt: '2026-07-05T10:00:00.000Z',
      },
    ]);
  });

  it('aggregates sessions from different books separately and sorts by duration desc', () => {
    const sessions = [
      makeSession({ id: 'a', bookId: 'book-1', durationMs: 30_000 }),
      makeSession({ id: 'b', bookId: 'book-2', durationMs: 90_000 }),
    ];
    const result = getBookActivitySummary(sessions, 5);
    expect(result.map((r) => r.bookId)).toEqual(['book-2', 'book-1']);
  });

  it('respects the limit', () => {
    const sessions = [
      makeSession({ id: 'a', bookId: 'book-1' }),
      makeSession({ id: 'b', bookId: 'book-2' }),
      makeSession({ id: 'c', bookId: 'book-3' }),
    ];
    expect(getBookActivitySummary(sessions, 2)).toHaveLength(2);
  });
});

describe('getLast7DaysActivity', () => {
  it('returns 7 zeroed days when there are no sessions', () => {
    const reference = new Date('2026-07-09T15:00:00');
    const result = getLast7DaysActivity([], reference);
    expect(result).toHaveLength(7);
    expect(result.every((day) => day.durationMs === 0 && day.sessionCount === 0)).toBe(true);
    expect(result[6].date).toBe('2026-07-09');
    expect(result[0].date).toBe('2026-07-03');
  });

  it('buckets sessions into the correct local day and leaves other days zeroed', () => {
    const reference = new Date('2026-07-09T15:00:00');
    const sessions = [
      makeSession({ id: 'a', startedAt: '2026-07-09T10:00:00', durationMs: 60_000, pagesRead: 5 }),
      makeSession({ id: 'b', startedAt: '2026-07-07T10:00:00', durationMs: 30_000, pagesRead: 2 }),
    ];
    const result = getLast7DaysActivity(sessions, reference);
    const today = result.find((day) => day.date === '2026-07-09');
    const twoDaysAgo = result.find((day) => day.date === '2026-07-07');
    const untouched = result.find((day) => day.date === '2026-07-04');

    expect(today).toEqual({ date: '2026-07-09', durationMs: 60_000, pagesRead: 5, sessionCount: 1 });
    expect(twoDaysAgo).toEqual({ date: '2026-07-07', durationMs: 30_000, pagesRead: 2, sessionCount: 1 });
    expect(untouched).toEqual({ date: '2026-07-04', durationMs: 0, pagesRead: 0, sessionCount: 0 });
  });

  it('ignores sessions outside the 7-day window', () => {
    const reference = new Date('2026-07-09T15:00:00');
    const sessions = [makeSession({ startedAt: '2026-06-01T10:00:00', durationMs: 60_000 })];
    const result = getLast7DaysActivity(sessions, reference);
    expect(result.every((day) => day.durationMs === 0)).toBe(true);
  });
});

describe('getActiveBookCount', () => {
  it('returns 0 for no sessions', () => {
    expect(getActiveBookCount([])).toBe(0);
  });

  it('counts distinct book ids', () => {
    const sessions = [
      makeSession({ id: 'a', bookId: 'book-1' }),
      makeSession({ id: 'b', bookId: 'book-1' }),
      makeSession({ id: 'c', bookId: 'book-2' }),
    ];
    expect(getActiveBookCount(sessions)).toBe(2);
  });
});

describe('formatDuration', () => {
  it('formats sub-minute durations', () => {
    expect(formatDuration(10_000)).toBe('<1 min');
  });

  it('formats minutes under an hour', () => {
    expect(formatDuration(42 * 60_000)).toBe('42min');
  });

  it('formats whole hours', () => {
    expect(formatDuration(2 * 3_600_000)).toBe('2h');
  });

  it('formats hours with remaining minutes', () => {
    expect(formatDuration(3 * 3_600_000 + 42 * 60_000)).toBe('3h 42min');
  });
});

describe('resolveBookTitle', () => {
  it('returns the matching book title', () => {
    const books = [makeBook({ id: 'book-1', title: 'Duna' })];
    expect(resolveBookTitle('book-1', books)).toBe('Duna');
  });

  it('falls back gracefully when the book was deleted', () => {
    expect(resolveBookTitle('ghost', [])).toBe('Livro removido');
  });
});
