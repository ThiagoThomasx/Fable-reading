/**
 * Serialização pura de um livro (metadados + sessões + notas) em Markdown portável
 * (Obsidian/Notion/Claude/NotebookLM). Não acessa IndexedDB nem o Blob do PDF — opera
 * só sobre os arrays já carregados pelos stores (ver EditBookDialog).
 */
import type { Book, ReadingAnnotation, ReadingSession, BookReview } from '../types/models';
import { STATUS_LABELS } from './book-status';
import { progressPercent } from './book-progress';
import { getTotalReadingTime, getTotalPagesRead, formatDuration } from './dashboard-stats';

export type BookMarkdownExportInput = {
  book: Book;
  sessions: ReadingSession[];
  annotations: ReadingAnnotation[];
  /** Ausente quando o livro não tem review — seção "Review" é omitida nesse caso. */
  review?: BookReview;
  /** ISO string; permite datas determinísticas em testes. Default: `new Date().toISOString()`. */
  generatedAt?: string;
};

/** Data local (YYYY-MM-DD) a partir de um ISO string; 'Nunca' para ausente/inválido. */
export function formatMarkdownDate(iso: string | undefined): string {
  if (!iso) return 'Nunca';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Nunca';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatMarkdownDuration(ms: number): string {
  return formatDuration(ms);
}

/** Nome de arquivo seguro a partir do título; fallback quando o título não gera nada usável. */
export function sanitizeMarkdownFilename(title: string): string {
  const normalized = title
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized ? `readquest-${normalized}.md` : 'readquest-export.md';
}

