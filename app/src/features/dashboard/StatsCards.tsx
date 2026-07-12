/** Cards de métricas agregadas do Dashboard — leitura rápida, sem gráficos. */
import { formatDuration } from '../../lib/dashboard-stats';

type StatsCardsProps = {
  totalDurationMs: number;
  totalPagesRead: number;
  sessionCount: number;
  activeBookCount: number;
  lastReadAt: string | null;
  finishedBookCount: number;
};

function formatLastRead(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function StatsCards({
  totalDurationMs,
  totalPagesRead,
  sessionCount,
  activeBookCount,
  lastReadAt,
  finishedBookCount,
}: StatsCardsProps) {
  const cards = [
    { label: 'Tempo lido', value: formatDuration(totalDurationMs) },
    { label: 'Páginas avançadas', value: String(totalPagesRead) },
    { label: 'Sessões', value: String(sessionCount) },
    { label: 'Livros ativos', value: String(activeBookCount) },
    { label: 'Livros finalizados', value: String(finishedBookCount) },
    { label: 'Última leitura', value: formatLastRead(lastReadAt) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl bg-pure-white p-4 shadow-cover">
          <p className="text-xs text-graphite">{card.label}</p>
          <p className="mt-1 font-display text-2xl text-ink">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
