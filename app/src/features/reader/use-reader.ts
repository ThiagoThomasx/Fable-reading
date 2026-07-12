/**
 * Controlador da Reading Surface para um livro aberto:
 * - abertura snapshot-first (o componente exibe Book.lastPageSnapshot; aqui
 *   disparamos o render real em background que o substitui);
 * - navegação página-única com cache LRU + preload N+1/N-1 (via PdfEngine);
 * - zoom com downscale/upscale de resolução de render;
 * - persistência debounced de { currentPage, lastPageSnapshot } — toca apenas
 *   a store 'books', nunca o Blob em 'files' (ver ARCHITECTURE.md).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book, ReadingSession } from '../../types/models';
import type { RenderedPage } from '../../lib/pdf/lru-cache';
import { PdfEngine } from '../../lib/pdf/pdf-engine';
import { loadFile } from '../../db/files-repo';
import { bitmapToJpegDataUrl } from '../../lib/pdf/snapshot';
import { useBookStore } from '../../stores/useBookStore';
import { useSessionStore } from '../../stores/useSessionStore';

export const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 2] as const;
const DEFAULT_ZOOM_INDEX = 1; // 100%
const BASE_CSS_WIDTH_PX = 720;
const MAX_RENDER_WIDTH_PX = 2400;
const SAVE_DEBOUNCE_MS = 1000;
/**
 * Sessões mais curtas que isso não são persistidas — filtra fechamentos
 * instantâneos (ex.: o double-invoke de efeitos do StrictMode em dev, onde o
 * reader monta/desmonta/remonta uma vez antes da abertura real).
 */
const MIN_SESSION_DURATION_MS = 3000;

export type ReaderStatus = 'opening' | 'ready' | 'error';

function renderWidthFor(zoom: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return Math.min(Math.round(BASE_CSS_WIDTH_PX * zoom * dpr), MAX_RENDER_WIDTH_PX);
}

function clampPage(page: number, total: number): number {
  return Math.min(Math.max(page, 1), Math.max(total, 1));
}

/**
 * `initialPage`: sobrescreve `book.currentPage` como página de abertura — usado pela busca
 * global (Sprint 12) para pular direto para a página de uma nota/highlight/bookmark. Ignorado
 * após a montagem inicial (não reage a mudanças).
 */
