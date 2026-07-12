/**
 * Sprint 13 — helper puro que monta um bloco de contexto/prompt para uso com IA externa
 * (ChatGPT, Claude, NotebookLM etc). Não acessa IndexedDB nem o Blob do PDF — opera só
 * sobre os arrays já carregados pelos stores (mesmo padrão de lib/export-markdown.ts,
 * cujos helpers de formatação/escape são reaproveitados aqui). Nenhum dado sai do
 * navegador: a saída é texto para o usuário copiar/colar manualmente.
 */
import type { Book, ReadingAnnotation, ReadingSession, BookReview } from '../types/models';
import { STATUS_LABELS } from './book-status';
import { progressPercent } from './book-progress';
import { getTotalReadingTime, getTotalPagesRead, formatDuration } from './dashboard-stats';
import {
  formatMarkdownDate,
  escapeMarkdownBody,
  escapeMarkdownQuote,
  escapeMarkdownLine,
  sortAnnotationsForExport,
  groupAnnotationsByPage,
  sortSessionsForExport,
} from './export-markdown';

export type AiContextSection =
  | 'metadata'
  | 'notes'
  | 'highlights'
  | 'bookmarks'
  | 'review'
  | 'sessions'
  | 'takeaways';

export const AI_CONTEXT_SECTION_ORDER: AiContextSection[] = [
  'metadata',
  'review',
  'takeaways',
  'highlights',
  'notes',
  'bookmarks',
  'sessions',
];

export const AI_SECTION_LABELS: Record<AiContextSection, string> = {
  metadata: 'Metadados',
  notes: 'Notas',
  highlights: 'Highlights',
  bookmarks: 'Marcadores',
  review: 'Review',
  sessions: 'Sessões de leitura',
  takeaways: 'Principais ideias',
};

export type AiPromptType = 'discussion' | 'quiz' | 'insights' | 'raw';

export const AI_PROMPT_TYPE_ORDER: AiPromptType[] = ['discussion', 'quiz', 'insights', 'raw'];

export const AI_PROMPT_TYPE_LABELS: Record<AiPromptType, string> = {
  discussion: 'Conversa e discussão',
  quiz: 'Perguntas de revisão',
  insights: 'Extrair insights e conexões',
  raw: 'Somente os dados (sem instrução)',
};

const PROMPT_INSTRUCTIONS: Record<AiPromptType, string> = {
  discussion:
    'Você é um parceiro de leitura. Use o contexto abaixo (extraído do ReadQuest) para conversar ' +
    'comigo sobre o livro, tirar dúvidas e explorar ideias relacionadas. Não invente informações ' +
    'que não estejam no contexto.',
  quiz:
    'Use o contexto abaixo (extraído do ReadQuest) para me testar sobre o conteúdo do livro: faça ' +
    'perguntas de revisão, uma de cada vez, e avalie minhas respostas antes de seguir para a próxima.',
  insights:
    'Use o contexto abaixo (extraído do ReadQuest) para identificar os principais insights, ' +
    'conexões entre ideias e sugestões de tópicos ou leituras relacionadas.',
  raw: '',
};

export type AiContextInput = {
  book: Book;
  sessions: ReadingSession[];
  annotations: ReadingAnnotation[];
  /** Ausente quando o livro não tem review — seção "Review" é omitida mesmo se selecionada. */
  review?: BookReview;
  sections: AiContextSection[];
  promptType: AiPromptType;
  /** ISO string; permite datas determinísticas em testes. Default: `new Date().toISOString()`. */
  generatedAt?: string;
};

function renderMetadataSection(book: Book, sessions: ReadingSession[]): string[] {
  return [
    '## Metadados',
    '',
    `- Título: ${book.title.trim() || 'Livro sem título'}`,
    `- Autor: ${book.author?.trim() || 'Não informado'}`,
    `- Categoria: ${book.category?.trim() || 'Não informado'}`,
    `- Status: ${STATUS_LABELS[book.status] ?? book.status}`,
    `- Progresso: ${progressPercent(book)}%`,
    `- Página atual: ${book.currentPage} de ${book.totalPages}`,
    `- Tempo total lido: ${formatDuration(getTotalReadingTime(sessions))}`,
    `- Páginas avançadas estimadas: ${getTotalPagesRead(sessions)}`,
    '',
  ];
}

function renderReviewSection(review: BookReview): string[] {
  const lines: string[] = ['## Review', ''];
  if (review.rating !== undefined) lines.push(`- Nota: ${review.rating.toFixed(1)} / 5`);
  if (review.finishedAt) lines.push(`- Finalizado em: ${formatMarkdownDate(review.finishedAt)}`);
  lines.push('');
  if (review.title?.trim()) lines.push(`### ${review.title.trim()}`, '');
  if (review.body?.trim()) lines.push(escapeMarkdownBody(review.body.trim()), '');
  return lines;
}

