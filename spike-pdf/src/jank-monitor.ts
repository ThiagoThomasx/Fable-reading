/**
 * Mede travamento da main thread durante uma fase do benchmark:
 * - Long Tasks (>50ms) via PerformanceObserver
 * - Maior gap entre frames de requestAnimationFrame
 *
 * Critério do Sprint 0: "UI nunca trava durante o render".
 */
export type JankReport = {
  longTaskCount: number;
  longTaskTotalMs: number;
  longestTaskMs: number;
  /** maior intervalo entre dois frames consecutivos (16.7ms = 60fps perfeito) */
  maxFrameGapMs: number;
};

export class JankMonitor {
  private observer: PerformanceObserver | null = null;
  private rafId = 0;
  private lastFrameTs = 0;
  private report: JankReport = emptyReport();

  start(): void {
    this.report = emptyReport();

    if ('PerformanceObserver' in window) {
      try {
        this.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.report = {
              ...this.report,
              longTaskCount: this.report.longTaskCount + 1,
              longTaskTotalMs: this.report.longTaskTotalMs + entry.duration,
              longestTaskMs: Math.max(this.report.longestTaskMs, entry.duration),
            };
          }
        });
        this.observer.observe({ type: 'longtask', buffered: false });
      } catch {
        this.observer = null; // longtask não suportado — ficamos só com o rAF
      }
    }

    this.lastFrameTs = performance.now();
    const tick = (ts: number) => {
      const gap = ts - this.lastFrameTs;
      if (gap > this.report.maxFrameGapMs) {
        this.report = { ...this.report, maxFrameGapMs: gap };
      }
      this.lastFrameTs = ts;
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): JankReport {
    cancelAnimationFrame(this.rafId);
    this.observer?.disconnect();
    this.observer = null;
    return this.report;
  }
}

function emptyReport(): JankReport {
  return { longTaskCount: 0, longTaskTotalMs: 0, longestTaskMs: 0, maxFrameGapMs: 0 };
}
