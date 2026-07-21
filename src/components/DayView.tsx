import type { Agent, Shift } from '../types';
import { CONTRAT_STYLES } from '../utils/colors';
import { JOURS_LABELS_COURT, formatColumnHeader, toISODate } from '../utils/date';
import { formatShiftCell, shiftDurationHours, decimalToFrench } from '../utils/time';

interface DayViewProps {
  agents: Agent[];
  shifts: Shift[];
  weekDates: Date[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onCellClick: (agent: Agent, jour: string, date: Date, shift?: Shift) => void;
}

/** Vue « par jour » : sélection d'un jour puis liste des agents en service, avec leurs horaires. */
export default function DayView({ agents, shifts, weekDates, selectedIndex, onSelectIndex, onCellClick }: DayViewProps) {
  const date = weekDates[selectedIndex];
  const iso = toISODate(date);

  const shiftByAgent = new Map<string, Shift>();
  for (const s of shifts) {
    if (s.jour === iso) shiftByAgent.set(s.agentId, s);
  }

  const working = agents
    .map((agent) => ({ agent, shift: shiftByAgent.get(agent.id) }))
    .filter((x) => x.shift && !x.shift.repos && x.shift.heureDebut != null)
    .sort((a, b) => (a.shift!.heureDebut ?? 0) - (b.shift!.heureDebut ?? 0));

  const others = agents
    .map((agent) => ({ agent, shift: shiftByAgent.get(agent.id) }))
    .filter((x) => !x.shift || x.shift.repos);

  const totalHours = working.reduce((sum, x) => sum + shiftDurationHours(x.shift), 0);

  return (
    <div className="flex-1 rounded-2xl bg-white p-4 shadow-card">
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {weekDates.map((d, i) => (
          <button
            key={toISODate(d)}
            onClick={() => onSelectIndex(i)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              i === selectedIndex ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {JOURS_LABELS_COURT[i]}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{formatColumnHeader(date)}</h2>
        <p className="text-xs text-gray-400">
          {working.length} agent{working.length > 1 ? 's' : ''} en service · {decimalToFrench(totalHours)} h
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-4 py-2.5">Agent</th>
              <th className="px-4 py-2.5">Contrat</th>
              <th className="px-4 py-2.5">Horaire</th>
              <th className="px-4 py-2.5 text-right">Durée</th>
            </tr>
          </thead>
          <tbody>
            {working.map(({ agent, shift }) => {
              const style = CONTRAT_STYLES[agent.contrat];
              return (
                <tr
                  key={agent.id}
                  onClick={() => onCellClick(agent, iso, date, shift)}
                  className="cursor-pointer border-t border-gray-100 transition hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {agent.prenom} {agent.nom}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.soft} ${style.text}`}>
                      {agent.contrat}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatShiftCell(shift)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{decimalToFrench(shiftDurationHours(shift))} h</td>
                </tr>
              );
            })}
            {working.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                  Aucun agent en service ce jour.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {others.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Repos / non planifiés
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {others.map(({ agent, shift }) => {
              const style = CONTRAT_STYLES[agent.contrat];
              return (
                <button
                  key={agent.id}
                  onClick={() => onCellClick(agent, iso, date, shift)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition hover:shadow-sm ${style.border} ${style.soft} ${style.text}`}
                >
                  {agent.prenom} {agent.nom} {shift?.repos && <span className="ml-1 text-gray-400">· D</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
