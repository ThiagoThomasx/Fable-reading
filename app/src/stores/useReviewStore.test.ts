import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests } from '../db/db';
import { useReviewStore } from './useReviewStore';

const BOOK_ID = 'book-1';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  useReviewStore.setState({ review: null, loadedBookId: null, error: null, allReviews: [], isAllLoaded: false });
});

describe('useReviewStore.loadForBook', () => {
  it('sets review to null when the book has no review yet', async () => {
    await useReviewStore.getState().loadForBook(BOOK_ID);

    expect(useReviewStore.getState().review).toBeNull();
    expect(useReviewStore.getState().loadedBookId).toBe(BOOK_ID);
    expect(useReviewStore.getState().error).toBeNull();
  });
});

describe('useReviewStore.save', () => {
  it('creates a new review and persists it in IndexedDB', async () => {
    // Arrange
    await useReviewStore.getState().loadForBook(BOOK_ID);

    // Act
    await useReviewStore.getState().save(BOOK_ID, { rating: 4.5, title: 'Muito bom' });

    // Assert
    const { review } = useReviewStore.getState();
    expect(review?.rating).toBe(4.5);
    expect(review?.title).toBe('Muito bom');
    expect(review?.bookId).toBe(BOOK_ID);
    expect(review?.createdAt).toBeDefined();
    expect(review?.updatedAt).toBeDefined();
  });

  it('never creates a second review for the same book — save always upserts', async () => {
    // Arrange
    await useReviewStore.getState().loadForBook(BOOK_ID);
    await useReviewStore.getState().save(BOOK_ID, { rating: 3 });

    // Act
    await useReviewStore.getState().save(BOOK_ID, { rating: 5, body: 'Revisado' });

    // Assert
    const { review } = useReviewStore.getState();
    expect(review?.rating).toBe(5);
    expect(review?.body).toBe('Revisado');
  });

  it('preserves createdAt across updates while bumping updatedAt', async () => {
    // Arrange
    await useReviewStore.getState().loadForBook(BOOK_ID);
    await useReviewStore.getState().save(BOOK_ID, { rating: 3 });
    const firstCreatedAt = useReviewStore.getState().review?.createdAt;

    // Act
    await new Promise((resolve) => setTimeout(resolve, 2));
    await useReviewStore.getState().save(BOOK_ID, { rating: 4 });

    // Assert
    const { review } = useReviewStore.getState();
    expect(review?.createdAt).toBe(firstCreatedAt);
    expect(review?.updatedAt).not.toBe(firstCreatedAt);
  });
});

describe('useReviewStore.remove', () => {
  it('deletes the review and clears it from state', async () => {
    // Arrange
    await useReviewStore.getState().loadForBook(BOOK_ID);
    await useReviewStore.getState().save(BOOK_ID, { rating: 4 });
    expect(useReviewStore.getState().review).not.toBeNull();

    // Act
    await useReviewStore.getState().remove(BOOK_ID);

    // Assert
    expect(useReviewStore.getState().review).toBeNull();
  });
});

describe('useReviewStore.loadAll', () => {
  it('loads every review across books into allReviews', async () => {
    // Arrange
    await useReviewStore.getState().save('a', { rating: 4 });
    await useReviewStore.getState().save('b', { rating: 2 });

    // Act
    await useReviewStore.getState().loadAll();

    // Assert
    const { allReviews, isAllLoaded } = useReviewStore.getState();
    expect(isAllLoaded).toBe(true);
    expect(allReviews.map((review) => review.bookId).sort()).toEqual(['a', 'b']);
  });
});
