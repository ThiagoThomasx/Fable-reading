/**
 * Validação pura de integridade referencial da biblioteca. Não acessa IndexedDB
 * nem depende de React — opera só sobre snapshots já carregados (arrays de
 * Book/ReadingSession/ReadingAnnotation + a lista de chaves da store 'files').
 * Usado pela UI de Data Safety (Sprint 10) e por testes.
 */
import type { Book, ReadingAnnotation, ReadingSession, BookReview } from '../types/models';

export type IntegritySeverity = 'warning' | 'error';
export type IntegrityEntityType = 'book' | 'file' | 'session' | 'annotation' | 'review';

export type IntegrityIssue = {
  severity: IntegritySeverity;
  code: string;
  message: string;
  entityType: IntegrityEntityType;
  entityId?: string;
};

export type IntegrityReport = {
  ok: boolean;
  issues: IntegrityIssue[];
};

export type LibrarySnapshot = {
  books: Book[];
  /** Chaves presentes na store 'files' (bookId de cada Blob salvo). */
  fileIds: string[];
  sessions: ReadingSession[];
  annotations: ReadingAnnotation[];
  reviews: BookReview[];
};

function bookIdSet(books: Book[]): Set<string> {
  return new Set(books.map((book) => book.id));
}

/** Livros cujo fileRef não tem Blob correspondente na store 'files'. */
export function findBooksMissingFile(books: Book[], fileIds: string[]): Book[] {
  const files = new Set(fileIds);
  return books.filter((book) => !files.has(book.fileRef));
}

/** Blobs em 'files' sem nenhum livro que os referencie (fileRef). */
export function findOrphanFiles(books: Book[], fileIds: string[]): string[] {
  const referenced = new Set(books.map((book) => book.fileRef));
  return fileIds.filter((id) => !referenced.has(id));
}

/** Sessões cujo bookId não corresponde a nenhum livro existente. */
export function findOrphanSessions(sessions: ReadingSession[], books: Book[]): ReadingSession[] {
  const ids = bookIdSet(books);
  return sessions.filter((session) => !ids.has(session.bookId));
}

/** Anotações cujo bookId não corresponde a nenhum livro existente. */
export function findOrphanAnnotations(
  annotations: ReadingAnnotation[],
  books: Book[],
): ReadingAnnotation[] {
  const ids = bookIdSet(books);
  return annotations.filter((annotation) => !ids.has(annotation.bookId));
}

/** Reviews cujo bookId não corresponde a nenhum livro existente. */
export function findOrphanReviews(reviews: BookReview[], books: Book[]): BookReview[] {
  const ids = bookIdSet(books);
  return reviews.filter((review) => !ids.has(review.bookId));
}

/** Reviews cujo favoriteAnnotationIds referencia alguma anotação que não existe mais. */
export function findReviewsWithMissingFavorites(
  reviews: BookReview[],
  annotations: ReadingAnnotation[],
): BookReview[] {
  const annotationIds = new Set(annotations.map((annotation) => annotation.id));
  return reviews.filter((review) =>
    (review.favoriteAnnotationIds ?? []).some((id) => !annotationIds.has(id)),
  );
}

function isValidPage(page: number, totalPages: number): boolean {
  return Number.isInteger(page) && page >= 1 && page <= totalPages;
}

/**
 * Sessões com startPage/endPage fora do intervalo válido do livro (1..totalPages)
 * ou com endPage < startPage. Ignora sessões órfãs (sem livro para validar contra).
 */
export function findInvalidSessions(
  sessions: ReadingSession[],
  books: Book[],
): ReadingSession[] {
  const byId = new Map(books.map((book) => [book.id, book]));
  return sessions.filter((session) => {
    const book = byId.get(session.bookId);
    if (!book) return false;
    if (!isValidPage(session.startPage, book.totalPages)) return true;
    if (!isValidPage(session.endPage, book.totalPages)) return true;
    if (session.endPage < session.startPage) return true;
    return false;
  });
}

/**
 * Anotações com página fora do intervalo válido do livro, ou highlights sem
 * quoteText/textAnchor.rects. Ignora anotações órfãs (sem livro para validar contra).
 */
export function findInvalidAnnotations(
  annotations: ReadingAnnotation[],
  books: Book[],
): ReadingAnnotation[] {
  const byId = new Map(books.map((book) => [book.id, book]));
  return annotations.filter((annotation) => {
    const book = byId.get(annotation.bookId);
    if (!book) return false;
    if (!isValidPage(annotation.page, book.totalPages)) return true;
    if (annotation.type === 'highlight') {
      const missingQuote = !annotation.quoteText?.trim();
      const missingRects = !annotation.textAnchor?.rects || annotation.textAnchor.rects.length === 0;
      if (missingQuote || missingRects) return true;
    }
    return false;
  });
}

