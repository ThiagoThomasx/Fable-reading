/**
 * Benchmark automatizado do Sprint 0. Para cada PDF mede:
 *  1. fetch do arquivo (equivalente à leitura do Blob no IndexedDB)
 *  2. abertura: getDocument() → 1ª página visível  (critério: <500ms p/ ≤50MB)
 *  3. navegação sequencial com preload N+1 (cenário real de leitura)
 *  4. navegação para páginas em cache            (critério: <100ms)
 *  5. salto frio para página distante (sem cache) — informativo
 *  6. jank da main thread em cada fase           (critério: UI não trava)
 */
import { PdfEngine } from './pdf-engine';
import { JankMonitor, type JankReport } from './jank-monitor';

export type PdfTarget = { id: string; label: string; url: string };

export type NavSample = { page: number; displayMs: number; fromCache: boolean };

export type PdfBenchResult = {
  id: string;
  label: string;
  fileSizeMB: number;
  totalPages: number;
  fetchMs: number;
  openToFirstRenderMs: number;
  openBreakdown: { workerBootAndParseMs: number; firstPageRenderMs: number };
  totalOpenMs: number; // fetch + abertura (experiência completa do usuário)
  sequentialNav: NavSample[];
  cachedNav: NavSample[];
  cachedNavMaxMs: number;
  cachedNavAvgMs: number;
  coldJump: NavSample;
  jankOpen: JankReport;
  jankNav: JankReport;
  jankColdJump: JankReport;
};

export const PDF_TARGETS: PdfTarget[] = [
  { id: 'leve', label: 'Leve — A metamorfose (texto)', url: '/pdfs/leve.pdf' },
  { id: 'pesado', label: 'Pesado — Electrical Engineering (imagens)', url: '/pdfs/pesado.pdf' },
  { id: 'escaneado', label: 'Escaneado — Present Conflict of Ideals', url: '/pdfs/escaneado.pdf' },
];

const COLD_JUMP_PAGE = 50;

export async function benchmarkPdf(
  target: PdfTarget,
  canvas: HTMLCanvasElement,
  onStatus: (msg: string) => void,
): Promise<PdfBenchResult> {
  const engine = new PdfEngine();
  const jank = new JankMonitor();

  try {
    // Fase 1+2: fetch + abertura até 1ª página visível
    onStatus(`${target.id}: baixando arquivo…`);
    jank.start();
    const tFetch = performance.now();
    const response = await fetch(target.url);
    if (!response.ok) throw new Error(`HTTP ${response.status} em ${target.url}`);
    const data = await response.arrayBuffer();
    const fetchMs = performance.now() - tFetch;
    const fileSizeMB = data.byteLength / (1024 * 1024);

    onStatus(`${target.id}: abrindo 1ª página…`);
    const { totalPages, openToFirstRenderMs, breakdown } = await engine.open(data, canvas);
    const jankOpen = jank.stop();

    // Fase 3: navegação sequencial 2→4 no ritmo de leitura (preload termina antes)
    onStatus(`${target.id}: navegação sequencial…`);
    jank.start();
    engine.preloadNext(1);
    const sequentialNav: NavSample[] = [];
    for (const page of [2, 3, 4]) {
      await engine.waitForPreload();
      const { displayMs, fromCache } = await engine.showPage(page, canvas);
      sequentialNav.push({ page, displayMs, fromCache });
    }
    await engine.waitForPreload();

    // Fase 4: voltar para páginas garantidamente em cache (critério <100ms)
    onStatus(`${target.id}: navegação em cache…`);
    const cachedNav: NavSample[] = [];
    for (const page of [3, 2, 1, 2, 3, 4]) {
      const { displayMs, fromCache } = await engine.showPage(page, canvas);
      cachedNav.push({ page, displayMs, fromCache });
    }
    const jankNav = jank.stop();

    // Fase 5: salto frio para página distante, sem cache nem preload
    const jumpPage = Math.min(COLD_JUMP_PAGE, totalPages);
    onStatus(`${target.id}: salto frio p/ página ${jumpPage}…`);
    jank.start();
    const jump = await engine.showPage(jumpPage, canvas);
    const jankColdJump = jank.stop();

    const cachedTimes = cachedNav.map((s) => s.displayMs);
    return {
      id: target.id,
      label: target.label,
      fileSizeMB,
      totalPages,
      fetchMs,
      openToFirstRenderMs,
      openBreakdown: breakdown,
      totalOpenMs: fetchMs + openToFirstRenderMs,
      sequentialNav,
      cachedNav,
      cachedNavMaxMs: Math.max(...cachedTimes),
      cachedNavAvgMs: cachedTimes.reduce((a, b) => a + b, 0) / cachedTimes.length,
      coldJump: { page: jumpPage, displayMs: jump.displayMs, fromCache: jump.fromCache },
      jankOpen,
      jankNav,
      jankColdJump,
    };
  } finally {
    await engine.destroy();
  }
}

export async function runFullBenchmark(
  canvas: HTMLCanvasElement,
  onStatus: (msg: string) => void,
): Promise<PdfBenchResult[]> {
  const results: PdfBenchResult[] = [];
  for (const target of PDF_TARGETS) {
    results.push(await benchmarkPdf(target, canvas, onStatus));
  }
  onStatus('benchmark concluído');
  return results;
}
