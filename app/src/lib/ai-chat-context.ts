/**
 * Sprint 14 (spike) — helper puro de contexto conversacional "RAG simples": em vez de
 * embeddings/vetores (fora do escopo desta sprint), reaproveita o índice de busca local
 * já existente (lib/search-index.ts, Sprint 12) como mecanismo de retrieval — casamento
 * de substring sobre título/autor/categoria/notas/highlights/marcadores/review/sessões.
 * Não acessa IndexedDB nem o Blob do PDF — opera só sobre os arrays já carregados pelos
 * stores, igual a lib/ai-context.ts e lib/export-markdown.ts.
 */
import type { Book, ReadingAnnotation, BookReview, ReadingSession } from '../types/models';
import { buildSearchIndex, searchLibrary, SEARCH_TYPE_LABELS, type ScoredSearchResult } from './search-index';
import { escapeMarkdownQuote } from './export-markdown';

export const AI_CHAT_SYSTEM_PROMPT =
  'Você é um assistente de leitura do ReadQuest. Responda usando apenas o contexto ' +
  'recuperado da biblioteca local do usuário (abaixo). Não invente informações que não ' +
  'estejam no contexto — se o contexto não for suficiente, diga isso claramente.';

export type AiChatContextInput = {
  /** Pergunta/mensagem do usuário — usada como query de retrieval. */
  query: string;
  books: Book[];
  annotations: ReadingAnnotation[];
  reviews: BookReview[];
  sessions: ReadingSession[];
  /** Restringe o retrieval a um livro específico; omitido = toda a biblioteca. */
  bookId?: string;
  /** Quantos trechos incluir no contexto. Default: 6. */
  maxSources?: number;
};

export type AiChatContext = {
  /** Bloco Markdown pronto para enviar ao provider (ou copiar manualmente). */
  contextText: string;
  /** Trechos que compuseram o contexto — para exibir "fontes" na UI. */
  sources: ScoredSearchResult[];
};

const DEFAULT_MAX_SOURCES = 6;

/**
 * Recupera trechos relevantes da biblioteca local para uma pergunta e monta um bloco de
 * contexto Markdown. Se a query estiver vazia ou nenhum trecho local casar com ela, retorna
 * contexto vazio (a UI decide como lidar com isso) — nunca lança erro.
 */
export function buildAiChatContext(input: AiChatContextInput): AiChatContext {
  const trimmedQuery = input.query.trim();
  const maxSources = input.maxSources ?? DEFAULT_MAX_SOURCES;

  const scopedBooks = input.bookId ? input.books.filter((book) => book.id === input.bookId) : input.books;
  const scopedBookIds = new Set(scopedBooks.map((book) => book.id));

  if (!trimmedQuery || scopedBooks.length === 0) {
    return { contextText: '', sources: [] };
  }

  const index = buildSearchIndex({
    books: scopedBooks,
    annotations: input.annotations.filter((annotation) => scopedBookIds.has(annotation.bookId)),
    reviews: input.reviews.filter((review) => scopedBookIds.has(review.bookId)),
    sessions: input.sessions.filter((session) => scopedBookIds.has(session.bookId)),
  });

  const sources = searchLibrary(trimmedQuery, index).slice(0, maxSources);

  const lines: string[] = [];
  lines.push(`# Contexto recuperado (busca local) — pergunta: "${trimmedQuery}"`, '');

  if (sources.length === 0) {
    lines.push(
      'Nenhum trecho da sua biblioteca local casou com essa pergunta (busca por palavra-chave, ' +
        'sem sinônimos/semântica).',
      '',
    );
  } else {
    lines.push(`${sources.length} trecho(s) encontrado(s) por busca local (não é busca semântica):`, '');
    for (const source of sources) {
      const label = SEARCH_TYPE_LABELS[source.type];
      const pageInfo = source.page !== undefined ? ` — página ${source.page}` : '';
      lines.push(`## ${label} — ${source.bookTitle}${pageInfo}`, '');
      lines.push(escapeMarkdownQuote(source.snippet), '');
    }
  }

  lines.push('---', '');
  lines.push(
    'Contexto gerado 100% localmente a partir dos seus dados no ReadQuest (IndexedDB). Nenhum ' +
      'dado saiu do navegador para gerar este bloco.',
  );

  return { contextText: lines.join('\n'), sources };
}
