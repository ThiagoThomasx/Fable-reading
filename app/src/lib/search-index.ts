/**
 * Busca global local-first (Sprint 12): índice puro derivado de Book/ReadingAnnotation/
 * BookReview/ReadingSession já carregados em memória — nunca acessa IndexedDB nem a store
 * 'files'. `buildSearchIndex` monta os registros pesquisáveis uma vez; `searchLibrary` filtra
 * e pontua por query, para ser chamado a cada tecla sem reconstruir o índice inteiro.
 */
import type { Book, ReadingAnnotation, BookReview, ReadingSession } from '../types/models';

export type SearchResultType =
  | 'book_title'
  | 'book_author'
  | 'book_category'
  | 'page_note'
  | 'bookmark'
  | 'highlight'
  | 'review'
  | 'takeaway'
  | 'session_note';

export type SearchResult = {
  /** Estável e único no índice — usado como key de lista e para evitar duplicatas. */
  id: string;
  type: SearchResultType;
  bookId: string;
  bookTitle: string;
  /** Presente quando o resultado pode navegar para uma página específica do reader. */
  page?: number;
  /** Texto exibido no resultado (já truncado/formatado quando necessário). */
  snippet: string;
  /** Texto usado para casar com a query — pode ser mais longo que o snippet. */
  matchedText: string;
  updatedAt: string;
};

export type ScoredSearchResult = SearchResult & { score: number };

export type SearchIndexInput = {
  books: Book[];
  annotations: ReadingAnnotation[];
  reviews: BookReview[];
  sessions: ReadingSession[];
};

const TYPE_WEIGHT: Record<SearchResultType, number> = {
  book_title: 100,
  book_author: 70,
  book_category: 50,
  takeaway: 65,
  highlight: 60,
  page_note: 60,
  review: 55,
  session_note: 45,
  bookmark: 35,
};

/** Rótulos de tipo para exibição na UI de resultados. */
export const SEARCH_TYPE_LABELS: Record<SearchResultType, string> = {
  book_title: 'Livro',
  book_author: 'Autor',
  book_category: 'Categoria',
  page_note: 'Nota',
  bookmark: 'Marcador',
  highlight: 'Highlight',
  review: 'Review',
  takeaway: 'Ideia principal',
  session_note: 'Nota de sessão',
};

function buildBookResults(book: Book): SearchResult[] {
  const results: SearchResult[] = [
    {
      id: `book-title:${book.id}`,
      type: 'book_title',
      bookId: book.id,
      bookTitle: book.title,
      snippet: book.title,
      matchedText: book.title,
      updatedAt: book.updatedAt,
    },
  ];
  if (book.author?.trim()) {
    results.push({
      id: `book-author:${book.id}`,
      type: 'book_author',
      bookId: book.id,
      bookTitle: book.title,
      snippet: book.author.trim(),
      matchedText: book.author.trim(),
      updatedAt: book.updatedAt,
    });
  }
  if (book.category?.trim()) {
    results.push({
      id: `book-category:${book.id}`,
      type: 'book_category',
      bookId: book.id,
      bookTitle: book.title,
      snippet: book.category.trim(),
      matchedText: book.category.trim(),
      updatedAt: book.updatedAt,
    });
  }
  return results;
}

function buildAnnotationResult(
  annotation: ReadingAnnotation,
  book: Book,
): SearchResult | null {
  if (annotation.type === 'highlight') {
    const text = annotation.quoteText?.trim();
    if (!text) return null;
    return {
      id: `highlight:${annotation.id}`,
      type: 'highlight',
      bookId: book.id,
      bookTitle: book.title,
      page: annotation.page,
      snippet: text,
      matchedText: text,
      updatedAt: annotation.updatedAt,
    };
  }
  if (annotation.type === 'page_note') {
    const text = annotation.body?.trim();
    if (!text) return null;
    return {
      id: `note:${annotation.id}`,
      type: 'page_note',
      bookId: book.id,
      bookTitle: book.title,
      page: annotation.page,
      snippet: text,
      matchedText: text,
      updatedAt: annotation.updatedAt,
    };
  }
  // bookmark: só entra no índice quando tem corpo de texto (marcador "puro" não é pesquisável)
  const text = annotation.body?.trim();
  if (!text) return null;
  return {
    id: `bookmark:${annotation.id}`,
    type: 'bookmark',
    bookId: book.id,
    bookTitle: book.title,
    page: annotation.page,
    snippet: text,
    matchedText: text,
    updatedAt: annotation.updatedAt,
  };
}

function buildReviewResults(review: BookReview, book: Book): SearchResult[] {
  const results: SearchResult[] = [];
  const title = review.title?.trim();
  const body = review.body?.trim();
  if (title || body) {
    const snippet = [title, body].filter(Boolean).join(' — ');
    results.push({
      id: `review:${review.bookId}`,
      type: 'review',
      bookId: book.id,
      bookTitle: book.title,
      snippet,
      matchedText: snippet,
      updatedAt: review.updatedAt,
    });
  }
  (review.mainTakeaways ?? []).forEach((takeaway, index) => {
    const text = takeaway.trim();
    if (!text) return;
    results.push({
      id: `takeaway:${review.bookId}:${index}`,
      type: 'takeaway',
      bookId: book.id,
      bookTitle: book.title,
      snippet: text,
      matchedText: text,
      updatedAt: review.updatedAt,
    });
  });
  return results;
}

function buildSessionResult(session: ReadingSession, book: Book): SearchResult | null {
  const text = session.notes?.trim();
  if (!text) return null;
  return {
    id: `session:${session.id}`,
    type: 'session_note',
    bookId: book.id,
    bookTitle: book.title,
    page: session.endPage,
    snippet: text,
    matchedText: text,
    updatedAt: session.updatedAt,
  };
}

/** Monta o índice pesquisável a partir dos dados já carregados. Registros órfãos (sem livro) são ignorados. */
export function buildSearchIndex(input: SearchIndexInput): SearchResult[] {
  const bookById = new Map(input.books.map((book) => [book.id, book]));
  const results: SearchResult[] = [];

  for (const book of input.books) {
    results.push(...buildBookResults(book));
  }

  for (const annotation of input.annotations) {
    const book = bookById.get(annotation.bookId);
    if (!book) continue;
    const result = buildAnnotationResult(annotation, book);
    if (result) results.push(result);
  }

  for (const review of input.reviews) {
    const book = bookById.get(review.bookId);
    if (!book) continue;
    results.push(...buildReviewResults(review, book));
  }

  for (const session of input.sessions) {
    const book = bookById.get(session.bookId);
    if (!book) continue;
    const result = buildSessionResult(session, book);
    if (result) results.push(result);
  }

  return results;
}

/** Remove acentos e normaliza caixa para comparação — "café" casa com "cafe". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase();
}

/** Filtra e pontua o índice pré-construído contra uma query — barato o bastante para rodar a cada tecla. */
export function searchLibrary(query: string, index: SearchResult[]): ScoredSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const needle = normalize(trimmed);

  const scored: ScoredSearchResult[] = [];
  for (const entry of index) {
    const haystack = normalize(entry.matchedText);
    const matchIndex = haystack.indexOf(needle);
    if (matchIndex === -1) continue;

    let score = TYPE_WEIGHT[entry.type];
    if (matchIndex === 0) score += 20; // início da string
    if (haystack.length === needle.length) score += 15; // match exato
    score += Math.max(0, 10 - matchIndex); // levemente favorece matches mais cedo no texto

    scored.push({ ...entry, score });
  }

  return scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
