/**
 * Carrega um LibrarySnapshot do IndexedDB para alimentar validateLibraryIntegrity
 * (data-integrity.ts) e repairLibrary (repair.ts) — ambos puros/agnósticos de IndexedDB.
 */
import { listBooks } from '../db/books-repo';
import { listAllFileIds } from '../db/files-repo';
import { listAllSessions } from '../db/sessions-repo';
import { listAllAnnotations } from '../db/notes-repo';
import { listAllReviews } from '../db/reviews-repo';
import type { LibrarySnapshot } from './data-integrity';

export async function loadLibrarySnapshot(): Promise<LibrarySnapshot> {
  const [books, fileIds, sessions, annotations, reviews] = await Promise.all([
    listBooks(),
    listAllFileIds(),
    listAllSessions(),
    listAllAnnotations(),
    listAllReviews(),
  ]);
  return { books, fileIds, sessions, annotations, reviews };
}
