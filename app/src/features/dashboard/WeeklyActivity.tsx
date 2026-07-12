/** Mini barras dos últimos 7 dias — CSS puro, sem lib de gráficos. */
import type { DayActivity } from '../../lib/dashboard-stats';

type WeeklyActivityProps = {
  days: DayActivity[];
};

const WEEKDAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function weekdayLabel(dateKey: string): string {
  // dateKey é local (YYYY-MM-DD); parse manual evita deslocamento de timezone do Date().
  const [year, month, day] = dateKey.split('-').map(Number);
  return WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()];
}

export function WeeklyActivity({ days }: WeeklyActivityProps) {
  const maxDurationMs = Math.max(...days.map((day) => day.durationMs), 1);
  const hasActivity = days.some((day) => day.durationMs > 0);

  return (
    <div className="rounded-xl bg-pure-white p-5 shadow-cover">
      <h3 className="font-display text-base text-ink">Últimos 7 dias</h3>
      {!hasActivity && <p className="mt-1 text-xs text-graphite">Sem leituras registradas nesta semana.</p>}
      <div className="mt-4 flex items-end justify-between gap-2">
        {days.map((day) => {
          const heightPercent = Math.max(4, Math.round((day.durationMs / maxDurationMs) * 100));
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-24 w-full items-end">
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    day.durationMs > 0 ? 'bg-charcoal-plum' : 'bg-fog'
                  }`}
                  style={{ height: `${day.durationMs > 0 ? heightPercent : 6}%` }}
                  title={`${day.sessionCount} sessão(ões)`}
                />
              </div>
              <span className="text-[10px] uppercase text-graphite">{weekdayLabel(day.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
