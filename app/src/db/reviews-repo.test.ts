import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests, getDb } from './db';
import {
  getReviewByBook,
  upsertReview,
  deleteReviewForBook,
  listAllReviews,
} from './reviews-repo';
import type { BookReview } from '../types/models';

const now = '2026-07-10T12:00:00.000Z';

function makeReview(overrides: Partial<BookReview> = {}): BookReview {
  return {
    bookId: 'book-1',
    rating: 4.5,
    title: 'Ótimo livro',
    body: 'Texto da review.',
    mainTakeaways: ['Ideia 1', 'Ideia 2'],
    favoriteAnnotationIds: ['highlight-1'],
    finishedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
});

describe('reviews-repo', () => {
  it('creates a review and reads it back by bookId', async () => {
    // Arrange
    const review = makeReview();

    // Act
    await upsertReview(review);
    const found = await getReviewByBook('book-1');

    // Assert
    expect(found).toEqual(review);
  });

  it('returns undefined for a book with no review', async () => {
    expect(await getReviewByBook('no-review')).toBeUndefined();
  });

  it('upsert replaces the existing review for the same book (max one per book)', async () => {
    // Arrange
    await upsertReview(makeReview({ rating: 3, title: 'Rascunho' }));

    // Act
    const updated = makeReview({ rating: 5, title: 'Versão final', updatedAt: '2026-07-11T00:00:00.000Z' });
    await upsertReview(updated);

    // Assert
    const found = await getReviewByBook('book-1');
    expect(found?.rating).toBe(5);
    expect(found?.title).toBe('Versão final');
    const all = await listAllReviews();
    expect(all).toHaveLength(1);
  });

  it('deletes a review for a book (no-op if it does not exist)', async () => {
    // Arrange
    await upsertReview(makeReview());

    // Act
    await deleteReviewForBook('book-1');
    await deleteReviewForBook('never-existed');

    // Assert
    expect(await getReviewByBook('book-1')).toBeUndefined();
  });

  it('lists every review across all books', async () => {
    // Arrange
    await upsertReview(makeReview({ bookId: 'a' }));
    await upsertReview(makeReview({ bookId: 'b' }));

    // Act
    const all = await listAllReviews();

    // Assert
    expect(all.map((review) => review.bookId).sort()).toEqual(['a', 'b']);
  });

  it('is keyed directly by bookId in the underlying store', async () => {
    // Arrange
    await upsertReview(makeReview({ bookId: 'book-1' }));

    // Act
    const db = await getDb();
    const stored = await db.get('reviews', 'book-1');

    // Assert
    expect(stored?.bookId).toBe('book-1');
  });
});
