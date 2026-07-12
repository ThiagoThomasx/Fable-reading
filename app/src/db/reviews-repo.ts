/**
 * Acesso à store 'reviews' (BookReview — no máximo uma por livro, chaveada
 * diretamente por bookId). Toda escrita é imutável: upsertReview substitui o
 * registro inteiro; quem chama monta o objeto final (ver useReviewStore).
 */
import { getDb } from './db';
import type { BookReview } from '../types/models';

export async function getReviewByBook(bookId: string): Promise<BookReview | undefined> {
  const db = await getDb();
  return db.get('reviews', bookId);
}

/** Todas as reviews, de todos os livros — usado por backup e verificação de integridade. */
export async function listAllReviews(): Promise<BookReview[]> {
  const db = await getDb();
  return db.getAll('reviews');
}

export async function upsertReview(review: BookReview): Promise<BookReview> {
  const db = await getDb();
  await db.put('reviews', review);
  return review;
}

/** Remove a review de um livro (no-op seguro se não existir) — usado no cascade de exclusão. */
export async function deleteReviewForBook(bookId: string): Promise<void> {
  const db = await getDb();
  await db.delete('reviews', bookId);
}
