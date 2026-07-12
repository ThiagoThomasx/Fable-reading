/**
 * Biblioteca (App Shell) — usa a linguagem editorial do Fable: banda
 * full-bleed Fable Forest com headline Fraunces e pill button, grid de capas
 * em superfície cream. Nunca lê Blobs de 'files' — apenas metadata + thumbnails.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Book, BookStatus } from '../../types/models';
import { useBookStore } from '../../stores/useBookStore';
import { useUIStore } from '../../stores/useUIStore';
import { useReviewStore } from '../../stores/useReviewStore';
import { BookTile } from './BookTile';
import { AddBookDialog } from './AddBookDialog';
import { EditBookDialog } from './EditBookDialog';
import { DataSafetyDialog } from '../data-safety/DataSafetyDialog';
import { STATUS_LABELS, STATUS_ORDER } from '../../lib/book-status';
import { progressPercent } from '../../lib/book-progress';

type StatusFilter = 'all' | BookStatus;
type SortBy = 'recent' | 'title' | 'progress' | 'added';

const SORT_LABELS: Record<SortBy, string> = {
  recent: 'Recentes primeiro',
  title: 'Título A–Z',
  progress: 'Progresso',
  added: 'Adicionados recentemente',
};

function lastActivity(book: Book): string {
  return book.lastOpenedAt ?? book.updatedAt;
}

export function Library() {
  const books = useBookStore((state) => state.books);
  const isLoaded = useBookStore((state) => state.isLoaded);
  const loadError = useBookStore((state) => state.error);
  const load = useBookStore((state) => state.load);
  const openReader = useUIStore((state) => state.openReader);
  const openDashboard = useUIStore((state) => state.openDashboard);
  const openSearch = useUIStore((state) => state.openSearch);
  const openAiAssistant = useUIStore((state) => state.openAiAssistant);
  const openAiChat = useUIStore((state) => state.openAiChat);
  const allReviews = useReviewStore((state) => state.allReviews);
  const loadAllReviews = useReviewStore((state) => state.loadAll);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [showDataSafety, setShowDataSafety] = useState(false);

  useEffect(() => {
    void loadAllReviews();
  }, [loadAllReviews]);

  const ratingsByBookId = useMemo(
    () => new Map(allReviews.map((review) => [review.bookId, review.rating])),
    [allReviews],
  );

  const onFileChosen = (files: FileList | null) => {
    const file = files?.[0];
    if (file) setPendingFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const categories = useMemo(
    () => Array.from(new Set(books.map((book) => book.category))).sort((a, b) => a.localeCompare(b)),
    [books],
  );

  const continueBook = useMemo(() => {
    const reading = books.filter((book) => book.status === 'reading');
    if (reading.length === 0) return null;
    return [...reading].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)))[0];
  }, [books]);

  const filteredBooks = useMemo(() => {
    const filtered = books.filter((book) => {
      if (statusFilter !== 'all' && book.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && book.category !== categoryFilter) return false;
      return true;
    });
    const sorted = [...filtered];
    switch (sortBy) {
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'progress':
        sorted.sort((a, b) => progressPercent(b) - progressPercent(a));
        break;
      case 'added':
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case 'recent':
      default:
        sorted.sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
        break;
    }
    return sorted;
  }, [books, statusFilter, categoryFilter, sortBy]);

  const hasActiveFilters = statusFilter !== 'all' || categoryFilter !== 'all';
  const clearFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('all');
  };

  return (
    <div className="min-h-screen bg-pure-white">
      <section className="bg-fable-forest px-6 py-16 md:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <span className="font-display text-sm text-pure-white/70">ReadQuest</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={openSearch}
                className="text-sm font-medium text-pure-white/80 underline underline-offset-2 hover:text-pure-white"
              >
                Buscar
              </button>
              <button
                type="button"
                onClick={openAiAssistant}
                className="text-sm font-medium text-pure-white/80 underline underline-offset-2 hover:text-pure-white"
              >
                Assistente IA
              </button>
              <button
                type="button"
                onClick={openAiChat}
                className="text-sm font-medium text-pure-white/80 underline underline-offset-2 hover:text-pure-white"
              >
                Chat IA (spike)
              </button>
              <button
                type="button"
                onClick={() => setShowDataSafety(true)}
                className="text-sm font-medium text-pure-white/80 underline underline-offset-2 hover:text-pure-white"
              >
                Dados e segurança
              </button>
              <button
                type="button"
                onClick={openDashboard}
                className="text-sm font-medium text-pure-white/80 underline underline-offset-2 hover:text-pure-white"
              >
                Dashboard →
              </button>
            </div>
          </div>
          <h1 className="mt-6 font-display text-5xl leading-[0.94] text-pure-white md:text-7xl md:leading-[0.9]">
            Sua biblioteca,
            <br />
            no seu ritmo.
          </h1>
          <p className="mt-5 max-w-md text-pure-white/80">
            Leia seus PDFs onde parou — rápido, offline e só seu.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-8 rounded-pill bg-pure-white px-7 py-4 font-medium text-ink shadow-lift transition-transform hover:-translate-y-0.5"
          >
            Adicionar PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => onFileChosen(event.target.files)}
          />
        </div>
      </section>

      <section className="bg-paper-cream px-6 py-12 md:px-12">
        <div className="mx-auto max-w-5xl">
          {loadError && (
            <div className="mb-8 rounded-xl bg-fog px-5 py-4 text-sm text-ink">
              <p>Não foi possível carregar sua biblioteca. {loadError}</p>
              <button type="button" onClick={() => void load()} className="mt-2 font-medium underline">
                Tentar novamente
              </button>
            </div>
          )}

          {continueBook && (
            <div className="mb-10">
              <h2 className="font-display text-lg text-ink">Continuar lendo</h2>
              <button
                type="button"
                onClick={() => openReader(continueBook.id)}
                className="mt-3 flex w-full items-center gap-4 rounded-xl bg-pure-white p-4 text-left shadow-cover transition-transform hover:-translate-y-0.5 sm:max-w-md"
              >
                {continueBook.coverUrl ? (
                  <img
                    src={continueBook.coverUrl}
                    alt={`Capa de ${continueBook.title}`}
                    className="h-20 w-14 shrink-0 rounded-sm object-cover shadow-cover"
                  />
                ) : (
                  <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-sm bg-fog" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-display text-base text-ink">{continueBook.title}</p>
                  <p className="mt-1 text-xs text-graphite">
                    {progressPercent(continueBook)}% · pág. {continueBook.currentPage} de {continueBook.totalPages}
                  </p>
                </div>
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-2xl text-ink">Biblioteca</h2>
            {isLoaded && books.length > 0 && (
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortBy)}
                className="rounded-md border border-ink/15 bg-pure-white px-3 py-1.5 text-sm text-ink outline-none"
              >
                {(Object.keys(SORT_LABELS) as SortBy[]).map((value) => (
                  <option key={value} value={value}>
                    {SORT_LABELS[value]}
                  </option>
                ))}
              </select>
            )}
          </div>

          {isLoaded && books.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === 'all' ? 'bg-charcoal-plum text-pure-white' : 'bg-fog text-graphite'
                }`}
              >
                Todos
              </button>
              {STATUS_ORDER.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === value ? 'bg-charcoal-plum text-pure-white' : 'bg-fog text-graphite'
                  }`}
                >
                  {STATUS_LABELS[value]}
                </button>
              ))}
              {categories.length > 1 && (
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="ml-2 rounded-md border border-ink/15 bg-pure-white px-2 py-1 text-xs text-ink outline-none"
                >
                  <option value="all">Todas as categorias</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              )}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-1 text-xs font-medium text-graphite underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}

          {!isLoaded && <p className="mt-6 text-sm text-graphite">Carregando…</p>}

          {isLoaded && books.length === 0 && (
            <p className="mt-6 max-w-sm text-graphite">
              Nenhum livro ainda. Adicione seu primeiro PDF para começar a ler.
            </p>
          )}

          {isLoaded && books.length > 0 && filteredBooks.length === 0 && (
            <div className="mt-6 max-w-sm">
              <p className="text-graphite">Nenhum livro corresponde a esse filtro.</p>
              <button type="button" onClick={clearFilters} className="mt-2 text-sm font-medium text-ink underline">
                Limpar filtros
              </button>
            </div>
          )}

          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredBooks.map((book) => (
              <BookTile
                key={book.id}
                book={book}
                onOpen={() => openReader(book.id)}
                onEdit={() => setEditingBook(book)}
                rating={ratingsByBookId.get(book.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {pendingFile && <AddBookDialog file={pendingFile} onClose={() => setPendingFile(null)} />}
      {editingBook && <EditBookDialog book={editingBook} onClose={() => setEditingBook(null)} />}
      {showDataSafety && <DataSafetyDialog onClose={() => setShowDataSafety(false)} />}
    </div>
  );
}
