/**
 * Geração de bitmaps comprimidos (JPEG data URL) a partir de páginas
 * renderizadas — usada para o lastPageSnapshot (abertura instantânea) e para
 * thumbnails de capa. Nunca guardar página em resolução real (ver CLAUDE.md).
 */

export const SNAPSHOT_MAX_WIDTH = 600;
export const SNAPSHOT_JPEG_QUALITY = 0.72;
export const COVER_MAX_WIDTH = 300;
export const COVER_JPEG_QUALITY = 0.8;

export function bitmapToJpegDataUrl(
  bitmap: ImageBitmap,
  maxWidth: number = SNAPSHOT_MAX_WIDTH,
  quality: number = SNAPSHOT_JPEG_QUALITY,
): string {
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Converte um arquivo de imagem (capa manual) em thumbnail JPEG ~300px. */
export async function imageFileToThumbnail(
  file: File,
  maxWidth: number = COVER_MAX_WIDTH,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    return bitmapToJpegDataUrl(bitmap, maxWidth, COVER_JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}
