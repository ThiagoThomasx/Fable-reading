/**
 * Dashboard de leitura (App Shell) — extrai valor das ReadingSessions já
 * capturadas pelo reader. Nunca lê Blobs de 'files', só metadata de books
 * (já em memória via useBookStore) e sessões (via useSessionStore.loadAll).
 */
import { useEffect, useMemo } from 'react';
import { useBookStore } from '../../stores/useBookStore';
import { useSessionStore } from '../../stores/useSessionStore';
import { useUIStore } from '../../stores/useUIStore';
import {
  getTotalReadingTime,
  getTotalPagesRead,
  getRecentSessions,
  getBookActivitySummary,
  getLast7DaysActivity,
  getActiveBookCount,
  getFinishedBookCount,
} from '../../lib/dashboard-stats';
import { StatsCards } from './StatsCards';
import { WeeklyActivity } from './WeeklyActivity';
import { RecentActivityList } from './RecentActivityList';
import { BookActivityList } from './BookActivityList';

const RECENT_SESSIONS_LIMIT = 8;
const TOP_BOOKS_LIMIT = 5;

export function Dashboard() {
  const books = useBookStore((state) => state.books);
  const allSessions = useSessionStore((state) => state.allSessions);
  const isAllLoaded = useSessionStore((state) => state.isAllLoaded);
  const allError = useSessionStore((state) => state.allError);
  const loadAll = useSessionStore((state) => state.loadAll);
  const openLibrary = useUIStore((state) => state.openLibrary);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const totalDurationMs = useMemo(() => getTotalReadingTime(allSessions), [allSessions]);
  const totalPagesRead = useMemo(() => getTotalPagesRead(allSessions), [allSessions]);
  const activeBookCount = useMemo(() => getActiveBookCount(allSessions), [allSessions]);
  const finishedBookCount = useMemo(() => getFinishedBookCount(books), [books]);
  const recentSessions = useMemo(
    () => getRecentSessions(allSessions, RECENT_SESSIONS_LIMIT),
    [allSessions],
  );
  const bookSummaries = useMemo(
    () => getBookActivitySummary(allSessions, TOP_BOOKS_LIMIT),
    [allSessions],
  );
  const last7Days = useMemo(() => getLast7DaysActivity(allSessions), [allSessions]);
  const lastReadAt = recentSessions[0]?.startedAt ?? null;

  return (
    <div className="min-h-screen bg-pure-white">
      <section className="bg-fable-forest px-6 py-16 md:px-12">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={openLibrary}
            className="mb-6 text-sm font-medium text-pure-white/80 underline underline-offset-2 hover:text-pure-white"
          >
            ← Voltar à biblioteca
          </button>
          <h1 className="font-display text-5xl leading-[0.94] text-pure-white md:text-6xl md:leading-[0.9]">
            Sua leitura,
            <br />
            em números.
          </h1>
          <p className="mt-5 max-w-md text-pure-white/80">
            Um resumo leve do que você já leu — sem pressão, só continuidade.
          </p>
        </div>
      </section>

      <section className="bg-paper-cream px-6 py-12 md:px-12">
        <div className="mx-auto max-w-5xl space-y-8">
          {allError && (
            <div className="rounded-xl bg-fog px-5 py-4 text-sm text-ink">
              <p>Não foi possível carregar suas sessões de leitura. {allError}</p>
              <button type="button" onClick={() => void loadAll()} className="mt-2 font-medium underline">
                Tentar novamente
              </button>
            </div>
          )}

          {!isAllLoaded && !allError && <p className="text-sm text-graphite">Carregando…</p>}

          {isAllLoaded && (
            <>
              <StatsCards
                totalDurationMs={totalDurationMs}
                totalPagesRead={totalPagesRead}
                sessionCount={allSessions.length}
                activeBookCount={activeBookCount}
                lastReadAt={lastReadAt}
                finishedBookCount={finishedBookCount}
              />

              <WeeklyActivity days={last7Days} />

              <div className="grid gap-6 lg:grid-cols-2">
                <RecentActivityList sessions={recentSessions} books={books} />
                <BookActivityList summaries={bookSummaries} books={books} />
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
