/**
 * Conversão Blob <-> Base64 para o backup completo (Sprint 10). Usa btoa/atob
 * globais (disponíveis tanto no navegador quanto no Node usado pelos testes)
 * em chunks para não estourar a pilha de chamadas com PDFs grandes.
 */
const CHUNK_SIZE = 0x8000; // 32KB por chunk

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/** Validação mínima de que uma string é Base64 válido, sem decodificar todo o conteúdo. */
export function isLikelyBase64(value: string): boolean {
  if (value.length === 0) return false;
  if (value.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}
