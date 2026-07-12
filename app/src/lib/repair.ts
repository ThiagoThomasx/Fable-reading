/**
 * Reparo seguro de problemas de integridade detectados por data-integrity.ts.
 * Ao contrário dos helpers de validação (puros), este módulo escreve no
 * IndexedDB — só reparos de baixo risco e reversíveis via backup são feitos
 * aqui (ver seção "Reparos não implementados" no ARCHITECTURE.md/CHANGELOG.md):
 * nunca reconstrói PDFs perdidos, nunca inventa livro para arquivo órfão, nunca
 * faz merge automático.
 */
import {
  findOrphanFiles,
  findOrphanSessions,
  findOrphanAnnotations,
  findInvalidBooks,
  findDuplicateBookmarks,
  findOrphanReviews,
  findReviewsWithMissingFavorites,
  type LibrarySnapshot,
} from './data-integrity';
import { deleteFile } from '../db/files-repo';
import { deleteSession } from '../db/sessions-repo';
import { deleteAnnotation } from '../db/notes-repo';
import { updateBook } from '../db/books-repo';
import { deleteReviewForBook, upsertReview } from '../db/reviews-repo';

export type RepairSummary = {
  removedOrphanFiles: number;
  removedOrphanSessions: number;
  removedOrphanAnnotations: number;
  fixedBooksCurrentPage: number;
  removedDuplicateBookmarks: number;
  removedOrphanReviews: number;
  cleanedReviewFavorites: number;
};

function clampToValidPage(currentPage: number, totalPages: number): number {
  const upperBound = Math.max(totalPages, 1);
  return Math.min(Math.max(currentPage, 1), upperBound);
}

/**
 * Executa todos os reparos seguros a partir de um snapshot já carregado.
 * Idempotente: rodar duas vezes seguidas na mesma biblioteca não tem efeito
 * adicional na segunda vez.
 */
export async function repairLibrary(snapshot: LibrarySnapshot): Promise<RepairSummary> {
  const orphanFiles = findOrphanFiles(snapshot.books, snapshot.fileIds);
  const orphanSessions = findOrphanSessions(snapshot.sessions, snapshot.books);
  const orphanAnnotations = findOrphanAnnotations(snapshot.annotations, snapshot.books);
  const invalidBooks = findInvalidBooks(snapshot.books);
  const duplicateBookmarks = findDuplicateBookmarks(snapshot.annotations);
  const orphanReviews = findOrphanReviews(snapshot.reviews, snapshot.books);
  const orphanReviewBookIds = new Set(orphanReviews.map((review) => review.bookId));
  // Reviews órfãs já são removidas inteiras abaixo — limpar favoritos só faz
  // sentido para reviews que continuam vinculadas a um livro existente.
  const reviewsWithMissingFavorites = findReviewsWithMissingFavorites(
    snapshot.reviews,
    snapshot.annotations,
  ).filter((review) => !orphanReviewBookIds.has(review.bookId));
  const annotationIds = new Set(snapshot.annotations.map((annotation) => annotation.id));

  await Promise.all(orphanFiles.map((id) => deleteFile(id)));
  await Promise.all(orphanSessions.map((session) => deleteSession(session.id)));
  await Promise.all(orphanAnnotations.map((annotation) => deleteAnnotation(annotation.id)));
  await Promise.all(
    invalidBooks.map((book) =>
      updateBook(book.id, { currentPage: clampToValidPage(book.currentPage, book.totalPages) }),
    ),
  );
  // Duplicatas de bookmark podem coincidir com anotações órfãs já removidas acima —
  // deleteAnnotation em uma chave inexistente é um no-op seguro (idb resolve undefined).
  await Promise.all(duplicateBookmarks.map((bookmark) => deleteAnnotation(bookmark.id)));
  await Promise.all(orphanReviews.map((review) => deleteReviewForBook(review.bookId)));
  await Promise.all(
    reviewsWithMissingFavorites.map((review) =>
      upsertReview({
        ...review,
        favoriteAnnotationIds: (review.favoriteAnnotationIds ?? []).filter((id) =>
          annotationIds.has(id),
        ),
        updatedAt: new Date().toISOString(),
      }),
    ),
  );

  return {
    removedOrphanFiles: orphanFiles.length,
    removedOrphanSessions: orphanSessions.length,
    removedOrphanAnnotations: orphanAnnotations.length,
    fixedBooksCurrentPage: invalidBooks.length,
    removedDuplicateBookmarks: duplicateBookmarks.length,
    removedOrphanReviews: orphanReviews.length,
    cleanedReviewFavorites: reviewsWithMissingFavorites.length,
  };
}
