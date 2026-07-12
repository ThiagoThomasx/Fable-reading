/**
 * Utilitário DEV-only (nunca entra no bundle de produção — importado
 * dinamicamente atrás de import.meta.env.DEV): permite cadastrar um PDF de
 * teste via console, ex.:
 *   await window.__dev.seedFromUrl('/@fs/C:/caminho/para/arquivo.pdf', 'Título')
 */
import { useBookStore } from '../stores/useBookStore';

async function seedFromUrl(url: string, title?: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} ao baixar ${url}`);
  const blob = await response.blob();
  const name = title ?? url.split('/').pop()?.replace(/\.pdf$/i, '') ?? 'Amostra';
  const file = new File([blob], `${name}.pdf`, { type: 'application/pdf' });
  await useBookStore.getState().add({
    file,
    title: name,
    category: 'Dev',
    coverSource: 'extracted',
  });
}

declare global {
  interface Window {
    __dev?: { seedFromUrl: typeof seedFromUrl };
  }
}

window.__dev = { seedFromUrl };
