/**
 * Escrita do backup validado no IndexedDB. Modo "substituir": cada store é
 * limpa e regravada a partir do backup — sem merge parcial (fora de escopo da
 * Sprint 10). Só deve ser chamado depois que restore.ts validar o backup.
 */
import { getDb } from '../db/db';
import { base64ToBlob } from './base64';
import type { ReadQuestBackup } from '../types/backup';
import type { Book, ReadingAnnotation, ReadingSession, BookReview } from '../types/models';

async function restoreBooks(books: Book[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('books', 'readwrite');
  await tx.store.clear();
  await Promise.all(books.map((book) => tx.store.put(book)));
  await tx.done;
}

async function restoreSessions(sessions: ReadingSession[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('sessions', 'readwrite');
  await tx.store.clear();
  await Promise.all(sessions.map((session) => tx.store.put(session)));
  await tx.done;
}

async function restoreAnnotations(annotations: ReadingAnnotation[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('notes', 'readwrite');
  await tx.store.clear();
  await Promise.all(annotations.map((annotation) => tx.store.put(annotation)));
  await tx.done;
}

async function restoreFiles(files: ReadQuestBackup['files']): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('files', 'readwrite');
  await tx.store.clear();
  await Promise.all(
    files.map((file) => tx.store.put(base64ToBlob(file.dataBase64, file.mimeType), file.bookId)),
  );
  await tx.done;
}

async function restoreReviews(reviews: BookReview[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('reviews', 'readwrite');
  await tx.store.clear();
  await Promise.all(reviews.map((review) => tx.store.put(review)));
  await tx.done;
}

/**
 * Substitui todo o conteúdo atual das 5 stores pelo conteúdo do backup.
 * Assumir que `backup` já passou por `validateBackup` — este módulo não
 * revalida a forma dos dados.
 */
export async function restoreFullBackup(backup: ReadQuestBackup): Promise<void> {
  await restoreBooks(backup.books);
  await restoreSessions(backup.sessions);
  await restoreAnnotations(backup.annotations);
  await restoreFiles(backup.files);
  await restoreReviews(backup.reviews);
}
