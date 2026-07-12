/**
 * Helpers puros para normalizar rects de seleção de texto em coordenadas
 * relativas à página — formato de persistência de
 * `ReadingAnnotation.textAnchor.rects`. Relativo (0..1) é a escolha usada
 * porque sobrevive a zoom/resize sem recomputar contra o viewport original: o
 * consumidor multiplica pela largura/altura atual da página (ver
 * `relativeRectToPixelStyle`, usado por `HighlightMarks`).
 */
export type RelativeRect = { x: number; y: number; width: number; height: number };

export function toRelativeRects(
  rects: readonly Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>[],
  container: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): RelativeRect[] {
  if (container.width === 0 || container.height === 0) return [];
  return rects
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      x: (rect.left - container.left) / container.width,
      y: (rect.top - container.top) / container.height,
      width: rect.width / container.width,
      height: rect.height / container.height,
    }));
}

/** Ordem de leitura: topo→baixo, depois esquerda→direita — estabiliza seleções multi-linha. */
export function sortRectsReadingOrder(rects: readonly RelativeRect[]): RelativeRect[] {
  return [...rects].sort((a, b) => (Math.abs(a.y - b.y) > 0.001 ? a.y - b.y : a.x - b.x));
}

/** Converte um rect relativo (0..1) de volta a pixels absolutos dentro de uma caixa de dimensões conhecidas. */
export function relativeRectToPixelStyle(
  rect: RelativeRect,
  box: { width: number; height: number },
): { left: number; top: number; width: number; height: number } {
  return {
    left: rect.x * box.width,
    top: rect.y * box.height,
    width: rect.width * box.width,
    height: rect.height * box.height,
  };
}
