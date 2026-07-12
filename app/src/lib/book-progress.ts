/** Progresso de leitura (0–100) derivado de currentPage/totalPages — usado no tile e na ordenação. */
import type { Book } from '../types/models';

export function progressPercent(book: Book): number {
  if (book.totalPages <= 1) return 0;
  return Math.round(((book.currentPage - 1) / (book.totalPages - 1)) * 100);
}
