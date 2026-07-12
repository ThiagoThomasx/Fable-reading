/**
 * Acesso à store 'files' (Blobs de PDF). Lida apenas ao abrir um livro no
 * reader ou ao cadastrar/remover — nunca em renders da biblioteca/dashboard.
 */
import { getDb } from './db';

export async function saveFile(id: string, blob: Blob): Promise<void> {
  const db = await getDb();
  await db.put('files', blob, id);
}

export async function loadFile(id: string): Promise<Blob | undefined> {
  const db = await getDb();
  return db.get('files', id);
}

export async function deleteFile(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('files', id);
}

/** Todas as chaves presentes na store 'files' — usado por backup e verificação de integridade. */
export async function listAllFileIds(): Promise<string[]> {
  const db = await getDb();
  return db.getAllKeys('files');
}

/**
 * Todos os Blobs da store 'files', pareados com suas chaves. getAllKeys/getAll
 * percorrem a mesma store em ordem ascendente de chave, garantindo o pareamento.
 */
export async function listAllFiles(): Promise<Array<{ id: string; blob: Blob }>> {
  const db = await getDb();
  const [keys, blobs] = await Promise.all([db.getAllKeys('files'), db.getAll('files')]);
  return keys.map((id, index) => ({ id, blob: blobs[index] }));
}
