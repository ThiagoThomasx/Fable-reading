/**
 * Editor da review pessoal de um livro (Sprint 11): nota, título, texto,
 * principais ideias e highlights favoritos. Sem rich text — textarea simples.
 * Salvar é sempre explícito (sem autosave), espelhando o resto do
 * EditBookDialog. Renderizado apenas quando o livro está "Finalizado" (ver
 * EditBookDialog) — os dados da review persistem mesmo se o status mudar depois.
 */
import { useEffect, useState } from 'react';
import { useReviewStore } from '../../stores/useReviewStore';
import { useNoteStore } from '../../stores/useNoteStore';

type ReviewEditorProps = {
  bookId: string;
};

const RATING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

function takeawaysToText(takeaways: string[] | undefined): string {
  return (takeaways ?? []).join('\n');
}

function textToTakeaways(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function ReviewEditor({ bookId }: ReviewEditorProps) {
  const review = useReviewStore((state) => state.review);
  const loadedBookId = useReviewStore((state) => state.loadedBookId);
  const loadForBook = useReviewStore((state) => state.loadForBook);
  const save = useReviewStore((state) => state.save);
  const removeReview = useReviewStore((state) => state.remove);

  const annotations = useNoteStore((state) => state.annotations);
  const notesLoadedBookId = useNoteStore((state) => state.loadedBookId);
  const loadNotesForBook = useNoteStore((state) => state.loadForBook);

  const [rating, setRating] = useState<number | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [takeawaysText, setTakeawaysText] = useState('');
  const [finishedAt, setFinishedAt] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    void loadForBook(bookId);
    void loadNotesForBook(bookId);
  }, [bookId, loadForBook, loadNotesForBook]);

  useEffect(() => {
    if (loadedBookId !== bookId) return;
    setRating(review?.rating);
    setTitle(review?.title ?? '');
    setBody(review?.body ?? '');
    setTakeawaysText(takeawaysToText(review?.mainTakeaways));
    setFinishedAt(review?.finishedAt?.slice(0, 10) ?? '');
    setFavoriteIds(review?.favoriteAnnotationIds ?? []);
  }, [review, loadedBookId, bookId]);

  const highlights = annotations.filter((annotation) => annotation.type === 'highlight');

  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) =>
      current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id],
    );
  };

  const isEmpty =
    rating === undefined &&
    !title.trim() &&
    !body.trim() &&
    textToTakeaways(takeawaysText).length === 0 &&
    favoriteIds.length === 0 &&
    !finishedAt;

  const onSave = async () => {
    if (isSaving) return;
    if (isEmpty) {
      setError('Preencha ao menos um campo antes de salvar a review.');
      return;
    }
    setIsSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const takeaways = textToTakeaways(takeawaysText);
      await save(bookId, {
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        mainTakeaways: takeaways.length > 0 ? takeaways : undefined,
        favoriteAnnotationIds: favoriteIds.length > 0 ? favoriteIds : undefined,
        // `new Date('YYYY-MM-DD')` parseia como meia-noite UTC, o que desalinha a data
        // exibida (formatMarkdownDate usa componentes locais) em fusos negativos como
        // America/Sao_Paulo — bug encontrado no QA manual da Sprint 11. Anexar hora sem
        // 'Z' força o parse como meia-noite local, preservando o dia escolhido no round-trip.
        finishedAt: finishedAt ? new Date(`${finishedAt}T00:00:00`).toISOString() : undefined,
      });
      setFeedback('Review salva.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar a review.');
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async () => {
    if (!review || isSaving) return;
    const confirmed = window.confirm(
      'Excluir a review deste livro? Esta ação não pode ser desfeita.',
    );
    if (!confirmed) return;
    setIsSaving(true);
    setError(null);
    setFeedback(null);
    try {
      await removeReview(bookId);
      setRating(undefined);
      setTitle('');
      setBody('');
      setTakeawaysText('');
      setFinishedAt('');
      setFavoriteIds([]);
      setFeedback('Review excluída.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Falha ao excluir a review.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loadedBookId !== bookId || notesLoadedBookId !== bookId) {
    return <p className="mt-2 text-xs text-graphite">Carregando review…</p>;
  }

  return (
    <div className="mt-2 space-y-3">
      <label className="block text-sm font-medium text-ink">
        Nota
        <select
          value={rating ?? ''}
          onChange={(event) =>
            setRating(event.target.value ? Number(event.target.value) : undefined)
          }
          className="mt-1 w-full rounded-md border border-ink/15 bg-pure-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
        >
          <option value="">Sem nota</option>
          {RATING_STEPS.map((value) => (
            <option key={value} value={value}>
              {value.toFixed(1)} / 5
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-ink">
        Título da review
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 w-full rounded-md border border-ink/15 bg-pure-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
        />
      </label>

      <label className="block text-sm font-medium text-ink">
        Review
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          className="mt-1 w-full resize-none rounded-md border border-ink/15 bg-pure-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
        />
      </label>

      <label className="block text-sm font-medium text-ink">
        Principais ideias/aprendizados (uma por linha)
        <textarea
          value={takeawaysText}
          onChange={(event) => setTakeawaysText(event.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded-md border border-ink/15 bg-pure-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
        />
      </label>

      <label className="block text-sm font-medium text-ink">
        Finalizado em
        <input
          type="date"
          value={finishedAt}
          onChange={(event) => setFinishedAt(event.target.value)}
          className="mt-1 w-full rounded-md border border-ink/15 bg-pure-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
        />
      </label>

      {highlights.length > 0 && (
        <div>
          <p className="text-sm font-medium text-ink">Highlights favoritos</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
            {highlights.map((highlight) => (
              <li key={highlight.id} className="flex items-start gap-2 text-xs text-graphite">
                <input
                  type="checkbox"
                  checked={favoriteIds.includes(highlight.id)}
                  onChange={() => toggleFavorite(highlight.id)}
                  className="mt-0.5"
                />
                <span className="truncate">
                  Pág. {highlight.page} — &ldquo;{highlight.quoteText}&rdquo;
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={isSaving}
          className="rounded-pill bg-charcoal-plum px-5 py-2 text-xs font-medium text-pure-white shadow-lift disabled:opacity-50"
        >
          {isSaving ? 'Salvando…' : 'Salvar review'}
        </button>
        {review && (
          <button
            type="button"
            onClick={() => void onDelete()}
            disabled={isSaving}
            className="text-xs font-medium text-red-700 underline disabled:opacity-50"
          >
            Excluir review
          </button>
        )}
      </div>
      {feedback && <p className="text-xs text-graphite">{feedback}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
