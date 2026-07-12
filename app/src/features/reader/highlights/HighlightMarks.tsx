/**
 * Camada visual (React puro, fora do container controlado pelo pdf.js) que
 * desenha os highlights já salvos da página atual como retângulos coloridos
 * sobre o canvas. Sempre `pointer-events: none` — nunca bloqueia hotzones,
 * seleção ou cliques da página. Independe do text layer/modo seleção: só
 * precisa dos rects relativos já persistidos, então pode ficar ativa também
 * fora do modo seleção sem custo de extração de texto.
 */
import type { ReadingAnnotation } from '../../../types/models';
import { relativeRectToPixelStyle } from './rects';
import { HIGHLIGHT_COLOR_FILL } from './colors';

type HighlightMarksProps = {
  annotations: ReadingAnnotation[];
  currentPage: number;
  boxSize: { width: number; height: number } | null;
};

export function HighlightMarks({ annotations, currentPage, boxSize }: HighlightMarksProps) {
  if (!boxSize || boxSize.width === 0 || boxSize.height === 0) return null;

  const pageHighlights = annotations.filter(
    (annotation) =>
      annotation.type === 'highlight' &&
      annotation.page === currentPage &&
      (annotation.textAnchor?.rects?.length ?? 0) > 0,
  );
  if (pageHighlights.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: boxSize.width, height: boxSize.height }}
      aria-hidden="true"
    >
      {pageHighlights.map((annotation) =>
        (annotation.textAnchor?.rects ?? []).map((rect, index) => {
          const pixelRect = relativeRectToPixelStyle(rect, boxSize);
          return (
            <div
              key={`${annotation.id}-${index}`}
              className="absolute rounded-[2px]"
              style={{
                left: pixelRect.left,
                top: pixelRect.top,
                width: pixelRect.width,
                height: pixelRect.height,
                backgroundColor: HIGHLIGHT_COLOR_FILL[annotation.color ?? 'yellow'],
                mixBlendMode: 'multiply',
              }}
            />
          );
        }),
      )}
    </div>
  );
}
