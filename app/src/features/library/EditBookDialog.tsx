/**
 * Edição de metadados de um livro já cadastrado: título, autor, categoria,
 * status e capa (manter / re-extrair da 1ª página / upload manual). Nunca
 * toca o Blob em 'files' — só grava na store 'books'. Também permite excluir
 * o livro (remove metadata + Blob).
 */
import { useRef, useState, type FormEvent } from 'react';
import type { Book, BookStatus, CoverSource } from '../../types/models';
import { imageFileToThumbnail } from '../../lib/pdf/snapshot';
import { useBookStore } from '../../stores/useBookStore';
import { useSessionStore } from '../../stores/useSessionStore';
import { useNoteStore } from '../../stores/useNoteStore';
import { useReviewStore } from '../../stores/useReviewStore';
import { STATUS_LABELS, STATUS_ORDER } from '../../lib/book-status';
import { generateBookMarkdownExport, sanitizeMarkdownFilename } from '../../lib/export-markdown';
import { downloadMarkdownFile } from '../../lib/download-markdown';
import { SessionHistory } from './SessionHistory';
import { NotesList } from './NotesList';
import { ReviewEditor } from './ReviewEditor';

type EditBookDialogProps = {
  book: Book;
  onClose: () => void;
};

type CoverAction = 'keep' | 'extract' | 'manual';

