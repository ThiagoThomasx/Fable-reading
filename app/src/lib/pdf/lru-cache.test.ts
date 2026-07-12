import { describe, it, expect, vi } from 'vitest';
import { LruBitmapCache, pageKey, type RenderedPage } from './lru-cache';

function fakePage(): RenderedPage {
  return {
    bitmap: { close: vi.fn() } as unknown as ImageBitmap,
    width: 900,
    height: 1200,
  };
}

describe('pageKey', () => {
  it('combines page number and render width', () => {
    expect(pageKey(12, 900)).toBe('12@900');
  });
});

describe('LruBitmapCache', () => {
  it('stores and retrieves entries up to capacity', () => {
    // Arrange
    const cache = new LruBitmapCache(3);
    const page = fakePage();

    // Act
    cache.set('1@900', page);

    // Assert
    expect(cache.has('1@900')).toBe(true);
    expect(cache.get('1@900')).toBe(page);
    expect(cache.size).toBe(1);
  });

  it('evicts the oldest entry and closes its bitmap when full', () => {
    // Arrange
    const cache = new LruBitmapCache(2);
    const first = fakePage();
    cache.set('1@900', first);
    cache.set('2@900', fakePage());

    // Act
    cache.set('3@900', fakePage());

    // Assert
    expect(cache.has('1@900')).toBe(false);
    expect(first.bitmap.close).toHaveBeenCalledOnce();
    expect(cache.size).toBe(2);
  });

  it('refreshes recency on get, protecting the entry from eviction', () => {
    // Arrange
    const cache = new LruBitmapCache(2);
    const first = fakePage();
    const second = fakePage();
    cache.set('1@900', first);
    cache.set('2@900', second);

    // Act — toca a 1 (vira a mais recente) e insere a 3 (deve evictar a 2)
    cache.get('1@900');
    cache.set('3@900', fakePage());

    // Assert
    expect(cache.has('1@900')).toBe(true);
    expect(cache.has('2@900')).toBe(false);
    expect(second.bitmap.close).toHaveBeenCalledOnce();
  });

  it('replaces an existing key without evicting others', () => {
    // Arrange
    const cache = new LruBitmapCache(2);
    cache.set('1@900', fakePage());
    cache.set('2@900', fakePage());

    // Act — mesma chave em outra "versão"
    cache.set('2@900', fakePage());

    // Assert
    expect(cache.size).toBe(2);
    expect(cache.has('1@900')).toBe(true);
  });

  it('returns null for a missing key', () => {
    const cache = new LruBitmapCache(2);
    expect(cache.get('9@900')).toBeNull();
  });

  it('closes every bitmap on clear', () => {
    // Arrange
    const cache = new LruBitmapCache(3);
    const pages = [fakePage(), fakePage()];
    cache.set('1@900', pages[0]);
    cache.set('2@900', pages[1]);

    // Act
    cache.clear();

    // Assert
    expect(cache.size).toBe(0);
    for (const page of pages) expect(page.bitmap.close).toHaveBeenCalledOnce();
  });

  it('rejects capacity below 1', () => {
    expect(() => new LruBitmapCache(0)).toThrow();
  });
});
