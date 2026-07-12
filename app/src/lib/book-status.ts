/** Rótulos e ordem de exibição dos 5 status de leitura — compartilhado entre tile, filtro e edição. */
import type { BookStatus } from '../types/models';

export const STATUS_LABELS: Record<BookStatus, string> = {
  want_to_read: 'Para ler',
  reading: 'Lendo',
  paused: 'Pausado',
  completed: 'Finalizado',
  abandoned: 'Abandonado',
};

export const STATUS_ORDER: BookStatus[] = [
  'reading',
  'want_to_read',
  'paused',
  'completed',
  'abandoned',
];
