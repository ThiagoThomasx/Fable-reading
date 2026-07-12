/**
 * Reading Surface — minimalista por decisão de design (ver CLAUDE.md):
 * fundo paper-cream (ou dark, ver tema), sem bandas/ilustrações/headlines de
 * display. Abertura snapshot-first: exibe Book.lastPageSnapshot no primeiro
 * paint e o troca pelo render real do pdf.js via crossfade curto, sem flash.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnnotationColor, Book, ReadingTheme } from '../../types/models';
import { useReader } from './use-reader';
import { ReaderTopBar } from './ReaderTopBar';
import { NotesSidePanel } from './NotesSidePanel';
import { useBookStore } from '../../stores/useBookStore';
import { useNoteStore } from '../../stores/useNoteStore';
import { TextLayerOverlay } from './highlights/TextLayerOverlay';
import { HighlightMarks } from './highlights/HighlightMarks';
import { SelectionToolbar } from './highlights/SelectionToolbar';
import { buildHighlightAnnotation, type SelectionCapture } from './highlights/create-highlight';

type PdfReaderProps = {
  book: Book;
  onClose: () => void;
  /** Página de abertura sobrescrita — usada pela busca global (Sprint 12) para pular para uma anotação específica. */
  initialPage?: number;
};

// Deve bater com a largura do <aside> em NotesSidePanel.tsx (max-w-xs = 20rem):
// reserva o espaço em vez de sobrepor o painel à página, senão a hit-zone de
// "próxima página" fica coberta e inclicável em viewports estreitos.
export const NOTES_PANEL_WIDTH_PX = 320;