/** Escapa tokens Markdown no início de linha (#, >, -, *, +, listas numeradas) sem afetar o resto do texto. */
export function escapeMarkdownLine(line: string): string {
  return line.replace(/^(\s*)([#>*+-]|\d+\.)/, '$1\\$2');
}

/** Preserva quebras de linha do texto original, escapando cada linha individualmente. */
export function escapeMarkdownBody(text: string): string {
  return text.split('\n').map(escapeMarkdownLine).join('\n');
}

/** Formata um texto (potencialmente multi-linha) como blockquote Markdown (`> `), escapado linha a linha. */
export function escapeMarkdownQuote(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${escapeMarkdownLine(line)}`)
    .join('\n');
}

export function sortAnnotationsForExport(
  annotations: ReadingAnnotation[],
): ReadingAnnotation[] {
  return [...annotations].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** Agrupa anotações (já ordenadas) por página, preservando a ordem de primeira ocorrência. */
export function groupAnnotationsByPage(
  annotations: ReadingAnnotation[],
): Map<number, ReadingAnnotation[]> {
  const grouped = new Map<number, ReadingAnnotation[]>();
  for (const annotation of annotations) {
    const existing = grouped.get(annotation.page);
    if (existing) {
      existing.push(annotation);
    } else {
      grouped.set(annotation.page, [annotation]);
    }
  }
  return grouped;
}

export function sortSessionsForExport(sessions: ReadingSession[]): ReadingSession[] {
  return [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

function lastSessionDate(sessions: ReadingSession[]): string | undefined {
  if (sessions.length === 0) return undefined;
  return sessions.reduce((latest, session) =>
    session.startedAt > latest.startedAt ? session : latest,
  ).startedAt;
}

function renderAnnotationSection(annotations: ReadingAnnotation[]): string[] {
  if (annotations.length === 0) {
    return ['## Notas e marcações', '', 'Nenhuma nota registrada.', ''];
  }

  const lines: string[] = ['## Notas e marcações', ''];
  const grouped = groupAnnotationsByPage(sortAnnotationsForExport(annotations));
  for (const [page, pageAnnotations] of grouped) {
    lines.push(`### Página ${page}`, '');
    for (const annotation of pageAnnotations) {
      const body = annotation.body?.trim();
      if (annotation.type === 'bookmark') {
        lines.push('#### Bookmark', '', body ? escapeMarkdownBody(body) : 'Página marcada como importante.', '');
      } else if (annotation.type === 'highlight') {
        const quote = annotation.quoteText?.trim();
        lines.push('#### Highlight', '');
        lines.push(quote ? escapeMarkdownQuote(quote) : '_Highlight sem texto._', '');
        lines.push(`Cor: ${annotation.color ?? 'yellow'}`, '');
      } else {
        lines.push('#### Nota', '', body ? escapeMarkdownBody(body) : '_Nota vazia._', '');
      }
    }
  }
  return lines;
}

function renderReviewSection(
  review: BookReview | undefined,
  annotations: ReadingAnnotation[],
): string[] {
  if (!review) return [];

  const lines: string[] = ['## Review', ''];
  if (review.rating !== undefined) lines.push(`- Nota: ${review.rating.toFixed(1)} / 5`);
  if (review.finishedAt) lines.push(`- Finalizado em: ${formatMarkdownDate(review.finishedAt)}`);
  lines.push('');

  if (review.title?.trim()) lines.push(`### ${review.title.trim()}`, '');
  if (review.body?.trim()) lines.push(escapeMarkdownBody(review.body.trim()), '');

  if (review.mainTakeaways && review.mainTakeaways.length > 0) {
    lines.push('### Principais ideias', '');
    for (const takeaway of review.mainTakeaways) {
      lines.push(`- ${escapeMarkdownLine(takeaway)}`);
    }
    lines.push('');
  }

  const favoriteIds = new Set(review.favoriteAnnotationIds ?? []);
  const favorites = sortAnnotationsForExport(
    annotations.filter((annotation) => favoriteIds.has(annotation.id)),
  );
  if (favorites.length > 0) {
    lines.push('### Highlights favoritos', '');
    for (const favorite of favorites) {
      lines.push(`#### Página ${favorite.page}`, '');
      const quote = favorite.quoteText?.trim();
      lines.push(quote ? escapeMarkdownQuote(quote) : '_Highlight sem texto._', '');
    }
  }

  return lines;
}

function renderSessionsSection(sessions: ReadingSession[]): string[] {
  if (sessions.length === 0) {
    return ['## Sessões de leitura', '', 'Nenhuma sessão registrada.', ''];
  }

  const lines: string[] = ['## Sessões de leitura', ''];
  for (const session of sortSessionsForExport(sessions)) {
    lines.push(`### ${formatMarkdownDate(session.startedAt)}`, '');
    lines.push(`- Duração: ${formatMarkdownDuration(session.durationMs)}`);
    lines.push(`- Páginas: ${session.startPage} → ${session.endPage}`);
    lines.push(`- Páginas avançadas: ${session.pagesRead}`);
    const notes = session.notes?.trim();
    if (notes) {
      lines.push(`- Nota da sessão: ${escapeMarkdownBody(notes)}`);
    }
    lines.push('');
  }
  return lines;
}

export function generateBookMarkdownExport(input: BookMarkdownExportInput): string {
  const { book, sessions, annotations, review } = input;
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  const lines: string[] = [];
  lines.push(`# ${book.title.trim() || 'Livro sem título'}`, '');
  lines.push(`> Exportado do ReadQuest em ${formatMarkdownDate(generatedAt)}`, '');

  lines.push('## Metadados', '');
  lines.push(`- Autor: ${book.author?.trim() || 'Não informado'}`);
  lines.push(`- Categoria: ${book.category?.trim() || 'Não informado'}`);
  lines.push(`- Status: ${STATUS_LABELS[book.status] ?? book.status}`);
  lines.push(`- Progresso: ${progressPercent(book)}%`);
  lines.push(`- Página atual: ${book.currentPage} de ${book.totalPages}`);
  lines.push(`- Última abertura: ${formatMarkdownDate(book.lastOpenedAt)}`);
  lines.push(`- Última leitura: ${formatMarkdownDate(lastSessionDate(sessions))}`, '');

  lines.push('## Resumo de leitura', '');
  lines.push(`- Tempo total lido: ${formatMarkdownDuration(getTotalReadingTime(sessions))}`);
  lines.push(`- Sessões registradas: ${sessions.length}`);
  lines.push(`- Páginas avançadas estimadas: ${getTotalPagesRead(sessions)}`, '');

  lines.push(...renderReviewSection(review, annotations));
  lines.push(...renderAnnotationSection(annotations));
  lines.push(...renderSessionsSection(sessions));

  lines.push('## Dados técnicos', '');
  lines.push(`- Book ID: ${book.id}`);
  lines.push(`- Export gerado em: ${generatedAt}`);

  return lines.join('\n');
}
