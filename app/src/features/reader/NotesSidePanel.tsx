/**
 * Painel lateral de notas da Reading Surface — minimalista, tokens --reader-*
 * (ver CLAUDE.md: nunca aplicar bandas/ilustrações do App Shell aqui). Permite
 * marcar/desmarcar a página atual e criar uma nota vinculada a ela; lista todas
 * as anotações do livro, com navegação direta para a página de cada uma.
 */
import { useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { ReadingAnnotation } from '../../types/models';
import { useNoteStore } from '../../stores/useNoteStore';
import { isBlankNoteBody } from '../../lib/notes';
import { HIGHLIGHT_COLOR_SWATCH } from './highlights/colors';

type NotesSidePanelProps = {
  bookId: string;
  currentPage: number;
  annotations: ReadingAnnotation[];
  onClose: () => void;
  onGoToPage: (page: number) => void;
};

const inputStyle: CSSProperties = {
  backgroundColor: 'var(--reader-page-bg)',
  borderColor: 'var(--reader-border)',
  color: 'var(--reader-ink)',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function AnnotationRow({
  annotation,
  currentPage,
  onGoToPage,
}: {
  annotation: ReadingAnnotation;
  currentPage: number;
  onGoToPage: (page: number) => void;
}) {
  const patch = useNoteStore((state) => state.patch);
  const remove = useNoteStore((state) => state.remove);
  const [isEditing, setIsEditing] = useState(false);
  const [body, setBody] = useState(annotation.body ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const cancelEdit = () => {
    setBody(annotation.body ?? '');
    setIsEditing(false);
    setRowError(null);
  };

  const onSave = async () => {
    if (isBlankNoteBody(body)) return;
    setIsSaving(true);
    setRowError(null);
    try {
      await patch(annotation.id, { body: body.trim() });
      setIsEditing(false);
    } catch {
      setRowError('Não foi possível salvar a nota. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const onRemove = async () => {
    setRowError(null);
    try {
      await remove(annotation.id);
    } catch {
      setRowError('Não foi possível remover. Tente novamente.');
    }
  };

  const onTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      cancelEdit();
    }
  };

  const isCurrent = annotation.page === currentPage;
  const icon = annotation.type === 'bookmark' ? '🔖' : annotation.type === 'highlight' ? '🖍️' : '✎';

  return (
    <li
      className="rounded-md border px-2.5 py-2 text-sm"
      style={{
        borderColor: 'var(--reader-border)',
        backgroundColor: isCurrent ? 'var(--reader-control-hover)' : 'transparent',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onGoToPage(annotation.page)}
          className="font-medium underline-offset-2 hover:underline"
          style={{ color: 'var(--reader-ink-80)' }}
        >
          {icon} Página {annotation.page}
        </button>
        <span className="shrink-0 text-xs" style={{ color: 'var(--reader-ink-50)' }}>
          {formatDate(annotation.createdAt)}
        </span>
      </div>

      {annotation.type === 'highlight' && (
        <div className="mt-1.5 flex items-start gap-2">
          <span
            aria-hidden="true"
            className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: HIGHLIGHT_COLOR_SWATCH[annotation.color ?? 'yellow'] }}
          />
          <p
            className="whitespace-pre-wrap border-l-2 pl-2 text-sm italic"
            style={{ borderColor: 'var(--reader-border-strong)', color: 'var(--reader-ink-70)' }}
          >
            {annotation.quoteText || <span style={{ color: 'var(--reader-ink-50)' }}>(vazio)</span>}
          </p>
        </div>
      )}

      {annotation.type === 'page_note' &&
        (isEditing ? (
          <div className="mt-1.5">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={onTextareaKeyDown}
              rows={3}
              aria-label={`Editar nota da página ${annotation.page}`}
              autoFocus
              className="reader-focusable w-full resize-none rounded-md border px-2 py-1.5 text-sm"
              style={inputStyle}
            />
            {rowError && (
              <p className="mt-1 text-xs" style={{ color: 'var(--reader-error)' }}>
                {rowError}
              </p>
            )}
            <div className="mt-1 flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={isSaving}
                className="text-xs underline disabled:opacity-50"
                style={{ color: 'var(--reader-ink-60)' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={isSaving || isBlankNoteBody(body)}
                className="text-xs font-medium underline disabled:opacity-50"
                style={{ color: 'var(--reader-ink-80)' }}
              >
                {isSaving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        ) : (
          <p
            onClick={() => setIsEditing(true)}
            className="mt-1 cursor-text whitespace-pre-wrap text-sm"
            style={{ color: 'var(--reader-ink-70)' }}
          >
            {annotation.body || <span style={{ color: 'var(--reader-ink-50)' }}>(vazio)</span>}
          </p>
        ))}

      {!isEditing && rowError && (
        <p className="mt-1 text-xs" style={{ color: 'var(--reader-error)' }}>
          {rowError}
        </p>
      )}
      <div className="mt-1 flex justify-end">
        <button
          type="button"
          onClick={() => void onRemove()}
          className="text-xs underline"
          style={{ color: 'var(--reader-ink-50)' }}
        >
          Remover
        </button>
      </div>
    </li>
  );
}

export function NotesSidePanel({
  bookId,
  currentPage,
  annotations,
  onClose,
  onGoToPage,
}: NotesSidePanelProps) {
  const add = useNoteStore((state) => state.add);
  const toggleBookmark = useNoteStore((state) => state.toggleBookmark);
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingBookmark, setIsTogglingBookmark] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const bookmarkOnCurrentPage = useMemo(
    () => annotations.find((a) => a.type === 'bookmark' && a.page === currentPage),
    [annotations, currentPage],
  );

  const onToggleBookmark = async () => {
    setIsTogglingBookmark(true);
    setPanelError(null);
    try {
      await toggleBookmark(bookId, currentPage);
    } catch {
      setPanelError('Não foi possível atualizar a marcação. Tente novamente.');
    } finally {
      setIsTogglingBookmark(false);
    }
  };

  const onAddNote = async () => {
    if (isBlankNoteBody(draft) || isSaving) return;
    setIsSaving(true);
    setPanelError(null);
    try {
      const now = new Date().toISOString();
      await add({
        id: crypto.randomUUID(),
        bookId,
        page: currentPage,
        type: 'page_note',
        body: draft.trim(),
        createdAt: now,
        updatedAt: now,
      });
      setDraft('');
    } catch {
      setPanelError('Não foi possível salvar a nota. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const onDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && draft.length > 0) {
      event.stopPropagation();
      setDraft('');
    }
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-20 flex w-full flex-col border-l shadow-lift sm:w-80"
      style={{ backgroundColor: 'var(--reader-bg)', borderColor: 'var(--reader-border)' }}
      aria-label="Painel de notas"
    >
      <div
        className="flex items-center justify-between gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--reader-border)' }}
      >
        <h2 className="text-sm font-medium" style={{ color: 'var(--reader-ink)' }}>
          Notas — página {currentPage}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel de notas"
          className="reader-focusable text-sm"
          style={{ color: 'var(--reader-ink-60)' }}
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-3">
        <button
          type="button"
          onClick={() => void onToggleBookmark()}
          disabled={isTogglingBookmark}
          aria-pressed={Boolean(bookmarkOnCurrentPage)}
          className="reader-focusable w-full rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          style={{ borderColor: 'var(--reader-border)', color: 'var(--reader-ink-80)' }}
        >
          {bookmarkOnCurrentPage ? '🔖 Remover marcação desta página' : '🔖 Marcar esta página'}
        </button>

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onDraftKeyDown}
          placeholder="Nova nota para esta página…"
          rows={3}
          aria-label={`Nova nota para a página ${currentPage}`}
          className="reader-focusable mt-2 w-full resize-none rounded-md border px-2 py-1.5 text-sm"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => void onAddNote()}
          disabled={isBlankNoteBody(draft) || isSaving}
          className="reader-focusable mt-1.5 w-full rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          style={{ backgroundColor: 'var(--reader-ink)', color: 'var(--reader-bg)' }}
        >
          {isSaving ? 'Adicionando…' : 'Adicionar nota'}
        </button>
        {panelError && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--reader-error)' }}>
            {panelError}
          </p>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto border-t px-4 py-3"
        style={{ borderColor: 'var(--reader-border)' }}
      >
        {annotations.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--reader-ink-50)' }}>
            Nenhuma nota ou marcação neste livro ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {annotations.map((annotation) => (
              <AnnotationRow
                key={annotation.id}
                annotation={annotation}
                currentPage={currentPage}
                onGoToPage={onGoToPage}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
