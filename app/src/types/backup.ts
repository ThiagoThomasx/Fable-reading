/**
 * Formato do backup completo do ReadQuest (Sprint 10). Documentado em DATA_MODEL.md —
 * qualquer mudança de formato exige incrementar BACKUP_FORMAT_VERSION e atualizar o .md.
 */
import type { Book, ReadingAnnotation, ReadingSession, BookReview } from './models';

/** Versão do formato do arquivo de backup em si (independente do schemaVersion do IndexedDB). */
export const BACKUP_FORMAT_VERSION = 1;

export type BackupFileEntry = {
  /** Chave na store 'files' — igual a Book.fileRef do livro correspondente. */
  bookId: string;
  mimeType: string;
  size: number;
  dataBase64: string;
};

export type ReadQuestBackup = {
  app: 'readquest';
  version: number;
  generatedAt: string;
  schemaVersion: number;
  books: Book[];
  files: BackupFileEntry[];
  sessions: ReadingSession[];
  annotations: ReadingAnnotation[];
  reviews: BookReview[];
};
