/**
 * Acesso à store 'notes' (ReadingAnnotation — page_note/bookmark, com o modelo já
 * preparado para highlight textual futuro). Toda escrita é imutável: updateAnnotation
 * lê o registro, cria uma cópia com o patch aplicado e persiste a cópia.
 */
import { getDb } from './db';
import type { ReadingAnnotation, AnnotationPatch } from '../types/models';

export async function listAnnotationsForBook(bookId: string): Promise<ReadingAnnotation[]> {
  const db = await getDb();
  return db.getAllFromIndex('notes', 'by-book', bookId);
}

/** Todas as anotações, de todos os livros — usado por backup e verificação de integridade. */
export async function listAllAnnotations(): Promise<ReadingAnnotation[]> {
  const db = await getDb();
  return db.getAll('notes');
}

export async function getAnnotation(id: string): Promise<ReadingAnnotation | undefined> {
  const db = await getDb();
  return db.get('notes', id);
}

export async function createAnnotation(
  annotation: ReadingAnnotation,
): Promise<ReadingAnnotation> {
  const db = await getDb();
  await db.add('notes', annotation);
  return annotation;
}

export async function updateAnnotation(
  id: string,
  patch: AnnotationPatch,
): Promise<ReadingAnnotation> {
  const db = await getDb();
  const existing = await db.get('notes', id);
  if (!existing) {
    throw new Error(`Anotação não encontrada: ${id}`);
  }
  const updated: ReadingAnnotation = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await db.put('notes', updated);
  return updated;
}

export async function deleteAnnotation(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('notes', id);
}

/** Remove todas as anotações de um livro — usado no cascade de exclusão de livro. */
export async function deleteAnnotationsForBook(bookId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('notes', 'readwrite');
  const keys = await tx.store.index('by-book').getAllKeys(bookId);
  await Promise.all(keys.map((key) => tx.store.delete(key)));
  await tx.done;
}
