/**
 * Lista de notas e marcações de um livro, fora do reader. Espelha SessionHistory.tsx:
 * autocarrega por bookId, permite editar/remover, mas nunca criar — criação de nota
 * acontece vinculada à página atual dentro da Reading Surface (ver NotesSidePanel).
 */
import { useEffect, useState } from 'react';
import { useNoteStore } from '../../stores/useNoteStore';
import type { ReadingAnnotation } from '../../types/models';
import { HIGHLIGHT_COLOR_SWATCH } from '../reader/highlights/colors';

type NotesListProps = {
  bookId: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function AnnotationRow({ annotation }: { annotation: ReadingAnnotation }) {
  const patch = useNoteStore((state) => state.patch);
  const remove = useNoteStore((state) => state.remove);
  const [isEditing, setIsEditing] = useState(false);
  const [body, setBody] = useState(annotation.body ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const onSave = async () => {
    setIsSaving(true);
    try {
      await patch(annotation.id, { body: body.trim() || undefined });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const icon = annotation.type === 'bookmark' ? '🔖' : annotation.type === 'highlight' ? '🖍️' : '✎';

  if (isEditing) {
    return (
      <li className="rounded-md border border-ink/15 bg-pure-white p-3 text-sm">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={2}
          className="w-full resize-none rounded-md border border-ink/15 bg-pure-white px-2 py-1 text-sm text-ink outline-none focus:border-ink/40"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            disabled={isSaving}
            className="text-xs text-graphite underline disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={isSaving}
            className="text-xs font-medium text-ink underline disabled:opacity-50"
          >
            {isSaving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-ink/10 px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="text-ink">
          {icon} Página {annotation.page} · {formatDate(annotation.createdAt)}
          {annotation.type === 'highlight' && (
            <span
              aria-hidden="true"
              className="ml-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
              style={{ backgroundColor: HIGHLIGHT_COLOR_SWATCH[annotation.color ?? 'yellow'] }}
            />
          )}
        </p>
        {annotation.type === 'highlight' ? (
          <p className="truncate text-xs italic text-graphite">
            &ldquo;{annotation.quoteText}&rdquo;
          </p>
        ) : (
          annotation.body && <p className="truncate text-xs text-graphite">{annotation.body}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {annotation.type === 'page_note' && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs text-ink underline"
          >
            Editar
          </button>
        )}
        <button
          type="button"
          onClick={() => void remove(annotation.id)}
          className="text-xs text-graphite underline"
        >
          Remover
        </button>
      </div>
    </li>
  );
}

export function NotesList({ bookId }: NotesListProps) {
  const annotations = useNoteStore((state) => state.annotations);
  const loadedBookId = useNoteStore((state) => state.loadedBookId);
  const loadForBook = useNoteStore((state) => state.loadForBook);

  useEffect(() => {
    void loadForBook(bookId);
  }, [bookId, loadForBook]);

  if (loadedBookId !== bookId) {
    return <p className="mt-2 text-xs text-graphite">Carregando notas…</p>;
  }

  if (annotations.length === 0) {
    return (
      <p className="mt-2 text-xs text-graphite">
        Nenhuma nota ou marcação ainda — crie durante a leitura (painel "Notas", atalho N).
      </p>
    );
  }

  return (
    <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
      {annotations.map((annotation) => (
        <AnnotationRow key={annotation.id} annotation={annotation} />
      ))}
    </ul>
  );
}
