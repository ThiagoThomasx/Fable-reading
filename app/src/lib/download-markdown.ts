/**
 * Download client-side de um arquivo .md via Blob temporário. Depende do DOM (document/URL),
 * por isso fica separado de export-markdown.ts (que é puro e testável em Node/Vitest).
 */
export function downloadMarkdownFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
