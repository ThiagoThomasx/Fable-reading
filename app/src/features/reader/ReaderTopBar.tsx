/**
 * Chrome superior da Reading Surface — discreto, some em modo foco.
 * Sem elementos do App Shell (bandas/pills grandes) por decisão de design.
 * Cores via tokens --reader-* (tema Paper/Dark, ver styles/index.css).
 *
 * Cores aplicadas via style inline (não classes Tailwind arbitrary-value):
 * o motor de CSS usado no preview desta aplicação não reavalia
 * `background-color: var(--x)` quando `--x` muda dentro de um `@layer`
 * aninhado do Tailwind v4 — style inline referencia a mesma CSS var e
 * atualiza corretamente ao trocar de tema.
 */
import type { CSSProperties } from 'react';
import type { ReadingTheme } from '../../types/models';

type ReaderTopBarProps = {
  title: string;
  zoom: number;
  isMinZoom: boolean;
  isMaxZoom: boolean;
  theme: ReadingTheme;
  progress: number;
  hasPageAnnotation: boolean;
  isNotesOpen: boolean;
  isSelectModeActive: boolean;
  onClose: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleFocus: () => void;
  onToggleTheme: () => void;
  onToggleNotes: () => void;
  onToggleSelectMode: () => void;
};

const buttonStyle: CSSProperties = { color: 'var(--reader-ink-70)' };
const buttonClass =
  'reader-btn rounded-md px-2.5 py-1 text-sm transition-colors disabled:pointer-events-none disabled:opacity-30';

export function ReaderTopBar({
  title,
  zoom,
  isMinZoom,
  isMaxZoom,
  theme,
  progress,
  hasPageAnnotation,
  isNotesOpen,
  isSelectModeActive,
  onClose,
  onZoomIn,
  onZoomOut,
  onToggleFocus,
  onToggleTheme,
  onToggleNotes,
  onToggleSelectMode,
}: ReaderTopBarProps) {
  return (
    <header
      className="sticky top-0 z-10 border-b backdrop-blur"
      style={{ backgroundColor: 'var(--reader-bg-translucent)', borderColor: 'var(--reader-border)' }}
    >
      <div className="flex items-center gap-3 px-4 py-2">
        <button type="button" onClick={onClose} style={buttonStyle} className={buttonClass}>
          ← Biblioteca
        </button>
        <p
          className="min-w-0 flex-1 truncate text-center text-sm font-medium"
          style={{ color: 'var(--reader-ink-80)' }}
        >
          {title}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onZoomOut}
            disabled={isMinZoom}
            aria-label="Diminuir zoom"
            title="Diminuir zoom (−)"
            style={buttonStyle}
            className={buttonClass}
          >
            −
          </button>
          <span
            className="w-12 text-center text-xs tabular-nums"
            style={{ color: 'var(--reader-ink-60)' }}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            disabled={isMaxZoom}
            aria-label="Aumentar zoom"
            title="Aumentar zoom (+)"
            style={buttonStyle}
            className={buttonClass}
          >
            +
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            title="Alternar tema Paper/Dark (D)"
            aria-label="Alternar tema"
            aria-pressed={theme === 'dark'}
            style={buttonStyle}
            className={buttonClass}
          >
            {theme === 'paper' ? '☾' : '☀'}
          </button>
          <button
            type="button"
            onClick={onToggleNotes}
            title="Notas (N)"
            aria-label="Alternar painel de notas"
            aria-pressed={isNotesOpen}
            style={buttonStyle}
            className={`${buttonClass} relative`}
          >
            {isNotesOpen ? 'Notas ✕' : 'Notas'}
            {hasPageAnnotation && !isNotesOpen && (
              <span
                aria-hidden="true"
                className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: 'var(--reader-ink-60)' }}
              />
            )}
          </button>
          <button
            type="button"
            onClick={onToggleSelectMode}
            title="Modo seleção/highlight (T)"
            aria-label="Alternar modo seleção de texto"
            aria-pressed={isSelectModeActive}
            style={
              isSelectModeActive
                ? { backgroundColor: 'var(--reader-ink)', color: 'var(--reader-bg)' }
                : buttonStyle
            }
            className={buttonClass}
          >
            {isSelectModeActive ? 'Selecionar ✕' : 'Selecionar'}
          </button>
          <button
            type="button"
            onClick={onToggleFocus}
            title="Modo foco (F)"
            aria-label="Ativar modo foco"
            style={buttonStyle}
            className={buttonClass}
          >
            Foco
          </button>
        </div>
      </div>
      <div className="h-[2px] w-full" style={{ backgroundColor: 'var(--reader-border)' }}>
        <div
          className="h-full transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%`, backgroundColor: 'var(--reader-ink-40)' }}
        />
      </div>
    </header>
  );
}
