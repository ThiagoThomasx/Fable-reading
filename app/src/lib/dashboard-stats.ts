/**
 * Helpers puros de agregação para o Dashboard. Operam só sobre arrays de
 * ReadingSession/Book já carregados em memória — nunca tocam IndexedDB.
 */
import type { Book, ReadingSession } from '../types/models';

export function getTotalReadingTime(sessions: ReadingSession[]): number {
  return sessions.reduce((total, session) => total + session.durationMs, 0);
}

export function getTotalPagesRead(sessions: ReadingSession[]): number {
  return sessions.reduce((total, session) => total + session.pagesRead, 0);
}

export function getRecentSessions(sessions: ReadingSession[], limit: number): ReadingSession[] {
  return [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
}

export type BookActivitySummary = {
  bookId: string;
  totalDurationMs: number;
  totalPagesRead: number;
  sessionCount: number;
  lastReadAt: string;
};

export function getBookActivitySummary(
  sessions: ReadingSession[],
  limit: number,
): BookActivitySummary[] {
  const byBook = new Map<string, BookActivitySummary>();

  for (const session of sessions) {
    const existing = byBook.get(session.bookId);
    if (existing) {
      byBook.set(session.bookId, {
        bookId: session.bookId,
        totalDurationMs: existing.totalDurationMs + session.durationMs,
        totalPagesRead: existing.totalPagesRead + session.pagesRead,
        sessionCount: existing.sessionCount + 1,
        lastReadAt:
          session.startedAt > existing.lastReadAt ? session.startedAt : existing.lastReadAt,
      });
    } else {
      byBook.set(session.bookId, {
        bookId: session.bookId,
        totalDurationMs: session.durationMs,
        totalPagesRead: session.pagesRead,
        sessionCount: 1,
        lastReadAt: session.startedAt,
      });
    }
  }

  return [...byBook.values()]
    .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
    .slice(0, limit);
}

export type DayActivity = {
  /** Data local no formato YYYY-MM-DD. */
  date: string;
  durationMs: number;
  pagesRead: number;
  sessionCount: number;
};

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Últimos 7 dias (hoje incluso), do mais antigo ao mais recente, em timezone local. */
export function getLast7DaysActivity(
  sessions: ReadingSession[],
  referenceDate: Date = new Date(),
): DayActivity[] {
  const days: DayActivity[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() - offset,
    );
    days.push({ date: toLocalDateKey(day), durationMs: 0, pagesRead: 0, sessionCount: 0 });
  }

  const byDate = new Map(days.map((day) => [day.date, day]));

  for (const session of sessions) {
    const key = toLocalDateKey(new Date(session.startedAt));
    const bucket = byDate.get(key);
    if (!bucket) continue;
    bucket.durationMs += session.durationMs;
    bucket.pagesRead += session.pagesRead;
    bucket.sessionCount += 1;
  }

  return days;
}

/** Livros com ao menos uma sessão registrada. */
export function getActiveBookCount(sessions: ReadingSession[]): number {
  return new Set(sessions.map((session) => session.bookId)).size;
}

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`;
}

/** Resolve título de exibição de um bookId, com fallback para livro removido. */
export function resolveBookTitle(bookId: string, books: Book[]): string {
  return books.find((book) => book.id === bookId)?.title ?? 'Livro removido';
}

/** Livros marcados como finalizados — única estatística do Dashboard derivada de Book[], não de sessões. */
export function getFinishedBookCount(books: Book[]): number {
  return books.filter((book) => book.status === 'completed').length;
}
