/**
 * Transformação pura de uma seleção de texto capturada no text layer em uma
 * `ReadingAnnotation` do tipo `highlight`. Não toca em store/IndexedDB —
 * quem chama decide como persistir (ver PdfReader.tsx).
 */
import type { AnnotationColor, ReadingAnnotation } from '../../../types/models';
import type { RelativeRect } from './rects';

export type SelectionCapture = {
  page: number;
  text: string;
  rects: RelativeRect[];
  /** Posição (viewport) do último rect da seleção — usado para posicionar a mini toolbar. */
  anchorClientRect: { top: number; left: number; bottom: number; right: number };
};

export function buildHighlightAnnotation(params: {
  bookId: string;
  page: number;
  quoteText: string;
  rects: RelativeRect[];
  color: AnnotationColor;
}): ReadingAnnotation | null {
  const trimmed = params.quoteText.trim();
  if (!trimmed || params.rects.length === 0) return null;

  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    bookId: params.bookId,
    page: params.page,
    type: 'highlight',
    color: params.color,
    quoteText: trimmed,
    textAnchor: { page: params.page, text: trimmed, rects: params.rects },
    createdAt: now,
    updatedAt: now,
  };
}
