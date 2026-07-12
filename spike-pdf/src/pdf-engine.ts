/**
 * Engine mínima do spike: pdfjs-dist com worker isolado por documento,
 * renderização página-única em canvas offscreen, cache LRU de ImageBitmap
 * e pré-carregamento da página N+1.
 *
 * Espelha as decisões de ARCHITECTURE.md sem nenhuma UI de produto.
 */
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const LRU_CAPACITY = 8; // dentro da faixa 5-10 definida no plano
const TARGET_PAGE_WIDTH_PX = 900;

export type RenderedPage = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
};

export type OpenResult = {
  totalPages: number;
  /** ms entre getDocument() e a 1ª página desenhada no canvas visível */
  openToFirstRenderMs: number;
  /** breakdown da abertura, para diagnóstico */
  breakdown: {
    workerBootAndParseMs: number; // new PDFWorker + getDocument (parse do xref)
    firstPageRenderMs: number; // getPage(1) + render + bitmap
  };
};

export class PdfEngine {
  private doc: PDFDocumentProxy | null = null;
  private worker: InstanceType<typeof pdfjsLib.PDFWorker> | null = null;
  private cache = new Map<number, RenderedPage>(); // LRU: ordem de inserção = idade
  private preloadInFlight: Promise<void> | null = null;

  get totalPages(): number {
    return this.doc?.numPages ?? 0;
  }

  isCached(pageNumber: number): boolean {
    return this.cache.has(pageNumber);
  }

  /**
   * Abre o documento a partir de um ArrayBuffer (equivalente ao Blob lido
   * do IndexedDB no app real) e renderiza a 1ª página no canvas alvo.
   */
  async open(data: ArrayBuffer, canvas: HTMLCanvasElement): Promise<OpenResult> {
    await this.destroy();
    // Worker isolado por documento (decisão de arquitetura, não compartilhado)
    this.worker = new pdfjsLib.PDFWorker({ name: `spike-doc-${Date.now()}` });

    const t0 = performance.now();
    this.doc = await pdfjsLib.getDocument({ data, worker: this.worker }).promise;
    const tParsed = performance.now();
    const first = await this.renderPageToCache(1);
    this.drawToCanvas(first, canvas);
    const tRendered = performance.now();

    return {
      totalPages: this.doc.numPages,
      openToFirstRenderMs: tRendered - t0,
      breakdown: {
        workerBootAndParseMs: tParsed - t0,
        firstPageRenderMs: tRendered - tParsed,
      },
    };
  }

  /**
   * Exibe uma página no canvas. Retorna o tempo até estar visível e se
   * veio do cache. Dispara o preload de N+1 em background.
   */
  async showPage(
    pageNumber: number,
    canvas: HTMLCanvasElement,
  ): Promise<{ displayMs: number; fromCache: boolean }> {
    if (!this.doc) throw new Error('Nenhum documento aberto');
    const fromCache = this.cache.has(pageNumber);

    const t0 = performance.now();
    const page = fromCache
      ? this.touchCache(pageNumber)
      : await this.renderPageToCache(pageNumber);
    this.drawToCanvas(page, canvas);
    const displayMs = performance.now() - t0;

    this.preloadNext(pageNumber);
    return { displayMs, fromCache };
  }

  /** Pré-carrega N+1 em background (canvas offscreen), sem bloquear a navegação. */
  preloadNext(currentPage: number): void {
    if (!this.doc) return;
    const next = currentPage + 1;
    if (next > this.doc.numPages || this.cache.has(next) || this.preloadInFlight) return;
    this.preloadInFlight = this.renderPageToCache(next)
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        this.preloadInFlight = null;
      });
  }

  /** Aguarda um preload em andamento terminar (usado só pelo benchmark). */
  async waitForPreload(): Promise<void> {
    if (this.preloadInFlight) await this.preloadInFlight;
  }

  async destroy(): Promise<void> {
    for (const page of this.cache.values()) page.bitmap.close();
    this.cache.clear();
    this.preloadInFlight = null;
    if (this.doc) {
      await this.doc.destroy().catch(() => undefined);
      this.doc = null;
    }
    if (this.worker) {
      this.worker.destroy();
      this.worker = null;
    }
  }

  private async renderPageToCache(pageNumber: number): Promise<RenderedPage> {
    if (!this.doc) throw new Error('Nenhum documento aberto');
    const cached = this.cache.get(pageNumber);
    if (cached) return this.touchCache(pageNumber);

    const page = await this.doc.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = TARGET_PAGE_WIDTH_PX / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const off = document.createElement('canvas');
    off.width = Math.ceil(viewport.width);
    off.height = Math.ceil(viewport.height);
    const ctx = off.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível');

    await page.render({ canvasContext: ctx, viewport }).promise;
    const bitmap = await createImageBitmap(off);
    page.cleanup();

    const rendered: RenderedPage = { bitmap, width: off.width, height: off.height };
    this.putInCache(pageNumber, rendered);
    return rendered;
  }

  private drawToCanvas(page: RenderedPage, canvas: HTMLCanvasElement): void {
    canvas.width = page.width;
    canvas.height = page.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível');
    ctx.drawImage(page.bitmap, 0, 0);
  }

  private putInCache(pageNumber: number, page: RenderedPage): void {
    if (this.cache.size >= LRU_CAPACITY) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.get(oldest)?.bitmap.close();
        this.cache.delete(oldest);
      }
    }
    this.cache.set(pageNumber, page);
  }

  /** Marca a página como recém-usada no LRU e a retorna. */
  private touchCache(pageNumber: number): RenderedPage {
    const page = this.cache.get(pageNumber);
    if (!page) throw new Error(`Página ${pageNumber} não está no cache`);
    this.cache.delete(pageNumber);
    this.cache.set(pageNumber, page);
    return page;
  }
}
