/**
 * Serialização pura do backup completo. Não acessa IndexedDB — opera só sobre
 * arrays/entries já carregados (ver backup-io.ts para a leitura do IndexedDB
 * e conversão de Blobs para Base64).
 */
import type { Book, ReadingAnnotation, ReadingSession, BookReview } from '../types/models';
import { BACKUP_FORMAT_VERSION, type BackupFileEntry, type ReadQuestBackup } from '../types/backup';

export type AssembleBackupInput = {
  books: Book[];
  files: BackupFileEntry[];
  sessions: ReadingSession[];
  annotations: ReadingAnnotation[];
  reviews: BookReview[];
  schemaVersion: number;
  /** ISO string; permite backups determinísticos em testes. Default: `new Date().toISOString()`. */
  generatedAt?: string;
};

export function assembleBackup(input: AssembleBackupInput): ReadQuestBackup {
  return {
    app: 'readquest',
    version: BACKUP_FORMAT_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    schemaVersion: input.schemaVersion,
    books: input.books,
    files: input.files,
    sessions: input.sessions,
    annotations: input.annotations,
    reviews: input.reviews,
  };
}

export function serializeBackup(backup: ReadQuestBackup): string {
  return JSON.stringify(backup, null, 2);
}

/** Nome de arquivo sugerido para o download do backup, com timestamp para não colidir. */
export function backupFilename(generatedAt: string = new Date().toISOString()): string {
  const safeTimestamp = generatedAt.replace(/[:.]/g, '-');
  return `readquest-backup-${safeTimestamp}.json`;
}
