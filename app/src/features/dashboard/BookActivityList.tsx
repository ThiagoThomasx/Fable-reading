/** Top livros mais ativos, agregados a partir das sessões — sem tocar Blobs. */
import type { Book } from '../../types/models';
import type { BookActivitySummary } from '../../lib/dashboard-stats';
import { formatDuration } from '../../lib/dashboard-stats';

type BookActivityListProps = {
  summaries: BookActivitySummary[];
  books: Book[];
};

function formatLastRead(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function BookActivityList({ summaries, books }: BookActivityListProps) {
  if (summaries.length === 0) {
    return (
      <div className="rounded-xl bg-pure-white p-5 shadow-cover">
        <h3 className="font-display text-base text-ink">Livros mais ativos</h3>
        <p className="mt-2 text-sm text-graphite">Ainda não há sessões suficientes para destacar livros.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-pure-white p-5 shadow-cover">
      <h3 className="font-display text-base text-ink">Livros mais ativos</h3>
      <ul className="mt-3 space-y-3">
        {summaries.map((summary) => {
          const book = books.find((candidate) => candidate.id === summary.bookId);
          return (
            <li key={summary.bookId} className="flex items-center gap-3">
              {book?.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={`Capa de ${book.title}`}
                  className="h-14 w-10 shrink-0 rounded-sm object-cover shadow-cover"
                />
              ) : (
                <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-sm bg-fog text-[9px] text-ink">
                  {book ? book.title.slice(0, 2).toUpperCase() : '–'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{book?.title ?? 'Livro removido'}</p>
                <p className="text-xs text-graphite">
                  {formatDuration(summary.totalDurationMs)} · {summary.totalPagesRead} páginas ·{' '}
                  {summary.sessionCount} sessão(ões) · última em {formatLastRead(summary.lastReadAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
