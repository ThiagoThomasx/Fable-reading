/**
 * Casca do spike: navegação manual (validação visual) + benchmark automatizado.
 * Expõe window.__spike.runFullBenchmark() para execução via automação.
 */
import { PdfEngine } from './pdf-engine';
import { runFullBenchmark, type PdfBenchResult } from './benchmark';
import { probeScale, type ScaleProbe } from './probe';

const canvas = document.getElementById('page-canvas') as HTMLCanvasElement;
const select = document.getElementById('pdf-select') as HTMLSelectElement;
const status = document.getElementById('status') as HTMLSpanElement;
const metrics = document.getElementById('metrics') as HTMLDivElement;
const indicator = document.getElementById('page-indicator') as HTMLSpanElement;

const manualEngine = new PdfEngine();
let currentPage = 1;

function setStatus(msg: string): void {
  status.textContent = msg;
}

function log(msg: string): void {
  metrics.textContent = `${msg}\n${metrics.textContent ?? ''}`;
}

async function openSelected(): Promise<void> {
  setStatus('carregando…');
  const t0 = performance.now();
  const response = await fetch(select.value);
  if (!response.ok) {
    setStatus(`erro HTTP ${response.status} — o PDF foi copiado para public/pdfs?`);
    return;
  }
  const data = await response.arrayBuffer();
  const fetchMs = performance.now() - t0;
  const { totalPages, openToFirstRenderMs } = await manualEngine.open(data, canvas);
  currentPage = 1;
  manualEngine.preloadNext(1);
  indicator.textContent = `1 / ${totalPages}`;
  setStatus('');
  log(
    `[manual] aberto ${select.value}: fetch ${fetchMs.toFixed(0)}ms, ` +
      `1ª página ${openToFirstRenderMs.toFixed(0)}ms, ${totalPages} páginas`,
  );
}

async function goTo(page: number): Promise<void> {
  if (page < 1 || page > manualEngine.totalPages) return;
  const { displayMs, fromCache } = await manualEngine.showPage(page, canvas);
  currentPage = page;
  indicator.textContent = `${page} / ${manualEngine.totalPages}`;
  log(`[manual] página ${page}: ${displayMs.toFixed(1)}ms ${fromCache ? '(cache)' : '(render)'}`);
}

document.getElementById('btn-open')?.addEventListener('click', () => void openSelected());
document.getElementById('btn-prev')?.addEventListener('click', () => void goTo(currentPage - 1));
document.getElementById('btn-next')?.addEventListener('click', () => void goTo(currentPage + 1));
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') void goTo(currentPage + 1);
  if (e.key === 'ArrowLeft') void goTo(currentPage - 1);
});

document.getElementById('btn-bench')?.addEventListener('click', () => {
  void runAndPrintBenchmark();
});

async function runAndPrintBenchmark(): Promise<PdfBenchResult[]> {
  await manualEngine.destroy();
  metrics.textContent = 'rodando benchmark…\n';
  const results = await runFullBenchmark(canvas, setStatus);
  metrics.textContent = JSON.stringify(results, null, 2);
  return results;
}

declare global {
  interface Window {
    __spike: {
      runFullBenchmark: () => Promise<PdfBenchResult[]>;
      probeScale: (url: string, widths: number[]) => Promise<ScaleProbe[]>;
    };
  }
}
window.__spike = { runFullBenchmark: runAndPrintBenchmark, probeScale };
