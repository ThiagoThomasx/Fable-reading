/**
 * Overlay de text layer sob demanda (Sprint 9 — feature estável, promovida do
 * spike da Sprint 8, ver TEXT_LAYER_SPIKE.md). Renderiza o `TextLayer` do
 * pdfjs-dist sobre a página atual quando o modo seleção está ativo,
 * permitindo seleção real de texto em PDFs textuais e a criação de
 * highlights a partir dela.
 *
 * Isolado do reader padrão: só é montado quando `active` é true (modo
 * seleção ligado pelo usuário) — a extração/layout de texto nunca acontece
 * durante navegação comum (ver ARCHITECTURE.md).
 */
import { useEffect, useRef, useState } from 'react';
import { TextLayer } from 'pdfjs-dist';
import type { PdfEngine } from '../../../lib/pdf/pdf-engine';
import { hasExtractableText } from './text-content';
import { toRelativeRects, sortRectsReadingOrder } from './rects';
import type { SelectionCapture } from './create-highlight';

type Status = 'loading' | 'ready' | 'empty' | 'error';

type Props = {
  engine: PdfEngine | null;
  pageNumber: number;
  cssWidth: number;
  active: boolean;
  onSelectionCapture: (capture: SelectionCapture | null) => void;
};

export function TextLayerOverlay({
  engine,
  pageNumber,
  cssWidth,
  active,
  onSelectionCapture,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (!active || !engine) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    let cancelled = false;
    let layer: TextLayer | null = null;
    container.replaceChildren();
    setStatus('loading');

    (async () => {
      const page = await engine.getPageForTextLayer(pageNumber);
      if (!page || cancelled) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = cssWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const textContent = await page.getTextContent();
      if (cancelled) return;

      if (!hasExtractableText(textContent.items)) {
        // Sem spans do TextLayer para dimensionar o container via
        // setLayerDimensions — define manualmente para o aviso de fallback
        // cobrir a página inteira.
        container.style.width = `${viewport.width}px`;
        container.style.height = `${viewport.height}px`;
        setStatus('empty');
        return;
      }

      // pdf.js v4 desacopla o dimensionamento da viewport: setLayerDimensions
      // sempre lê viewport.rawDims (largura/altura NÃO escaladas da página) e
      // monta `calc(var(--scale-factor) * Npx)` no CSS — não usa viewport.width
      // diretamente. Por isso a escala real precisa ir na custom property, não
      // fica "embutida" na viewport passada ao construtor.
      container.style.setProperty('--scale-factor', String(viewport.scale));
      layer = new TextLayer({ textContentSource: textContent, container, viewport });
      await layer.render();
      if (cancelled) return;
      setStatus('ready');
    })().catch((error: unknown) => {
      if (!cancelled) {
        console.error('[Highlights] falha ao montar text layer', error);
        setStatus('error');
      }
    });

    return () => {
      cancelled = true;
      layer?.cancel();
    };
  }, [active, engine, pageNumber, cssWidth]);

  // Captura de seleção → repassa ao componente pai, que decide se vira highlight.
  useEffect(() => {
    if (!active) return undefined;
    const handleSelectionChange = () => {
      const container = containerRef.current;
      const selection = window.getSelection();
      if (!container || !selection || selection.rangeCount === 0) {
        onSelectionCapture(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const text = selection.toString();
      // Ignora seleções fora do text layer (ex.: usuário selecionando texto
      // dentro do painel de notas) — o painel não deve "roubar" a seleção.
      if (!text.trim() || !container.contains(range.commonAncestorContainer)) {
        onSelectionCapture(null);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const clientRects = Array.from(range.getClientRects());
      const rects = sortRectsReadingOrder(toRelativeRects(clientRects, containerRect));
      if (rects.length === 0) {
        onSelectionCapture(null);
        return;
      }

      const lastClientRect = clientRects[clientRects.length - 1];
      onSelectionCapture({
        page: pageNumber,
        text,
        rects,
        anchorClientRect: {
          top: lastClientRect.top,
          left: lastClientRect.left,
          bottom: lastClientRect.bottom,
          right: lastClientRect.right,
        },
      });
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [active, pageNumber, onSelectionCapture]);

  if (!active) return null;

  return (
    <>
      {/*
       * O container abaixo é gerenciado 100% de forma imperativa pelo
       * pdf.js (TextLayer#render / container.replaceChildren) — nunca deve
       * ter filhos declarados via JSX. Misturar as duas formas de gerência
       * de DOM no mesmo nó causa `NotFoundError: removeChild` quando o
       * React tenta reconciliar um filho que o pdf.js já removeu (bug
       * reproduzido na Sprint 8 — ver TEXT_LAYER_SPIKE.md). Por isso o aviso
       * de fallback é um irmão posicionado absolutamente, não um filho.
       */}
      <div ref={containerRef} className="text-layer absolute left-0 top-0" data-status={status} />
      {status === 'empty' && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white">
          Página sem texto extraível (provável scan/imagem) — sem seleção possível.
        </p>
      )}
      {status === 'error' && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white">
          Falha ao carregar text layer nesta página.
        </p>
      )}
    </>
  );
}