export function EditBookDialog({ book, onClose }: EditBookDialogProps) {
  const patch = useBookStore((state) => state.patch);
  const remove = useBookStore((state) => state.remove);
  const extractCoverFromFile = useBookStore((state) => state.extractCoverFromFile);

  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? '');
  const [category, setCategory] = useState(book.category);
  const [status, setStatus] = useState<BookStatus>(book.status);
  const [coverAction, setCoverAction] = useState<CoverAction>('keep');
  const [extractedPreview, setExtractedPreview] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [manualCoverFile, setManualCoverFile] = useState<File | null>(null);
  const [manualCoverPreview, setManualCoverPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const loadSessionsForBook = useSessionStore((state) => state.loadForBook);
  const loadNotesForBook = useNoteStore((state) => state.loadForBook);
  const loadReviewForBook = useReviewStore((state) => state.loadForBook);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const buildBookMarkdown = async (): Promise<string> => {
    await Promise.all([
      loadSessionsForBook(book.id),
      loadNotesForBook(book.id),
      loadReviewForBook(book.id),
    ]);
    const sessions = useSessionStore.getState().sessions;
    const annotations = useNoteStore.getState().annotations;
    const review = useReviewStore.getState().review ?? undefined;
    return generateBookMarkdownExport({ book, sessions, annotations, review });
  };

  const onExportMarkdown = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    setExportFeedback(null);
    try {
      const markdown = await buildBookMarkdown();
      downloadMarkdownFile(sanitizeMarkdownFilename(book.title), markdown);
    } catch (exportErr) {
      setExportError(
        exportErr instanceof Error ? exportErr.message : 'Falha ao exportar Markdown.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  const onCopyMarkdown = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    setExportFeedback(null);
    try {
      const markdown = await buildBookMarkdown();
      if (!navigator.clipboard) {
        setExportError('Área de transferência indisponível neste navegador.');
        return;
      }
      await navigator.clipboard.writeText(markdown);
      setExportFeedback('Markdown copiado.');
    } catch (exportErr) {
      setExportError(exportErr instanceof Error ? exportErr.message : 'Falha ao copiar Markdown.');
    } finally {
      setIsExporting(false);
    }
  };

  const onSelectExtract = async () => {
    setCoverAction('extract');
    if (extractedPreview || isExtracting) return;
    setIsExtracting(true);
    try {
      const coverUrl = await extractCoverFromFile(book.id);
      setExtractedPreview(coverUrl);
    } catch {
      setError('Não foi possível re-extrair a capa deste PDF.');
      setCoverAction('keep');
    } finally {
      setIsExtracting(false);
    }
  };

  const onManualCoverChosen = async (files: FileList | null) => {
    const image = files?.[0];
    if (!image) return;
    try {
      setManualCoverFile(image);
      setManualCoverPreview(await imageFileToThumbnail(image));
      setCoverAction('manual');
    } catch {
      setError('Não foi possível ler esta imagem de capa.');
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      let coverPatch: { coverSource: CoverSource; coverUrl: string } | Record<string, never> = {};
      if (coverAction === 'manual') {
        if (!manualCoverFile || !manualCoverPreview) {
          setError('Escolha a imagem da capa ou volte para a capa atual.');
          setIsSaving(false);
          return;
        }
        coverPatch = { coverSource: 'manual', coverUrl: manualCoverPreview };
      } else if (coverAction === 'extract') {
        const coverUrl = extractedPreview ?? (await extractCoverFromFile(book.id));
        coverPatch = { coverSource: 'extracted', coverUrl };
      }
      // Marcar como finalizado carimba a data atual uma única vez — reabrir o
      // diálogo e salvar de novo não deve sobrescrever a data original.
      const becomingCompleted = status === 'completed' && book.status !== 'completed';
      await patch(book.id, {
        title: title.trim(),
        author: author.trim() || undefined,
        category: category.trim() || 'Geral',
        status,
        ...coverPatch,
        ...(becomingCompleted ? { completedAt: new Date().toISOString() } : {}),
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar as alterações.');
      setIsSaving(false);
    }
  };

  const onDelete = async () => {
    if (isDeleting) return;
    const confirmed = window.confirm(
      `Excluir "${book.title}"? O PDF, metadados, sessões de leitura, notas/marcações e a review serão removidos permanentemente.`,
    );
    if (!confirmed) return;
    setIsDeleting(true);
    setError(null);
    try {
      await remove(book.id);
      onClose();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Falha ao excluir o livro.');
      setIsDeleting(false);
    }
  };

  const activeCoverPreview =
    coverAction === 'manual'
      ? manualCoverPreview
      : coverAction === 'extract'
        ? extractedPreview
        : book.coverUrl;

  const isBusy = isSaving || isDeleting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <form
        onSubmit={onSubmit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-paper-cream p-6 shadow-lift"
      >
        <h2 className="font-display text-2xl text-ink">Editar livro</h2>
        <p className="mt-1 text-sm text-graphite">{book.totalPages} páginas</p>

        <label className="mt-5 block text-sm font-medium text-ink">
          Título
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className="mt-1 w-full rounded-md border border-ink/15 bg-pure-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-ink">
            Autor
            <input
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              className="mt-1 w-full rounded-md border border-ink/15 bg-pure-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            Categoria
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-1 w-full rounded-md border border-ink/15 bg-pure-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
            />
          </label>
        </div>

        <label className="mt-3 block text-sm font-medium text-ink">
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as BookStatus)}
            className="mt-1 w-full rounded-md border border-ink/15 bg-pure-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
          >
            {STATUS_ORDER.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-ink">Capa</legend>
          <div className="mt-2 flex items-start gap-4">
            <div className="flex-1 space-y-2 text-sm text-graphite">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cover-action"
                  checked={coverAction === 'keep'}
                  onChange={() => setCoverAction('keep')}
                />
                Manter capa atual
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cover-action"
                  checked={coverAction === 'extract'}
                  onChange={() => void onSelectExtract()}
                />
                Extrair da 1ª página {isExtracting && '(gerando…)'}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cover-action"
                  checked={coverAction === 'manual'}
                  onChange={() => {
                    setCoverAction('manual');
                    if (!manualCoverFile) coverInputRef.current?.click();
                  }}
                />
                Enviar imagem
              </label>
              {coverAction === 'manual' && (
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="text-xs text-ink underline"
                >
                  {manualCoverFile ? 'Trocar imagem…' : 'Escolher imagem…'}
                </button>
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void onManualCoverChosen(event.target.files)}
              />
            </div>
            <div className="w-24 shrink-0">
              {activeCoverPreview ? (
                <img
                  src={activeCoverPreview}
                  alt="Prévia da capa"
                  className="aspect-[7/10] w-full rounded-sm object-cover shadow-cover"
                />
              ) : (
                <div className="aspect-[7/10] w-full rounded-sm bg-fog" />
              )}
            </div>
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-ink">Notas e marcações</legend>
          <NotesList bookId={book.id} />
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-ink">Histórico de sessões</legend>
          <SessionHistory bookId={book.id} />
        </fieldset>

        {status === 'completed' && (
          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-ink">Review</legend>
            <ReviewEditor bookId={book.id} />
          </fieldset>
        )}

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-ink">Exportar</legend>
          <p className="mt-1 text-xs text-graphite">
            Gera um arquivo Markdown com metadados, notas, marcações e sessões — pronto para colar
            no Obsidian, Notion, Claude ou NotebookLM.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void onExportMarkdown()}
              disabled={isExporting}
              className="rounded-pill border border-ink/15 px-4 py-2 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              {isExporting ? 'Exportando…' : 'Exportar Markdown'}
            </button>
            <button
              type="button"
              onClick={() => void onCopyMarkdown()}
              disabled={isExporting}
              className="rounded-pill border border-ink/15 px-4 py-2 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              Copiar Markdown
            </button>
          </div>
          {exportFeedback && <p className="mt-2 text-xs text-graphite">{exportFeedback}</p>}
          {exportError && <p className="mt-2 text-xs text-red-700">{exportError}</p>}
        </fieldset>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void onDelete()}
            disabled={isBusy}
            className="text-sm font-medium text-red-700 underline disabled:opacity-50"
          >
            {isDeleting ? 'Excluindo…' : 'Excluir livro'}
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-pill px-5 py-2.5 text-sm font-medium text-ink hover:bg-ink/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="rounded-pill bg-charcoal-plum px-6 py-2.5 text-sm font-medium text-pure-white shadow-lift disabled:opacity-50"
            >
              {isSaving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