function renderTakeawaysSection(review: BookReview): string[] {
  if (!review.mainTakeaways || review.mainTakeaways.length === 0) return [];
  const lines: string[] = ['## Principais ideias', ''];
  for (const takeaway of review.mainTakeaways) {
    lines.push(`- ${escapeMarkdownLine(takeaway)}`);
  }
  lines.push('');
  return lines;
}

function renderAnnotationsByType(
  annotations: ReadingAnnotation[],
  type: ReadingAnnotation['type'],
  heading: string,
  emptyLabel: string,
  renderBody: (annotation: ReadingAnnotation) => string,
): string[] {
  const filtered = sortAnnotationsForExport(annotations.filter((a) => a.type === type));
  if (filtered.length === 0) return [`## ${heading}`, '', emptyLabel, ''];

  const lines: string[] = [`## ${heading}`, ''];
  const grouped = groupAnnotationsByPage(filtered);
  for (const [page, pageAnnotations] of grouped) {
    lines.push(`### Página ${page}`, '');
    for (const annotation of pageAnnotations) {
      lines.push(renderBody(annotation), '');
    }
  }
  return lines;
}

function renderNotesSection(annotations: ReadingAnnotation[]): string[] {
  return renderAnnotationsByType(annotations, 'page_note', 'Notas', 'Nenhuma nota registrada.', (a) =>
    a.body?.trim() ? escapeMarkdownBody(a.body.trim()) : '_Nota vazia._',
  );
}

function renderHighlightsSection(annotations: ReadingAnnotation[]): string[] {
  return renderAnnotationsByType(
    annotations,
    'highlight',
    'Highlights',
    'Nenhum highlight registrado.',
    (a) => (a.quoteText?.trim() ? escapeMarkdownQuote(a.quoteText.trim()) : '_Highlight sem texto._'),
  );
}

function renderBookmarksSection(annotations: ReadingAnnotation[]): string[] {
  return renderAnnotationsByType(
    annotations,
    'bookmark',
    'Marcadores',
    'Nenhum marcador registrado.',
    (a) => (a.body?.trim() ? escapeMarkdownBody(a.body.trim()) : 'Página marcada como importante.'),
  );
}

function renderSessionsSection(sessions: ReadingSession[]): string[] {
  if (sessions.length === 0) return ['## Sessões de leitura', '', 'Nenhuma sessão registrada.', ''];

  const lines: string[] = ['## Sessões de leitura', ''];
  for (const session of sortSessionsForExport(sessions)) {
    lines.push(`### ${formatMarkdownDate(session.startedAt)}`, '');
    lines.push(`- Duração: ${formatDuration(session.durationMs)}`);
    lines.push(`- Páginas: ${session.startPage} → ${session.endPage}`);
    const notes = session.notes?.trim();
    if (notes) lines.push(`- Nota da sessão: ${escapeMarkdownBody(notes)}`);
    lines.push('');
  }
  return lines;
}

/** Monta o bloco de prompt/contexto pronto para copiar. Seções ausentes ou sem dado equivalente são omitidas silenciosamente. */
export function generateAiContext(input: AiContextInput): string {
  const { book, sessions, annotations, review, sections, promptType } = input;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const selected = new Set(sections);

  const lines: string[] = [];
  lines.push(`# Contexto de leitura — ${book.title.trim() || 'Livro sem título'}`, '');

  const instruction = PROMPT_INSTRUCTIONS[promptType];
  if (instruction) {
    lines.push(instruction, '');
  }
  lines.push('---', '');

  for (const section of AI_CONTEXT_SECTION_ORDER) {
    if (!selected.has(section)) continue;
    switch (section) {
      case 'metadata':
        lines.push(...renderMetadataSection(book, sessions));
        break;
      case 'review':
        if (review) lines.push(...renderReviewSection(review));
        break;
      case 'takeaways':
        if (review) lines.push(...renderTakeawaysSection(review));
        break;
      case 'highlights':
        lines.push(...renderHighlightsSection(annotations));
        break;
      case 'notes':
        lines.push(...renderNotesSection(annotations));
        break;
      case 'bookmarks':
        lines.push(...renderBookmarksSection(annotations));
        break;
      case 'sessions':
        lines.push(...renderSessionsSection(sessions));
        break;
    }
  }

  lines.push('---', '');
  lines.push(
    `Gerado pelo ReadQuest em ${formatMarkdownDate(generatedAt)}. Dado 100% local — nada foi enviado a servidores externos.`,
  );

  return lines.join('\n');
}
