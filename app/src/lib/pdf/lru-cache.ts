/**
 * Cache LRU de páginas renderizadas (ImageBitmap). Estrutura validada no
 * spike do Sprint 0 (spike-pdf/) — ordem de inserção do Map = idade.
 * Bitmaps evictados são fechados para liberar memória GPU/RAM.
 */

export type RenderedPage = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
};

export function pageKey(pageNumber: number, renderWidth: number): string {
  return `${pageNumber}@${renderWidth}`;
}

export class LruBitmapCache {
  private map = new Map<string, RenderedPage>();

  constructor(private readonly capacity: number) {
    if (capacity < 1) {
      throw new Error('Capacidade do LRU deve ser >= 1');
    }
  }

  get size(): number {
    return this.map.size;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  /** Retorna a entrada e a marca como recém-usada (move para o fim da fila). */
  get(key: string): RenderedPage | null {
    const page = this.map.get(key);
    if (!page) return null;
    this.map.delete(key);
    this.map.set(key, page);
    return page;
  }

  /** Insere a entrada, evictando (e fechando) a mais antiga se estiver cheio. */
  set(key: string, page: RenderedPage): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) {
        this.map.get(oldest)?.bitmap.close();
        this.map.delete(oldest);
      }
    }
    this.map.set(key, page);
  }

  /** Fecha todos os bitmaps e esvazia o cache. */
  clear(): void {
    for (const page of this.map.values()) {
      page.bitmap.close();
    }
    this.map.clear();
  }
}
