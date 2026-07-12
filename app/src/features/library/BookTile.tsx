/** Book Cover Tile do Fable: capa sem moldura, sombra sutil, progresso discreto. */
import type { Book } from '../../types/models';
import { STATUS_LABELS } from '../../lib/book-status';
import { progressPercent } from '../../lib/book-progress';

type BookTileProps = {
  book: Book;
  onOpen: () => void;
  onEdit: () => void;
  /** Nota da review (0.5–5), se existir — mostrada só quando o livro está finalizado. */
  rating?: number;
};

function formatLastOpened(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function BookTile({ book, onOpen, onEdit, rating }: BookTileProps) {
  const percent = progressPercent(book);

  return (
    <div className="group relative">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={`Capa de ${book.title}`}
            className="aspect-[7/10] w-full rounded-sm object-cover shadow-cover transition-transform group-hover:-translate-y-1"
          />
        ) : (
          <div className="flex aspect-[7/10] w-full items-center justify-center rounded-sm bg-fog p-3 shadow-cover transition-transform group-hover:-translate-y-1">
            <span className="font-display text-center text-sm text-ink">{book.title}</span>
          </div>
        )}
        <p className="mt-3 truncate text-sm font-medium text-ink">{book.title}</p>
        {book.author && <p className="truncate text-xs text-graphite">{book.author}</p>}
        <div className="mt-2 h-1 w-full rounded-full bg-fog">
          <div className="h-1 rounded-full bg-charcoal-plum" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1 text-xs text-graphite">
          {percent > 0 ? `${percent}% · pág. ${book.currentPage} de ${book.totalPages}` : `${book.totalPages} páginas`}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-full bg-fog px-2 py-0.5 text-[10px] font-medium text-graphite">
            {STATUS_LABELS[book.status]}
          </span>
          {book.status === 'completed' && rating !== undefined && (
            <span className="text-[10px] font-medium text-graphite">★ {rating.toFixed(1)}</span>
          )}
          {book.lastOpenedAt && (
            <span className="text-[10px] text-graphite/70">Lido em {formatLastOpened(book.lastOpenedAt)}</span>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
        aria-label={`Editar ${book.title}`}
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-pure-white/90 text-ink opacity-0 shadow-cover transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.5 8.5a1 1 0 0 1-.464.263l-3 .75a.5.5 0 0 1-.606-.606l.75-3a1 1 0 0 1 .263-.464l8.5-8.5z" />
        </svg>
      </button>
    </div>
  );
}
