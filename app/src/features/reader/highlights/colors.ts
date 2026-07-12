/**
 * Paleta de cores de highlight — compartilhada entre `HighlightMarks`
 * (renderização sobre a página) e `SelectionToolbar` (escolha na criação).
 * Alpha baixo para permanecer legível em Paper e Dark sem esconder o texto.
 */
import type { AnnotationColor } from '../../../types/models';

export const HIGHLIGHT_COLOR_ORDER: AnnotationColor[] = [
  'yellow',
  'green',
  'blue',
  'pink',
  'purple',
];

export const HIGHLIGHT_COLOR_SWATCH: Record<AnnotationColor, string> = {
  yellow: '#facc15',
  green: '#4ade80',
  blue: '#60a5fa',
  pink: '#f472b6',
  purple: '#c084fc',
};

export const HIGHLIGHT_COLOR_FILL: Record<AnnotationColor, string> = {
  yellow: 'rgba(250, 204, 21, 0.45)',
  green: 'rgba(74, 222, 128, 0.4)',
  blue: 'rgba(96, 165, 250, 0.4)',
  pink: 'rgba(244, 114, 182, 0.4)',
  purple: 'rgba(192, 132, 252, 0.4)',
};
