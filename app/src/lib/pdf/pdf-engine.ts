/**
 * Engine de renderização de PDF: pdfjs-dist com worker isolado por documento,
 * renderização página-única em canvas offscreen, cache LRU de ImageBitmap e
 * pré-carregamento das páginas N+1 e N-1. Portada do spike do Sprint 0 sem
 * ajustes estruturais (worker por documento e LRU validados lá — ver
 * ROADMAP_SPRINTS.md).
 */
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { LruBitmapCache, pageKey, type RenderedPage } from './lru-cache';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const LRU_CAPACITY = 8; // dentro da faixa 5-10 definida no plano

export class PdfEngine {
  private doc: PDFDocumentProxy | null = null;
  private worker: InstanceType<typeof pdfjsLib.PDFWorker> | null = null;
  private cache = new LruBitmapCache(LRU_CAPACITY);
  // Uma entrada em voo por pageKey — permite N+1 e N-1 pré-carregarem em paralelo.
  private preloadsInFlight = new Map<string, Promise<void>>();

  get totalPages(): number {
    return this.doc?.numPages ?? 0;
  }

  /**
   * Abre o documento a partir de um ArrayBuffer (Blob lido da store 'files').
   * O buffer é transferido para o worker — não reutilizar depois da chamada.
   */
  async open(data: ArrayBuffer): Promise<number> {
    await this.destroy();
    // Worker isolado por documento (decisão de arquitetura, não compartilhado)
    this.worker = new pdfjsLib.PDFWorker();
    this.doc = await pdfjsLib.getDocument({ data, worker: this.worker }).promise;
    return this.doc.numPages;
  }

  isCached(pageNumber: number, renderWidth: number): boolean {
    return this.cache.has(pageKey(pageNumber, renderWidth));
  }

  /** Retorna do cache sem renderizar (ou null), marcando como recém-usada. */
  getCached(pageNumber: number, renderWidth: number): RenderedPage | null {
    return this.cache.get(pageKey(pageNumber, renderWidth));
  }

  /** Renderiza (ou retorna do cache) a página na largura pedida, em pixels. */
  async renderPage(pageNumber: number, renderWidth: number): Promise<RenderedPage> {
    if (!this.doc) throw new Error('Nenhum documento aberto');
    const cached = this.cache.get(pageKey(pageNumber, renderWidth));
    if (cached) return cached;

    const page = await this.doc.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = renderWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const off = document.createElement('canvas');
    off.width = Math.ceil(viewport.width);
    off.height = Math.ceil(viewport.height);
    const ctx = off.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível');

    // intent 'print': com 'display' o pdf.js agenda a continuação do render via
    // requestAnimationFrame, que não dispara em aba oculta/background — travaria
    // o preload N+1 e o render offscreen. Nossa rasterização nunca é frame-synced.
    await page.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
    const bitmap = await createImageBitmap(off);
    page.cleanup();

    const rendered: RenderedPage = { bitmap, width: off.width, height: off.height };
    this.cache.set(pageKey(pageNumber, renderWidth), rendered);
    return rendered;
  }

  /** Pré-carrega uma página em background (canvas offscreen), sem bloquear a navegação. */
  private preload(pageNumber: number, renderWidth: number): void {
    if (!this.doc) return;
    if (pageNumber < 1 || pageNumber > this.doc.numPages) return;
    const key = pageKey(pageNumber, renderWidth);
    if (this.cache.has(key) || this.preloadsInFlight.has(key)) return;
    const inFlight = this.renderPage(pageNumber, renderWidth)
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        this.preloadsInFlight.delete(key);
      });
    this.preloadsInFlight.set(key, inFlight);
  }

  /** Pré-carrega N+1 (direção mais provável de navegação). */
  preloadNext(currentPage: number, renderWidth: number): void {
    this.preload(currentPage + 1, renderWidth);
  }

  /** Pré-carrega N-1, para que "voltar" também fique instantâneo. */
  preloadPrev(currentPage: number, renderWidth: number): void {
    this.preload(currentPage - 1, renderWidth);
  }

  /**
   * Exposição experimental para o spike de text layer (Sprint 8 — ver
   * TEXT_LAYER_SPIKE.md). Não usar para renderização de canvas: apenas
   * text layer/seleção. `doc.getPage` é cacheado internamente pelo pdf.js,
   * então isso não repete parse/download de página já aberta pelo render.
   */
  async getPageForTextLayer(pageNumber: number): Promise<PDFPageProxy | null> {
    if (!this.doc) return null;
    if (pageNumber < 1 || pageNumber > this.doc.numPages) return null;
    return this.doc.getPage(pageNumber);
  }

  async destroy(): Promise<void> {
    this.cache.clear();
    this.preloadsInFlight.clear();
    if (this.doc) {
      await this.doc.destroy().catch(() => undefined);
      this.doc = null;
    }
    if (this.worker) {
      this.worker.destroy();
      this.worker = null;
    }
  }
}
