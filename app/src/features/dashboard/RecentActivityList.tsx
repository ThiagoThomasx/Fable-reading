/** Lista das sessões mais recentes, em ordem cronológica decrescente. */
import type { Book, ReadingSession } from '../../types/models';
import { formatDuration, resolveBookTitle } from '../../lib/dashboard-stats';

type RecentActivityListProps = {
  sessions: ReadingSession[];
  books: Book[];
};

function formatSessionDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Hoje';
  if (isYesterday) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function RecentActivityList({ sessions, books }: RecentActivityListProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl bg-pure-white p-5 shadow-cover">
        <h3 className="font-display text-base text-ink">Atividade recente</h3>
        <p className="mt-2 text-sm text-graphite">
          Nenhuma sessão registrada ainda. Abra um livro e comece a ler.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-pure-white p-5 shadow-cover">
      <h3 className="font-display text-base text-ink">Atividade recente</h3>
      <ul className="mt-3 space-y-2">
        {sessions.map((session) => (
          <li key={session.id} className="rounded-md border border-ink/10 px-3 py-2 text-sm text-ink">
            <span className="font-medium">{formatSessionDate(session.startedAt)}</span>
            {' · '}
            {resolveBookTitle(session.bookId, books)}
            {' · '}
            {formatDuration(session.durationMs)}
            {' · '}
            p. {session.startPage} → {session.endPage} · {session.pagesRead} páginas
            {session.notes && <span className="block text-xs text-graphite">{session.notes}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
