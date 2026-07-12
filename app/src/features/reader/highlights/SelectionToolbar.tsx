/**
 * Mini toolbar discreta exibida ao lado de uma seleção de texto válida em
 * modo seleção — clicar numa cor cria o highlight imediatamente. Posicionada
 * via `position: fixed` a partir do último rect da seleção (coordenadas de
 * viewport), então funciona corretamente independente de scroll/zoom.
 */
import type { AnnotationColor } from '../../../types/models';
import { HIGHLIGHT_COLOR_ORDER, HIGHLIGHT_COLOR_SWATCH } from './colors';

type SelectionToolbarProps = {
  position: { top: number; left: number };
  onPick: (color: AnnotationColor) => void;
};

export function SelectionToolbar({ position, onPick }: SelectionToolbarProps) {
  return (
    <div
      className="fixed z-50 flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 shadow-lift"
      style={{
        top: position.top,
        left: position.left,
        backgroundColor: 'var(--reader-page-bg)',
        border: '1px solid var(--reader-border-strong)',
      }}
      // Evita colapsar a seleção nativa antes do clique disparar (alguns
      // navegadores limpam a seleção no mousedown de um elemento fora dela).
      onMouseDown={(event) => event.preventDefault()}
    >
      <span className="pr-1 text-xs font-medium" style={{ color: 'var(--reader-ink-70)' }}>
        Destacar
      </span>
      {HIGHLIGHT_COLOR_ORDER.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Destacar em ${color}`}
          onClick={() => onPick(color)}
          className="reader-focusable h-5 w-5 rounded-full border transition-transform hover:scale-110"
          style={{ backgroundColor: HIGHLIGHT_COLOR_SWATCH[color], borderColor: 'var(--reader-border-strong)' }}
        />
      ))}
    </div>
  );
}
