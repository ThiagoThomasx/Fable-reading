/**
 * Assistente de Leitura (Sprint 13, App Shell) — monta um bloco de prompt/contexto Markdown
 * pronto para colar em ChatGPT/Claude/NotebookLM. 100% local: carrega sessões/notas/review de
 * um livro sob demanda (mesmo padrão de EditBookDialog.buildBookMarkdown), nunca faz chamada de
 * rede nem toca o Blob do PDF. Copiar/exportar são ações explícitas do usuário — nada é enviado
 * automaticamente para nenhum serviço externo.
 */
import { useEffect, useMemo, useState } from 'react';
import { useBookStore } from '../../stores/useBookStore';
import { useSessionStore } from '../../stores/useSessionStore';
import { useNoteStore } from '../../stores/useNoteStore';
import { useReviewStore } from '../../stores/useReviewStore';
import { useUIStore } from '../../stores/useUIStore';
import { downloadMarkdownFile } from '../../lib/download-markdown';
import { sanitizeMarkdownFilename } from '../../lib/export-markdown';
import type { ReadingSession, ReadingAnnotation, BookReview } from '../../types/models';
import {
  generateAiContext,
  AI_CONTEXT_SECTION_ORDER,
  AI_SECTION_LABELS,
  AI_PROMPT_TYPE_ORDER,
  AI_PROMPT_TYPE_LABELS,
  type AiContextSection,
  type AiPromptType,
} from '../../lib/ai-context';

const DEFAULT_SECTIONS: AiContextSection[] = [
  'metadata',
  'review',
  'takeaways',
  'highlights',
  'notes',
];

type BookData = {
  sessions: ReadingSession[];
  annotations: ReadingAnnotation[];
  review: BookReview | undefined;
};

export function AiAssistant() {
  const books = useBookStore((state) => state.books);
  const isBooksLoaded = useBookStore((state) => state.isLoaded);
  const loadBooks = useBookStore((state) => state.load);
  const loadSessionsForBook = useSessionStore((state) => state.loadForBook);
  const loadNotesForBook = useNoteStore((state) => state.loadForBook);
  const loadReviewForBook = useReviewStore((state) => state.loadForBook);
  const openLibrary = useUIStore((state) => state.openLibrary);

  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [sections, setSections] = useState<Set<AiContextSection>>(new Set(DEFAULT_SECTIONS));
  const [promptType, setPromptType] = useState<AiPromptType>('discussion');
  const [bookData, setBookData] = useState<BookData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    if (!selectedBookId) {
      setBookData(null);
      return;
    }
    let cancelled = false;
    setIsLoadingData(true);
    setLoadError(null);
    setCopyFeedback(null);
    Promise.all([
      loadSessionsForBook(selectedBookId),
      loadNotesForBook(selectedBookId),
      loadReviewForBook(selectedBookId),
    ])
      .then(() => {
        if (cancelled) return;
        setBookData({
          sessions: useSessionStore.getState().sessions,
          annotations: useNoteStore.getState().annotations,
          review: useReviewStore.getState().review ?? undefined,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : 'Falha ao carregar dados do livro.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBookId, loadSessionsForBook, loadNotesForBook, loadReviewForBook]);

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) ?? null,
    [books, selectedBookId],
  );

  const contextText = useMemo(() => {
    if (!selectedBook || !bookData) return '';
    return generateAiContext({
      book: selectedBook,
      sessions: bookData.sessions,
      annotations: bookData.annotations,
      review: bookData.review,
      sections: Array.from(sections),
      promptType,
    });
  }, [selectedBook, bookData, sections, promptType]);

  const toggleSection = (section: AiContextSection) => {
    setSections((current) => {
      const next = new Set(current);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const onCopy = async () => {
    if (!contextText) return;
    try {
      await navigator.clipboard.writeText(contextText);
      setCopyFeedback('Copiado para a área de transferência.');
    } catch {
      setCopyFeedback('Não foi possível copiar automaticamente — selecione e copie o texto manualmente.');
    }
  };

  const onExport = () => {
    if (!contextText || !selectedBook) return;
    const filename = sanitizeMarkdownFilename(`ai-${selectedBook.title}`);
    downloadMarkdownFile(filename, contextText);
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
            Leve sua leitura
            <br />
            para qualquer IA.
          </h1>
          <p className="mt-5 max-w-md text-pure-white/80">
            Monte um bloco de contexto a partir dos seus dados locais e cole em ChatGPT, Claude ou
            NotebookLM. Nada é enviado automaticamente — a cópia é sempre manual.
          </p>
        </div>
      </section>

      <section className="bg-paper-cream px-6 py-12 md:px-12">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[minmax(0,320px)_1fr]">
          <div className="space-y-6">
            <div>
              <label htmlFor="ai-book-select" className="mb-2 block text-sm font-medium text-ink">
                Livro
              </label>
              {!isBooksLoaded ? (
                <p className="text-sm text-graphite">Carregando biblioteca…</p>
              ) : (
                <select
                  id="ai-book-select"
                  value={selectedBookId}
                  onChange={(event) => setSelectedBookId(event.target.value)}
                  className="w-full rounded-md border border-ink/15 bg-pure-white px-3 py-2 text-sm text-ink outline-none"
                >
                  <option value="">Selecione um livro…</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-ink">Incluir</span>
              <ul className="space-y-2">
                {AI_CONTEXT_SECTION_ORDER.map((section) => (
                  <li key={section}>
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={sections.has(section)}
                        onChange={() => toggleSection(section)}
                      />
                      {AI_SECTION_LABELS[section]}
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label htmlFor="ai-prompt-type" className="mb-2 block text-sm font-medium text-ink">
                Tipo de prompt
              </label>
              <select
                id="ai-prompt-type"
                value={promptType}
                onChange={(event) => setPromptType(event.target.value as AiPromptType)}
                className="w-full rounded-md border border-ink/15 bg-pure-white px-3 py-2 text-sm text-ink outline-none"
              >
                {AI_PROMPT_TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {AI_PROMPT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {!selectedBookId && (
              <p className="text-graphite">Selecione um livro para gerar o contexto.</p>
            )}
            {selectedBookId && isLoadingData && <p className="text-graphite">Carregando dados do livro…</p>}
            {loadError && <p className="text-red-600">{loadError}</p>}

            {selectedBookId && !isLoadingData && !loadError && (
              <>
                <textarea
                  readOnly
                  value={contextText}
                  aria-label="Prévia do contexto gerado"
                  className="h-96 w-full resize-none rounded-xl border border-ink/15 bg-pure-white p-4 font-mono text-xs text-ink outline-none"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onCopy}
                    className="rounded-pill bg-fable-forest px-5 py-2 text-sm font-medium text-pure-white shadow-lift transition-transform hover:-translate-y-0.5"
                  >
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={onExport}
                    className="rounded-pill border border-ink/15 bg-pure-white px-5 py-2 text-sm font-medium text-ink transition-transform hover:-translate-y-0.5"
                  >
                    Exportar .md
                  </button>
                  {copyFeedback && <span className="text-sm text-graphite">{copyFeedback}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
