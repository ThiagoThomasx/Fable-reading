/**
 * Histórico de sessões de leitura de um livro, em ordem cronológica (mais
 * recente primeiro). Sessões são capturadas automaticamente pelo reader
 * (ver use-reader.ts); aqui só é possível ajustar manualmente a duração e
 * adicionar uma observação — nunca criar ou apagar uma sessão.
 */
import { useEffect, useState } from 'react';
import { useSessionStore } from '../../stores/useSessionStore';
import type { ReadingSession } from '../../types/models';

type SessionHistoryProps = {
  bookId: string;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h${rest}min` : `${hours}h`;
}

function SessionRow({ session }: { session: ReadingSession }) {
  const patch = useSessionStore((state) => state.patch);
  const [isEditing, setIsEditing] = useState(false);
  const [minutes, setMinutes] = useState(String(Math.round(session.durationMs / 60000)));
  const [notes, setNotes] = useState(session.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const onSave = async () => {
    const parsedMinutes = Number(minutes);
    if (!Number.isFinite(parsedMinutes) || parsedMinutes < 0) return;
    setIsSaving(true);
    try {
      await patch(session.id, {
        durationMs: Math.round(parsedMinutes * 60000),
        notes: notes.trim() || undefined,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <li className="rounded-md border border-ink/15 bg-pure-white p-3 text-sm">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-ink">
            Duração
            <input
              type="number"
              min={0}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              className="w-16 rounded-md border border-ink/15 bg-pure-white px-2 py-1 text-sm text-ink outline-none focus:border-ink/40"
            />
            min
          </label>
        </div>
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Observação (opcional)"
          className="mt-2 w-full rounded-md border border-ink/15 bg-pure-white px-2 py-1 text-sm text-ink outline-none focus:border-ink/40"
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
      <div>
        <p className="text-ink">
          {formatDateTime(session.startedAt)} · {formatDuration(session.durationMs)}
        </p>
        <p className="text-xs text-graphite">
          Págs. {session.startPage}–{session.endPage} ({session.pagesRead} lidas)
          {session.notes ? ` · ${session.notes}` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="shrink-0 text-xs text-ink underline"
      >
        Editar
      </button>
    </li>
  );
}

export function SessionHistory({ bookId }: SessionHistoryProps) {
  const sessions = useSessionStore((state) => state.sessions);
  const loadedBookId = useSessionStore((state) => state.loadedBookId);
  const loadForBook = useSessionStore((state) => state.loadForBook);

  useEffect(() => {
    void loadForBook(bookId);
  }, [bookId, loadForBook]);

  if (loadedBookId !== bookId) {
    return <p className="mt-2 text-xs text-graphite">Carregando histórico…</p>;
  }

  if (sessions.length === 0) {
    return <p className="mt-2 text-xs text-graphite">Nenhuma sessão registrada ainda.</p>;
  }

  const sortedDescending = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return (
    <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
      {sortedDescending.map((session) => (
        <SessionRow key={session.id} session={session} />
      ))}
    </ul>
  );
}
