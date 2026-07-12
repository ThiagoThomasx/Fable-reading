/**
 * Validação pura de um backup antes de restaurar. Não acessa IndexedDB — só
 * inspeciona a estrutura já parseada do JSON (ver restore-io.ts para a escrita
 * no IndexedDB). Falha sempre no lado seguro: qualquer campo ausente ou de tipo
 * errado bloqueia a restauração inteira, nunca restaura parcialmente.
 */
import { BACKUP_FORMAT_VERSION } from '../types/backup';
import type { ReadQuestBackup } from '../types/backup';
import { isLikelyBase64 } from './base64';

export type BackupValidationResult =
  | { valid: true; backup: ReadQuestBackup }
  | { valid: false; errors: string[] };

export type ParsedBackupJson = { ok: true; data: unknown } | { ok: false; error: string };

/** Faz o parse do texto do arquivo; nunca lança — erros de JSON viram um resultado inválido. */
export function parseBackupJson(text: string): ParsedBackupJson {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, error: 'O arquivo selecionado não é um JSON válido.' };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function validateBookShape(value: unknown, index: number, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`books[${index}]: não é um objeto.`);
    return;
  }
  const stringFields = [
    'id',
    'title',
    'fileRef',
    'status',
    'category',
    'coverSource',
    'createdAt',
    'updatedAt',
  ];
  for (const field of stringFields) {
    if (!isNonEmptyString(value[field])) errors.push(`books[${index}].${field}: ausente ou inválido.`);
  }
  if (typeof value.totalPages !== 'number') errors.push(`books[${index}].totalPages: ausente ou inválido.`);
  if (typeof value.currentPage !== 'number') errors.push(`books[${index}].currentPage: ausente ou inválido.`);
  if (!Array.isArray(value.tags)) errors.push(`books[${index}].tags: ausente ou inválido.`);
}

function validateFileShape(value: unknown, index: number, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`files[${index}]: não é um objeto.`);
    return;
  }
  if (!isNonEmptyString(value.bookId)) errors.push(`files[${index}].bookId: ausente ou inválido.`);
  if (!isNonEmptyString(value.mimeType)) errors.push(`files[${index}].mimeType: ausente ou inválido.`);
  if (typeof value.size !== 'number') errors.push(`files[${index}].size: ausente ou inválido.`);
  const data = value.dataBase64;
  if (typeof data !== 'string') {
    errors.push(`files[${index}].dataBase64: ausente ou inválido.`);
  } else if (data.length > 0 && !isLikelyBase64(data)) {
    errors.push(`files[${index}].dataBase64: não parece Base64 válido.`);
  }
}

function validateSessionShape(value: unknown, index: number, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`sessions[${index}]: não é um objeto.`);
    return;
  }
  const stringFields = ['id', 'bookId', 'startedAt', 'endedAt', 'createdAt', 'updatedAt'];
  for (const field of stringFields) {
    if (!isNonEmptyString(value[field])) errors.push(`sessions[${index}].${field}: ausente ou inválido.`);
  }
  const numberFields = ['durationMs', 'startPage', 'endPage', 'pagesRead'];
  for (const field of numberFields) {
    if (typeof value[field] !== 'number') errors.push(`sessions[${index}].${field}: ausente ou inválido.`);
  }
}

function validateAnnotationShape(value: unknown, index: number, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`annotations[${index}]: não é um objeto.`);
    return;
  }
  const stringFields = ['id', 'bookId', 'type', 'createdAt', 'updatedAt'];
  for (const field of stringFields) {
    if (!isNonEmptyString(value[field])) errors.push(`annotations[${index}].${field}: ausente ou inválido.`);
  }
  if (typeof value.page !== 'number') errors.push(`annotations[${index}].page: ausente ou inválido.`);
}

function validateReviewShape(value: unknown, index: number, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`reviews[${index}]: não é um objeto.`);
    return;
  }
  const stringFields = ['bookId', 'createdAt', 'updatedAt'];
  for (const field of stringFields) {
    if (!isNonEmptyString(value[field])) errors.push(`reviews[${index}].${field}: ausente ou inválido.`);
  }
  if (value.rating !== undefined && typeof value.rating !== 'number') {
    errors.push(`reviews[${index}].rating: inválido.`);
  }
  if (value.mainTakeaways !== undefined && !Array.isArray(value.mainTakeaways)) {
    errors.push(`reviews[${index}].mainTakeaways: inválido.`);
  }
  if (value.favoriteAnnotationIds !== undefined && !Array.isArray(value.favoriteAnnotationIds)) {
    errors.push(`reviews[${index}].favoriteAnnotationIds: inválido.`);
  }
}

export function validateBackup(data: unknown): BackupValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(data)) {
    return { valid: false, errors: ['Arquivo de backup inválido: não é um objeto JSON.'] };
  }

  if (data.app !== 'readquest') {
    errors.push('Campo "app" ausente ou diferente de "readquest".');
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_FORMAT_VERSION) {
    errors.push(`Campo "version" ausente ou não suportado (máximo suportado: ${BACKUP_FORMAT_VERSION}).`);
  }
  if (typeof data.schemaVersion !== 'number') {
    errors.push('Campo "schemaVersion" ausente ou inválido.');
  }
  if (typeof data.generatedAt !== 'string') {
    errors.push('Campo "generatedAt" ausente ou inválido.');
  }
  if (!Array.isArray(data.books)) errors.push('Campo "books" ausente ou não é uma lista.');
  if (!Array.isArray(data.files)) errors.push('Campo "files" ausente ou não é uma lista.');
  if (!Array.isArray(data.sessions)) errors.push('Campo "sessions" ausente ou não é uma lista.');
  if (!Array.isArray(data.annotations)) errors.push('Campo "annotations" ausente ou não é uma lista.');
  if (!Array.isArray(data.reviews)) errors.push('Campo "reviews" ausente ou não é uma lista.');

  // Forma básica já quebrada: validar itens individuais só geraria ruído.
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  (data.books as unknown[]).forEach((book, index) => validateBookShape(book, index, errors));
  (data.files as unknown[]).forEach((file, index) => validateFileShape(file, index, errors));
  (data.sessions as unknown[]).forEach((session, index) => validateSessionShape(session, index, errors));
  (data.annotations as unknown[]).forEach((annotation, index) =>
    validateAnnotationShape(annotation, index, errors),
  );
  (data.reviews as unknown[]).forEach((review, index) => validateReviewShape(review, index, errors));

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, backup: data as unknown as ReadQuestBackup };
}
