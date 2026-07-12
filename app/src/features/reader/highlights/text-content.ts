/**
 * Detecção pura de página sem texto extraível (PDF escaneado/imagem) — usada
 * pelo `TextLayerOverlay` para decidir o fallback sem tentar OCR (fora de
 * escopo, ver CLAUDE.md).
 */
export function hasExtractableText(items: readonly unknown[]): boolean {
  return items.some((item) => {
    if (typeof item !== 'object' || item === null || !('str' in item)) return false;
    const str = (item as { str: unknown }).str;
    return typeof str === 'string' && str.trim().length > 0;
  });
}