export function useReader(book: Book, initialPage?: number) {
  const [status, setStatus] = useState<ReaderStatus>('opening');
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(() => Math.max(initialPage ?? book.currentPage, 1));
  const [totalPages, setTotalPages] = useState(book.totalPages);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [isRendering, setIsRendering] = useState(false);
  const [renderedPage, setRenderedPage] = useState<RenderedPage | null>(null);

  const patchBook = useBookStore((state) => state.patch);
  const addSession = useSessionStore((state) => state.add);

  const engineRef = useRef<PdfEngine | null>(null);
  const renderSeqRef = useRef(0);
  const currentPageRef = useRef(Math.max(initialPage ?? book.currentPage, 1));
  const zoomRef = useRef<number>(ZOOM_LEVELS[DEFAULT_ZOOM_INDEX]);
  const pendingSavePageRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const sessionStartRef = useRef<{ startedAt: string; startPage: number } | null>(null);

  /**
   * Grava progresso + snapshot da página pendente. O encode do JPEG acontece
   * de forma síncrona (antes de qualquer await) para que o flush no unmount
   * termine antes de a engine ser destruída e os bitmaps fechados.
   */
  const persistProgress = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const page = pendingSavePageRef.current;
    if (page === null) return;
    pendingSavePageRef.current = null;

    const cached = engineRef.current?.getCached(page, renderWidthFor(zoomRef.current)) ?? null;
    const snapshot = cached ? bitmapToJpegDataUrl(cached.bitmap) : undefined;
    const patch = snapshot
      ? { currentPage: page, lastPageSnapshot: snapshot }
      : { currentPage: page };
    patchBook(book.id, patch).catch((persistError: unknown) => {
      // Reader pode já ter sido desmontado; registrar é o melhor que dá para fazer aqui.
      console.error('[ReadQuest] Falha ao salvar progresso', persistError);
    });
  }, [book.id, patchBook]);

  const scheduleSave = useCallback(
    (page: number) => {
      pendingSavePageRef.current = page;
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(persistProgress, SAVE_DEBOUNCE_MS);
    },
    [persistProgress],
  );

  const showPage = useCallback(
    async (page: number) => {
      const engine = engineRef.current;
      if (!engine || engine.totalPages === 0) return;
      const target = clampPage(page, engine.totalPages);
      const width = renderWidthFor(zoomRef.current);
      const seq = ++renderSeqRef.current;

      const applyPage = (rendered: RenderedPage) => {
        currentPageRef.current = target;
        setCurrentPage(target);
        setRenderedPage(rendered);
        scheduleSave(target);
        engine.preloadNext(target, width);
        engine.preloadPrev(target, width);
      };

      const cached = engine.getCached(target, width);
      if (cached) {
        applyPage(cached);
        return;
      }

      setIsRendering(true);
      try {
        const rendered = await engine.renderPage(target, width);
        if (seq !== renderSeqRef.current) return;
        applyPage(rendered);
      } catch (renderError) {
        if (seq === renderSeqRef.current) {
          setError(
            renderError instanceof Error ? renderError.message : 'Falha ao renderizar a página',
          );
        }
      } finally {
        if (seq === renderSeqRef.current) setIsRendering(false);
      }
    },
    [scheduleSave],
  );

  // Abertura do documento: Blob da store 'files' → worker isolado → página atual
  useEffect(() => {
    let cancelled = false;
    const engine = new PdfEngine();
    engineRef.current = engine;
    sessionStartRef.current = {
      startedAt: new Date().toISOString(),
      startPage: currentPageRef.current,
    };

    (async () => {
      try {
        const blob = await loadFile(book.fileRef);
        if (!blob) throw new Error('Arquivo do PDF não encontrado no dispositivo');
        const data = await blob.arrayBuffer();
        const total = await engine.open(data);
        if (cancelled) return;
        setTotalPages(total);
        setStatus('ready');
        void showPage(clampPage(currentPageRef.current, total));
      } catch (openError) {
        if (!cancelled) {
          setStatus('error');
          setError(openError instanceof Error ? openError.message : 'Falha ao abrir o PDF');
        }
      }
    })();

    return () => {
      cancelled = true;
      persistProgress(); // flush do save pendente antes de destruir a engine
      renderSeqRef.current += 1; // invalida renders em voo
      void engine.destroy();
      engineRef.current = null;

      const sessionStart = sessionStartRef.current;
      sessionStartRef.current = null;
      if (sessionStart) {
        const endedAt = new Date().toISOString();
        const durationMs = Date.parse(endedAt) - Date.parse(sessionStart.startedAt);
        if (durationMs >= MIN_SESSION_DURATION_MS) {
          const endPage = currentPageRef.current;
          const session: ReadingSession = {
            id: crypto.randomUUID(),
            bookId: book.id,
            startedAt: sessionStart.startedAt,
            endedAt,
            durationMs,
            startPage: sessionStart.startPage,
            endPage,
            pagesRead: Math.max(0, endPage - sessionStart.startPage),
            createdAt: endedAt,
            updatedAt: endedAt,
          };
          addSession(session).catch((sessionError: unknown) => {
            console.error('[ReadQuest] Falha ao salvar sessão de leitura', sessionError);
          });
        }
      }
    };
    // showPage/persistProgress/addSession são estáveis (useCallback/store action com deps estáveis)
  }, [book.id, book.fileRef, showPage, persistProgress, addSession]);

  // Zoom: re-renderiza a página atual na nova resolução (downscale/upscale).
  // Guardado por prevZoomIndexRef para não disparar quando apenas o status muda.
  const prevZoomIndexRef = useRef(zoomIndex);
  useEffect(() => {
    zoomRef.current = ZOOM_LEVELS[zoomIndex];
    if (prevZoomIndexRef.current === zoomIndex) return;
    prevZoomIndexRef.current = zoomIndex;
    if (status === 'ready') void showPage(currentPageRef.current);
  }, [zoomIndex, status, showPage]);

  const goTo = useCallback((page: number) => void showPage(page), [showPage]);
  const next = useCallback(() => void showPage(currentPageRef.current + 1), [showPage]);
  const prev = useCallback(() => void showPage(currentPageRef.current - 1), [showPage]);
  const zoomIn = useCallback(
    () => setZoomIndex((index) => Math.min(index + 1, ZOOM_LEVELS.length - 1)),
    [],
  );
  const zoomOut = useCallback(() => setZoomIndex((index) => Math.max(index - 1, 0)), []);
  const resetZoom = useCallback(() => setZoomIndex(DEFAULT_ZOOM_INDEX), []);

  return {
    status,
    error,
    currentPage,
    totalPages,
    zoom: ZOOM_LEVELS[zoomIndex],
    cssWidth: Math.round(BASE_CSS_WIDTH_PX * ZOOM_LEVELS[zoomIndex]),
    isRendering,
    renderedPage,
    isAtFirstPage: currentPage <= 1,
    isAtLastPage: totalPages > 0 && currentPage >= totalPages,
    isMinZoom: zoomIndex === 0,
    isMaxZoom: zoomIndex === ZOOM_LEVELS.length - 1,
    goTo,
    next,
    prev,
    zoomIn,
    zoomOut,
    resetZoom,
    // Exposição experimental para o spike de text layer (Sprint 8) — ref
    // estável, `.current` sempre aponta para a engine viva do documento aberto.
    engineRef,
  };
}
