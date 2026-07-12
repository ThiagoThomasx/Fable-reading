/**
 * Sondagem de um PDF no momento do cadastro: extrai o total de páginas e a
 * thumbnail da 1ª página (candidata a capa). Usa uma engine descartável com
 * worker próprio, destruída ao final — não interfere em leituras abertas.
 */
import { PdfEngine } from './pdf-engine';
import { bitmapToJpegDataUrl, COVER_MAX_WIDTH, COVER_JPEG_QUALITY } from './snapshot';

export type PdfProbe = {
  totalPages: number;
  coverDataUrl: string;
};

export async function probePdf(data: ArrayBuffer): Promise<PdfProbe> {
  const engine = new PdfEngine();
  try {
    const totalPages = await engine.open(data);
    const first = await engine.renderPage(1, COVER_MAX_WIDTH);
    const coverDataUrl = bitmapToJpegDataUrl(first.bitmap, COVER_MAX_WIDTH, COVER_JPEG_QUALITY);
    return { totalPages, coverDataUrl };
  } finally {
    await engine.destroy();
  }
}
