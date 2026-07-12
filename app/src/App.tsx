/**
 * Casca do app: alterna entre Biblioteca (App Shell) e Reading Surface.
 * PdfReader é code-split via React.lazy — fora do bundle inicial da Biblioteca.
 */
import { lazy, Suspense, useEffect } from 'react';
import { Library } from './features/library/Library';
import { useBookStore } from './stores/useBookStore';
import { useUIStore } from './stores/useUIStore';

const PdfReader = lazy(() => import('./features/reader/PdfReader'));
const Dashboard = lazy(() =>
  import('./features/dashboard/Dashboard').then((module) => ({ default: module.Dashboard })),
);
const GlobalSearch = lazy(() =>
  import('./features/search/GlobalSearch').then((module) => ({ default: module.GlobalSearch })),
);
const AiAssistant = lazy(() =>
  import('./features/ai-assistant/AiAssistant').then((module) => ({ default: module.AiAssistant })),
);
const AiChat = lazy(() =>
  import('./features/ai-chat/AiChat').then((module) => ({ default: module.AiChat })),
);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export default function App() {
  const view = useUIStore((state) => state.view);
  const closeReader = useUIStore((state) => state.closeReader);
  const openSearch = useUIStore((state) => state.openSearch);
  const books = useBookStore((state) => state.books);
  const load = useBookStore((state) => state.load);
  const patch = useBookStore((state) => state.patch);

  // Atalho global Ctrl/Cmd+K para abrir a busca — só fora do reader, que tem seu próprio
  // conjunto de atalhos locais (evita disputar o mesmo keydown com o listener do PdfReader).
  useEffect(() => {
    if (view.name === 'reader') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view.name, openSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const openBook =
    view.name === 'reader' ? (books.find((book) => book.id === view.bookId) ?? null) : null;
  const openedBookId = view.name === 'reader' ? view.bookId : null;

  // Primeiro contato com o livro: 'want_to_read' → 'reading'
  useEffect(() => {
    if (openBook && openBook.status === 'want_to_read') {
      void patch(openBook.id, { status: 'reading', startedAt: new Date().toISOString() });
    }
  }, [openBook, patch]);

  // Marca "última leitura" a cada abertura do reader (chave é o id, não o objeto,
  // para não reexecutar quando o patch acima atualiza a referência de openBook).
  useEffect(() => {
    if (openedBookId) {
      void patch(openedBookId, { lastOpenedAt: new Date().toISOString() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedBookId]);

  if (view.name === 'reader' && openBook) {
    return (
      <Suspense fallback={<div className="fixed inset-0 z-40 bg-paper-cream" />}>
        <PdfReader key={openBook.id} book={openBook} onClose={closeReader} initialPage={view.page} />
      </Suspense>
    );
  }

  if (view.name === 'dashboard') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-paper-cream" />}>
        <Dashboard />
      </Suspense>
    );
  }

  if (view.name === 'search') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-paper-cream" />}>
        <GlobalSearch />
      </Suspense>
    );
  }

  if (view.name === 'ai-assistant') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-paper-cream" />}>
        <AiAssistant />
      </Suspense>
    );
  }

  if (view.name === 'ai-chat') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-paper-cream" />}>
        <AiChat />
      </Suspense>
    );
  }

  return <Library />;
}