type SnapshotPhase = 'visible' | 'fading' | 'gone';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export default function PdfReader({ book, onClose, initialPage }: PdfReaderProps) {
  const reader = useReader(book, initialPage);
  const patchBook = useBookStore((state) => state.patch);
  const annotations = useNoteStore((state) => state.annotations);
  const notesLoadedBookId = useNoteStore((state) => state.loadedBookId);
  const loadAnnotationsForBook = useNoteStore((state) => state.loadForBook);
  const toggleBookmark = useNoteStore((state) => state.toggleBookmark);
  const addAnnotation = useNoteStore((state) => state.add);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  // Modo seleção/highlight (Sprint 9) — monta o text layer sob demanda, ver ARCHITECTURE.md.
  const [isSelectModeActive, setIsSelectModeActive] = useState(false);
  const [selectionCapture, setSelectionCapture] = useState<SelectionCapture | null>(null);
  const [highlightBoxSize, setHighlightBoxSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [theme, setTheme] = useState<ReadingTheme>(book.readingTheme ?? 'paper');
  // Congela o snapshot da abertura: saves durante a leitura não devem trocar o <img>
  const initialSnapshot = useRef(book.lastPageSnapshot).current;
  const [snapshotPhase, setSnapshotPhase] = useState<SnapshotPhase>(
    initialSnapshot ? 'visible' : 'gone',
  );

  // Desenha o bitmap renderizado no canvas e inicia o crossfade do snapshot
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!reader.renderedPage || !canvas) return;
    canvas.width = reader.renderedPage.width;
    canvas.height = reader.renderedPage.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(reader.renderedPage.bitmap, 0, 0);
    setHasDrawn(true);
    setSnapshotPhase((phase) => (phase === 'visible' ? 'fading' : phase));
  }, [reader.renderedPage]);

  // Fallback do crossfade: em aba oculta a animação CSS fica suspensa e o
  // onAnimationEnd nunca dispara — força o fim da fase 'fading' após 600ms.
  useEffect(() => {
    if (snapshotPhase !== 'fading') return;
    const timer = window.setTimeout(() => setSnapshotPhase('gone'), 600);
    return () => window.clearTimeout(timer);
  }, [snapshotPhase]);

  // Transição sutil de virada de página: restart de animação via classList
  // (não via key/remount, que recriaria o canvas e causaria flash). Pulado
  // no primeiro draw — esse já tem o crossfade do snapshot.
  const prevPageRef = useRef<number | null>(null);
  useEffect(() => {
    const el = pageWrapperRef.current;
    if (!el || !hasDrawn) return;
    if (prevPageRef.current !== null && prevPageRef.current !== reader.currentPage) {
      el.classList.remove('page-turn');
      void el.offsetWidth; // força reflow para reiniciar a animação
      el.classList.add('page-turn');
    }
    prevPageRef.current = reader.currentPage;
  }, [reader.currentPage, hasDrawn]);

  // Anotações carregadas sob demanda ao abrir o livro — alimenta o indicador
  // discreto na topbar e o painel lateral (ver NotesSidePanel).
  useEffect(() => {
    void loadAnnotationsForBook(book.id);
  }, [book.id, loadAnnotationsForBook]);

  // Dimensões reais da caixa da página (varia com zoom/resize) — usadas para
  // converter os rects relativos dos highlights salvos de volta a pixels.
  useEffect(() => {
    const el = pageWrapperRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setHighlightBoxSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Navegar de página sai do modo seleção (regra da Sprint 9) — evita manter
  // um text layer montado para uma página que o usuário já deixou.
  const prevPageForSelectRef = useRef(reader.currentPage);
  useEffect(() => {
    if (prevPageForSelectRef.current === reader.currentPage) return;
    prevPageForSelectRef.current = reader.currentPage;
    if (isSelectModeActive) {
      setIsSelectModeActive(false);
      setSelectionCapture(null);
    }
  }, [reader.currentPage, isSelectModeActive]);

  const bookAnnotations = notesLoadedBookId === book.id ? annotations : [];
  const hasPageAnnotation = useMemo(
    () => bookAnnotations.some((annotation) => annotation.page === reader.currentPage),
    [bookAnnotations, reader.currentPage],
  );

  const toggleFocus = useCallback(() => {
    setFocusMode((enabled) => {
      const next = !enabled;
      // Entrar em foco fecha o painel de notas e sai do modo seleção — evita
      // disputar espaço com a topbar reduzida (ver Sprint 7) e mantém a regra
      // de saída do modo seleção da Sprint 9.
      if (next) {
        setIsNotesOpen(false);
        setIsSelectModeActive(false);
        setSelectionCapture(null);
      }
      return next;
    });
  }, []);

  const toggleNotes = useCallback(() => {
    setIsNotesOpen((open) => !open);
  }, []);

  const toggleSelectMode = useCallback(() => {
    setIsSelectModeActive((active) => {
      const next = !active;
      if (!next) setSelectionCapture(null);
      return next;
    });
  }, []);

  const handleSelectionCapture = useCallback((capture: SelectionCapture | null) => {
    setSelectionCapture(capture);
  }, []);

  const handlePickHighlightColor = useCallback(
    (color: AnnotationColor) => {
      if (!selectionCapture) return;
      const annotation = buildHighlightAnnotation({
        bookId: book.id,
        page: selectionCapture.page,
        quoteText: selectionCapture.text,
        rects: selectionCapture.rects,
        color,
      });
      setSelectionCapture(null);
      window.getSelection()?.removeAllRanges();
      if (!annotation) return;
      addAnnotation(annotation).catch((addError: unknown) => {
        console.error('[ReadQuest] Falha ao criar highlight', addError);
      });
    },
    [selectionCapture, book.id, addAnnotation],
  );

  const toggleBookmarkShortcut = useCallback(() => {
    toggleBookmark(book.id, reader.currentPage).catch((toggleError: unknown) => {
      console.error('[ReadQuest] Falha ao alternar marcação', toggleError);
    });
  }, [book.id, reader.currentPage, toggleBookmark]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: ReadingTheme = current === 'paper' ? 'dark' : 'paper';
      patchBook(book.id, { readingTheme: next }).catch((persistError: unknown) => {
        console.error('[ReadQuest] Falha ao salvar tema de leitura', persistError);
      });
      return next;
    });
  }, [book.id, patchBook]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      switch (event.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
          event.preventDefault();
          reader.next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault();
          reader.prev();
          break;
        case '+':
        case '=':
          reader.zoomIn();
          break;
        case '-':
          reader.zoomOut();
          break;
        case '0':
          reader.resetZoom();
          break;
        case 'f':
        case 'F':
          toggleFocus();
          break;
        case 'd':
        case 'D':
          toggleTheme();
          break;
        case 'n':
        case 'N':
          toggleNotes();
          break;
        case 'b':
        case 'B':
          toggleBookmarkShortcut();
          break;
        case 't':
        case 'T':
          toggleSelectMode();
          break;
        case 'Escape':
          if (isSelectModeActive) {
            setIsSelectModeActive(false);
            setSelectionCapture(null);
          } else if (isNotesOpen) setIsNotesOpen(false);
          else if (focusMode) setFocusMode(false);
          else onClose();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    reader,
    toggleFocus,
    toggleTheme,
    toggleNotes,
    toggleBookmarkShortcut,
    toggleSelectMode,
    onClose,
    focusMode,
    isNotesOpen,
    isSelectModeActive,
  ]);

  if (reader.status === 'error') {
    return (
      <div
        className={`fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 px-6 text-center ${theme === 'dark' ? 'reader-dark' : ''}`}
        style={{ backgroundColor: 'var(--reader-bg)' }}
      >
        <p className="text-lg" style={{ color: 'var(--reader-ink)' }}>
          Não foi possível abrir este livro.
        </p>
        <p className="max-w-md text-sm" style={{ color: 'var(--reader-ink-70)' }}>
          {reader.error}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-pill px-7 py-3 font-medium shadow-lift"
          style={{ backgroundColor: 'var(--reader-ink)', color: 'var(--reader-bg)' }}
        >
          Voltar à biblioteca
        </button>
      </div>
    );
  }

  const showInFlowSnapshot = !hasDrawn && Boolean(initialSnapshot);
  const showInFlowSkeleton = !hasDrawn && !initialSnapshot;
  const showOverlaySnapshot = hasDrawn && snapshotPhase === 'fading' && Boolean(initialSnapshot);
  const showRenderOverlay = hasDrawn && reader.isRendering;
  const progress = reader.totalPages > 0 ? (reader.currentPage / reader.totalPages) * 100 : 0;

  return (
    <div
      className={`fixed inset-0 z-40 overflow-auto transition-[padding-right] duration-200 ease-out ${theme === 'dark' ? 'reader-dark' : ''} ${isNotesOpen ? 'notes-open' : ''}`}
      style={{
        backgroundColor: 'var(--reader-bg)',
        ['--notes-panel-width' as string]: `${NOTES_PANEL_WIDTH_PX}px`,
      }}
    >
      {!focusMode && (
        <ReaderTopBar
          title={book.title}
          zoom={reader.zoom}
          isMinZoom={reader.isMinZoom}
          isMaxZoom={reader.isMaxZoom}
          theme={theme}
          progress={progress}
          hasPageAnnotation={hasPageAnnotation}
          isNotesOpen={isNotesOpen}
          isSelectModeActive={isSelectModeActive}
          onClose={onClose}
          onZoomIn={reader.zoomIn}
          onZoomOut={reader.zoomOut}
          onToggleFocus={toggleFocus}
          onToggleTheme={toggleTheme}
          onToggleNotes={toggleNotes}
          onToggleSelectMode={toggleSelectMode}
        />
      )}
      {isNotesOpen && (
        <NotesSidePanel
          bookId={book.id}
          currentPage={reader.currentPage}
          annotations={bookAnnotations}
          onClose={() => setIsNotesOpen(false)}
          onGoToPage={reader.goTo}
        />
      )}
      {focusMode && reader.totalPages > 0 && (
        <div
          className="fixed inset-x-0 top-0 z-10 h-[2px]"
          style={{ backgroundColor: 'var(--reader-border)' }}
        >
          <div
            className="h-full transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%`, backgroundColor: 'var(--reader-ink-25)' }}
          />
        </div>
      )}

      <div className="relative mx-auto px-4 py-8" style={{ width: reader.cssWidth + 32 }}>
        <div
          ref={pageWrapperRef}
          className="relative shadow-cover"
          style={{ width: reader.cssWidth, backgroundColor: 'var(--reader-page-bg)' }}
        >
          {showInFlowSnapshot && (
            <img src={initialSnapshot} alt="" className="block w-full select-none" />
          )}
          {showInFlowSkeleton && (
            <div className="aspect-[7/10] w-full" style={{ backgroundColor: 'var(--reader-bg)' }} />
          )}
          <canvas
            ref={canvasRef}
            className={hasDrawn ? 'block h-auto w-full select-none' : 'hidden'}
          />
          {showOverlaySnapshot && (
            <img
              src={initialSnapshot}
              alt=""
              onAnimationEnd={() => setSnapshotPhase('gone')}
              className="snapshot-fading pointer-events-none absolute inset-0 w-full select-none"
            />
          )}
          {showRenderOverlay && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundColor: 'var(--reader-bg)' }}
            />
          )}

          <button
            type="button"
            aria-label="Página anterior"
            onClick={reader.prev}
            disabled={reader.isAtFirstPage}
            className={`group absolute inset-y-0 left-0 w-1/3 cursor-w-resize disabled:cursor-default ${isSelectModeActive ? 'pointer-events-none' : ''}`}
          >
            <span
              aria-hidden="true"
              className="absolute left-2 top-1/2 -translate-y-1/2 text-2xl opacity-0 transition-opacity duration-150 group-hover:opacity-30 group-disabled:!opacity-0"
              style={{ color: 'var(--reader-ink)' }}
            >
              ‹
            </span>
          </button>
          <button
            type="button"
            aria-label="Próxima página"
            onClick={reader.next}
            disabled={reader.isAtLastPage}
            className={`group absolute inset-y-0 right-0 w-1/3 cursor-e-resize disabled:cursor-default ${isSelectModeActive ? 'pointer-events-none' : ''}`}
          >
            <span
              aria-hidden="true"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-2xl opacity-0 transition-opacity duration-150 group-hover:opacity-30 group-disabled:!opacity-0"
              style={{ color: 'var(--reader-ink)' }}
            >
              ›
            </span>
          </button>

          <HighlightMarks
            annotations={bookAnnotations}
            currentPage={reader.currentPage}
            boxSize={highlightBoxSize}
          />

          {isSelectModeActive && (
            <TextLayerOverlay
              engine={reader.engineRef.current}
              pageNumber={reader.currentPage}
              cssWidth={reader.cssWidth}
              active={isSelectModeActive}
              onSelectionCapture={handleSelectionCapture}
            />
          )}
        </div>
      </div>

      {isSelectModeActive && selectionCapture && (
        <SelectionToolbar
          position={{
            top: selectionCapture.anchorClientRect.bottom + 8,
            left: selectionCapture.anchorClientRect.left,
          }}
          onPick={handlePickHighlightColor}
        />
      )}

      {!focusMode && reader.totalPages > 0 && (
        <p
          className="pointer-events-none fixed inset-x-0 bottom-3 text-center text-sm"
          style={{ color: 'var(--reader-ink-50)' }}
        >
          Página {reader.currentPage} de {reader.totalPages} · {Math.round(progress)}%
        </p>
      )}
    </div>
  );
}
