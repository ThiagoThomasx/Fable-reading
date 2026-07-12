/**
 * Download client-side de um backup .json via Blob temporário. Depende do DOM
 * (document/URL), por isso fica separado dos módulos puros de backup.
 */
export function downloadBackupFile(filename: string, jsonContent: string): void {
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
