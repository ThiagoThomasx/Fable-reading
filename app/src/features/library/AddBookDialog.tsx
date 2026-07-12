/**
 * Cadastro de livro após escolher um PDF: sonda o arquivo (total de páginas +
 * capa candidata da 1ª página) e deixa o usuário escolher entre capa extraída
 * automaticamente ou upload manual — as duas fontes previstas no plano.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CoverSource } from '../../types/models';
import type { PdfProbe } from '../../lib/pdf/probe-pdf';
import { imageFileToThumbnail } from '../../lib/pdf/snapshot';
import { useBookStore } from '../../stores/useBookStore';

type AddBookDialogProps = {
  file: File;
  onClose: () => void;
};

function defaultTitle(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').trim();
}

export function AddBookDialog({ file, onClose }: AddBookDialogProps) {
  const addBook = useBookStore((state) => state.add);
  const [probe, setProbe] = useState<PdfProbe | null>(null);
  const [title, setTitle] = useState(() => defaultTitle(file.name));
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('Geral');
  const [coverSource, setCoverSource] = useState<CoverSource>('extracted');
  const [manualCoverFile, setManualCoverFile] = useState<File | null>(null);
  const [manualCoverPreview, setManualCoverPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    // Import dinâmico: mantém o pdfjs-dist fora do bundle inicial da Biblioteca
    Promise.all([import('../../lib/pdf/probe-pdf'), file.arrayBuffer()])
      .then(([{ probePdf }, data]) => probePdf(data))
      .then((result) => {
        if (!cancelled) setProbe(result);
      })
      .catch(() => {
        if (!cancelled) setError('Este arquivo não parece ser um PDF válido.');
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const onManualCoverChosen = async (files: FileList | null) => {
    const image = files?.[0];
    if (!image) return;
    try {
      setManualCoverFile(image);
      setManualCoverPreview(await imageFileToThumbnail(image));
      setCoverSource('manual');
    } catch {
      setError('Não foi possível ler esta imagem de capa.');
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!probe || isSaving) return;
    if (coverSource === 'manual' && !manualCoverFile) {
      setError('Escolha a imagem da capa ou volte para a capa extraída.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await addBook({
        file,
        title,
        author,
        category,
        coverSource,
        manualCoverFile: manualCoverFile ?? undefined,
        extractedCoverUrl: probe.coverDataUrl,
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar o livro.');
      setIsSaving(false);
    }
  };

  const activeCoverPreview = coverSource === 'manual' ? manualCoverPreview : probe?.coverDataUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl bg-paper-cream p-6 shadow-lift"
      >
        <h2 className="font-display text-2xl text-ink">Novo livro</h2>
        <p className="mt-1 text-sm text-graphite">
          {probe ? `${probe.totalPages} páginas` : error ? '—' : 'Lendo o PDF…'}
        </p>

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

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-ink">Capa</legend>
          <div className="mt-2 flex items-start gap-4">
            <div className="flex-1 space-y-2 text-sm text-graphite">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cover"
                  checked={coverSource === 'extracted'}
                  onChange={() => setCoverSource('extracted')}
                />
                Extrair da 1ª página
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cover"
                  checked={coverSource === 'manual'}
                  onChange={() => {
                    setCoverSource('manual');
                    if (!manualCoverFile) coverInputRef.current?.click();
                  }}
                />
                Enviar imagem
              </label>
              {coverSource === 'manual' && (
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

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-pill px-5 py-2.5 text-sm font-medium text-ink hover:bg-ink/5"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!probe || isSaving}
            className="rounded-pill bg-charcoal-plum px-6 py-2.5 text-sm font-medium text-pure-white shadow-lift disabled:opacity-50"
          >
            {isSaving ? 'Salvando…' : 'Adicionar à biblioteca'}
          </button>
        </div>
      </form>
    </div>
  );
}
