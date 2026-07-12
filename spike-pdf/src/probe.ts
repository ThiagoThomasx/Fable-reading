/**
 * Sondagem de diagnóstico: mede o render da 1ª página em várias larguras-alvo
 * e um segundo render na mesma largura (com a imagem já decodificada).
 * Serve para distinguir custo de decode de imagem (fixo) vs rasterização (varia
 * com a escala) — define qual otimização recomendar no veredito do spike.
 */
import * as pdfjsLib from 'pdfjs-dist';

export type ScaleProbe = { widthPx: number; firstRenderMs: number; secondRenderMs: number };

export async function probeScale(url: string, widths: number[]): Promise<ScaleProbe[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  const data = await response.arrayBuffer();

  const worker = new pdfjsLib.PDFWorker({ name: `probe-${Date.now()}` });
  const doc = await pdfjsLib.getDocument({ data, worker }).promise;
  const results: ScaleProbe[] = [];

  try {
    for (const widthPx of widths) {
      const page = await doc.getPage(1);
      const scale = widthPx / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale });

      const renderOnce = async (): Promise<number> => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D indisponível');
        const t0 = performance.now();
        await page.render({ canvasContext: ctx, viewport }).promise;
        return performance.now() - t0;
      };

      const firstRenderMs = await renderOnce();
      const secondRenderMs = await renderOnce();
      page.cleanup(); // limpa recursos decodificados antes da próxima largura
      results.push({ widthPx, firstRenderMs, secondRenderMs });
    }
  } finally {
    await doc.destroy().catch(() => undefined);
    worker.destroy();
  }
  return results;
}
