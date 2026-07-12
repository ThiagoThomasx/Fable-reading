/**
 * Ponte entre o IndexedDB e o backup puro (backup.ts). Único módulo que lê os
 * Blobs de PDF para gerar o backup completo — mantém a leitura de arquivos
 * grandes fora da UI e fora dos módulos puros/testáveis.
 */
import { DB_VERSION } from '../db/db';
import { listBooks } from '../db/books-repo';
import { listAllFiles } from '../db/files-repo';
import { listAllSessions } from '../db/sessions-repo';
import { listAllAnnotations } from '../db/notes-repo';
import { listAllReviews } from '../db/reviews-repo';
import { blobToBase64 } from './base64';
import { assembleBackup } from './backup';
import type { BackupFileEntry, ReadQuestBackup } from '../types/backup';

export async function createFullBackup(generatedAt?: string): Promise<ReadQuestBackup> {
  const [books, files, sessions, annotations, reviews] = await Promise.all([
    listBooks(),
    listAllFiles(),
    listAllSessions(),
    listAllAnnotations(),
    listAllReviews(),
  ]);

  const fileEntries: BackupFileEntry[] = await Promise.all(
    files.map(async ({ id, blob }) => ({
      bookId: id,
      mimeType: blob.type || 'application/pdf',
      size: blob.size,
      dataBase64: await blobToBase64(blob),
    })),
  );

  return assembleBackup({
    books,
    files: fileEntries,
    sessions,
    annotations,
    reviews,
    schemaVersion: DB_VERSION,
    generatedAt,
  });
}
