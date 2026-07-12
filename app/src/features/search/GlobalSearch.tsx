/**
 * Busca global (Sprint 12, App Shell) — combina Book[]/ReadingAnnotation[]/BookReview[]/
 * ReadingSession[] já carregados pelos stores num índice pesquisável (lib/search-index.ts)
 * e navega direto para o reader, na página certa quando o resultado é ancorado a uma página
 * (nota, highlight, marcador, nota de sessão). Nunca lê Blobs de 'files'.
 */
import { useEffect, useMemo, useState } from 'react';
import { useBookStore } from '../../stores/useBookStore';
import { useNoteStore } from '../../stores/useNoteStore';
import { useReviewStore } from '../../stores/useReviewStore';
import { useSessionStore } from '../../stores/useSessionStore';
import { useUIStore } from '../../stores/useUIStore';
import {
  buildSearchIndex,
  searchLibrary,
  SEARCH_TYPE_LABELS,
  type ScoredSearchResult,
} from '../../lib/search-index';

export function GlobalSearch() {
  const books = useBookStore((state) => state.books);
  const isBooksLoaded = useBookStore((state) => state.isLoaded);
  const allAnnotations = useNoteStore((state) => state.allAnnotations);
  const isNotesLoaded = useNoteStore((state) => state.isAllLoaded);
  const loadAllNotes = useNoteStore((state) => state.loadAll);
  const allReviews = useReviewStore((state) => state.allReviews);
  const isReviewsLoaded = useReviewStore((state) => state.isAllLoaded);
  const loadAllReviews = useReviewStore((state) => state.loadAll);
  const allSessions = useSessionStore((state) => state.allSessions);
  const isSessionsLoaded = useSessionStore((state) => state.isAllLoaded);
  const loadAllSessions = useSessionStore((state) => state.loadAll);
  const openLibrary = useUIStore((state) => state.openLibrary);
  const openReader = useUIStore((state) => state.openReader);

  const [query, setQuery] = useState('');

  useEffect(() => {
    void loadAllNotes();
    void loadAllReviews();
    void loadAllSessions();
  }, [loadAllNotes, loadAllReviews, loadAllSessions]);

  const isReady = isBooksLoaded && isNotesLoaded && isReviewsLoaded && isSessionsLoaded;

  const index = useMemo(
    () =>
      buildSearchIndex({
        books,
        annotations: allAnnotations,
        reviews: allReviews,
        sessions: allSessions,
      }),
    [books, allAnnotations, allReviews, allSessions],
  );

  const trimmedQuery = query.trim();
  const results = useMemo(() => searchLibrary(query, index), [query, index]);

  const onSelectResult = (result: ScoredSearchResult) => {
    openReader(result.bookId, result.page);
  };

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
            Busque em toda
            <br />a sua leitura.
          </h1>
          <p className="mt-5 max-w-md text-pure-white/80">
            Títulos, autores, categorias, notas, highlights, marcadores, reviews e sessões — tudo
            num só lugar.
          </p>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar…"
            aria-label="Buscar em toda a biblioteca"
            className="mt-8 w-full max-w-xl rounded-pill bg-pure-white px-6 py-4 text-ink shadow-lift outline-none placeholder:text-graphite"
          />
        </div>
      </section>

      <section className="bg-paper-cream px-6 py-12 md:px-12">
        <div className="mx-auto max-w-5xl">
          {!isReady && <p className="text-sm text-graphite">Carregando…</p>}

          {isReady && trimmedQuery.length === 0 && (
            <p className="text-graphite">
              Digite para buscar em títulos, autores, categorias, notas, highlights, marcadores,
              reviews e sessões.
            </p>
          )}

          {isReady && trimmedQuery.length > 0 && results.length === 0 && (
            <p className="text-graphite">Nenhum resultado para "{trimmedQuery}".</p>
          )}

          {isReady && results.length > 0 && (
            <ul className="space-y-2">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => onSelectResult(result)}
                    className="w-full rounded-xl bg-pure-white p-4 text-left shadow-cover transition-transform hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-2 text-xs text-graphite">
                      <span className="rounded-full bg-fog px-2 py-0.5 font-medium text-ink">
                        {SEARCH_TYPE_LABELS[result.type]}
                      </span>
                      <span className="truncate">{result.bookTitle}</span>
                      {result.page !== undefined && <span>· pág. {result.page}</span>}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-ink">{result.snippet}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
