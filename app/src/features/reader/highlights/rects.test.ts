import { describe, it, expect } from 'vitest';
import { toRelativeRects, sortRectsReadingOrder, relativeRectToPixelStyle } from './rects';

describe('toRelativeRects', () => {
  it('converts absolute rects to 0..1 relative coordinates', () => {
    // Arrange
    const container = { left: 100, top: 200, width: 400, height: 800 };
    const rects = [{ left: 200, top: 400, width: 100, height: 40 }];

    // Act
    const result = toRelativeRects(rects, container);

    // Assert
    expect(result).toEqual([{ x: 0.25, y: 0.25, width: 0.25, height: 0.05 }]);
  });

  it('returns empty array when container has zero size', () => {
    expect(
      toRelativeRects([{ left: 0, top: 0, width: 10, height: 10 }], {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
      }),
    ).toEqual([]);
  });

  it('filters out zero-size rects', () => {
    const container = { left: 0, top: 0, width: 100, height: 100 };
    const rects = [
      { left: 10, top: 10, width: 0, height: 20 },
      { left: 10, top: 10, width: 20, height: 0 },
      { left: 10, top: 10, width: 20, height: 20 },
    ];

    const result = toRelativeRects(rects, container);

    expect(result).toEqual([{ x: 0.1, y: 0.1, width: 0.2, height: 0.2 }]);
  });

  it('returns empty array for empty selection (no rects)', () => {
    const container = { left: 0, top: 0, width: 100, height: 100 };
    expect(toRelativeRects([], container)).toEqual([]);
  });
});

describe('sortRectsReadingOrder', () => {
  it('sorts multi-line rects top-to-bottom then left-to-right', () => {
    // Arrange — segunda linha aparece antes da primeira no array de entrada
    const rects = [
      { x: 0.5, y: 0.3, width: 0.1, height: 0.05 },
      { x: 0.1, y: 0.1, width: 0.1, height: 0.05 },
      { x: 0.05, y: 0.1, width: 0.1, height: 0.05 },
    ];

    // Act
    const result = sortRectsReadingOrder(rects);

    // Assert
    expect(result.map((r) => r.x)).toEqual([0.05, 0.1, 0.5]);
  });

  it('treats near-equal y as the same line (within tolerance)', () => {
    const rects = [
      { x: 0.5, y: 0.10001, width: 0.1, height: 0.05 },
      { x: 0.1, y: 0.1, width: 0.1, height: 0.05 },
    ];

    const result = sortRectsReadingOrder(rects);

    expect(result.map((r) => r.x)).toEqual([0.1, 0.5]);
  });
});

describe('relativeRectToPixelStyle', () => {
  it('converts a relative rect back to absolute pixels for a given box size', () => {
    const rect = { x: 0.25, y: 0.5, width: 0.25, height: 0.05 };
    const box = { width: 400, height: 800 };

    const result = relativeRectToPixelStyle(rect, box);

    expect(result).toEqual({ left: 100, top: 400, width: 100, height: 40 });
  });
});