/** Livros com currentPage fora do intervalo válido (1..totalPages). */
export function findInvalidBooks(books: Book[]): Book[] {
  return books.filter((book) => !isValidPage(book.currentPage, book.totalPages));
}

/** Bookmarks duplicados (mesmo bookId + página) — mantém o mais antigo como válido. */
export function findDuplicateBookmarks(annotations: ReadingAnnotation[]): ReadingAnnotation[] {
  const groups = new Map<string, ReadingAnnotation[]>();
  for (const annotation of annotations) {
    if (annotation.type !== 'bookmark') continue;
    const key = `${annotation.bookId}:${annotation.page}`;
    const group = groups.get(key);
    if (group) {
      group.push(annotation);
    } else {
      groups.set(key, [annotation]);
    }
  }

  const duplicates: ReadingAnnotation[] = [];
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    duplicates.push(...sorted.slice(1));
  }
  return duplicates;
}

export function validateLibraryIntegrity(snapshot: LibrarySnapshot): IntegrityReport {
  const { books, fileIds, sessions, annotations, reviews } = snapshot;
  const issues: IntegrityIssue[] = [];

  for (const book of findBooksMissingFile(books, fileIds)) {
    issues.push({
      severity: 'error',
      code: 'book-missing-file',
      message: `Livro "${book.title}" não tem arquivo PDF correspondente.`,
      entityType: 'book',
      entityId: book.id,
    });
  }

  for (const fileId of findOrphanFiles(books, fileIds)) {
    issues.push({
      severity: 'warning',
      code: 'orphan-file',
      message: `Arquivo PDF órfão (sem livro correspondente): ${fileId}.`,
      entityType: 'file',
      entityId: fileId,
    });
  }

  for (const session of findOrphanSessions(sessions, books)) {
    issues.push({
      severity: 'warning',
      code: 'orphan-session',
      message: `Sessão de leitura órfã (livro não encontrado): ${session.id}.`,
      entityType: 'session',
      entityId: session.id,
    });
  }

  for (const annotation of findOrphanAnnotations(annotations, books)) {
    issues.push({
      severity: 'warning',
      code: 'orphan-annotation',
      message: `Anotação órfã (livro não encontrado): ${annotation.id}.`,
      entityType: 'annotation',
      entityId: annotation.id,
    });
  }

  for (const session of findInvalidSessions(sessions, books)) {
    issues.push({
      severity: 'error',
      code: 'invalid-session-page',
      message: `Sessão com páginas inválidas para o livro: ${session.id}.`,
      entityType: 'session',
      entityId: session.id,
    });
  }

  for (const annotation of findInvalidAnnotations(annotations, books)) {
    issues.push({
      severity: 'error',
      code: 'invalid-annotation',
      message: `Anotação inválida (página fora do intervalo ou highlight incompleto): ${annotation.id}.`,
      entityType: 'annotation',
      entityId: annotation.id,
    });
  }

  for (const book of findInvalidBooks(books)) {
    issues.push({
      severity: 'error',
      code: 'invalid-current-page',
      message: `Livro "${book.title}" tem currentPage fora do intervalo válido.`,
      entityType: 'book',
      entityId: book.id,
    });
  }

  for (const bookmark of findDuplicateBookmarks(annotations)) {
    issues.push({
      severity: 'warning',
      code: 'duplicate-bookmark',
      message: `Bookmark duplicado na mesma página: ${bookmark.id}.`,
      entityType: 'annotation',
      entityId: bookmark.id,
    });
  }

  for (const review of findOrphanReviews(reviews, books)) {
    issues.push({
      severity: 'warning',
      code: 'orphan-review',
      message: `Review órfã (livro não encontrado): ${review.bookId}.`,
      entityType: 'review',
      entityId: review.bookId,
    });
  }

  for (const review of findReviewsWithMissingFavorites(reviews, annotations)) {
    issues.push({
      severity: 'warning',
      code: 'review-missing-favorite',
      message: `Review referencia highlight(s) favorito(s) que não existem mais: ${review.bookId}.`,
      entityType: 'review',
      entityId: review.bookId,
    });
  }

  return {
    ok: issues.every((issue) => issue.severity !== 'error'),
    issues,
  };
}
