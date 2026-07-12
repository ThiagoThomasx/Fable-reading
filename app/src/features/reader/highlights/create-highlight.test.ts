import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildHighlightAnnotation } from './create-highlight';

describe('buildHighlightAnnotation', () => {
  beforeEach(() => {
    let counter = 0;
    vi.stubGlobal('crypto', { randomUUID: () => `uuid-${++counter}` });
  });

  it('builds a highlight annotation from a valid single-line selection', () => {
    const rects = [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }];

    const result = buildHighlightAnnotation({
      bookId: 'book-1',
      page: 5,
      quoteText: 'Uma frase destacada',
      rects,
      color: 'yellow',
    });

    expect(result).toMatchObject({
      bookId: 'book-1',
      page: 5,
      type: 'highlight',
      color: 'yellow',
      quoteText: 'Uma frase destacada',
      textAnchor: { page: 5, text: 'Uma frase destacada', rects },
    });
    expect(result?.id).toBeTruthy();
    expect(result?.createdAt).toBe(result?.updatedAt);
  });

  it('builds a highlight annotation from a multi-line selection (multiple rects)', () => {
    const rects = [
      { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
      { x: 0.05, y: 0.26, width: 0.4, height: 0.05 },
    ];

    const result = buildHighlightAnnotation({
      bookId: 'book-1',
      page: 3,
      quoteText: 'Primeira linha\nSegunda linha',
      rects,
      color: 'green',
    });

    expect(result?.textAnchor?.rects).toHaveLength(2);
    expect(result?.quoteText).toBe('Primeira linha\nSegunda linha');
  });

  it('trims surrounding whitespace from the quote text', () => {
    const result = buildHighlightAnnotation({
      bookId: 'book-1',
      page: 1,
      quoteText: '   texto com espaços   ',
      rects: [{ x: 0, y: 0, width: 0.1, height: 0.1 }],
      color: 'blue',
    });

    expect(result?.quoteText).toBe('texto com espaços');
  });

  it('returns null for an empty/blank selection', () => {
    const result = buildHighlightAnnotation({
      bookId: 'book-1',
      page: 1,
      quoteText: '   ',
      rects: [{ x: 0, y: 0, width: 0.1, height: 0.1 }],
      color: 'yellow',
    });

    expect(result).toBeNull();
  });

  it('returns null when there are no rects', () => {
    const result = buildHighlightAnnotation({
      bookId: 'book-1',
      page: 1,
      quoteText: 'texto válido',
      rects: [],
      color: 'yellow',
    });

    expect(result).toBeNull();
  });
});
