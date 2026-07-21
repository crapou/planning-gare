import type { Agent, ContratType, Shift } from '../types';
import { CONTRAT_LABELS, CONTRAT_ORDER } from '../types';
import { CONTRAT_STYLES } from '../utils/colors';
import { JOURS_LABELS_COURT, formatDisplayDate, toISODate } from '../utils/date';
import { decimalToFrench, weeklyTheoreticalHours } from '../utils/time';
import ShiftCell from './ShiftCell';

interface PlanningGridProps {
  agents: Agent[];
  shifts: Shift[];
  weekDates: Date[];
  onCellClick: (agent: Agent, jour: string, date: Date, shift?: Shift) => void;
}

/** Vue principale « par agent » : lignes = agents groupés par contrat, colonnes = 7 jours. */
export default function PlanningGrid({ agents, shifts, weekDates, onCellClick }: PlanningGridProps) {
  const weekISOs = weekDates.map(toISODate);
  const shiftsByAgentDay = new Map<string, Shift>();
  for (const s of shifts) {
    if (weekISOs.includes(s.jour)) shiftsByAgentDay.set(`${s.agentId}__${s.jour}`, s);
  }

  const grouped = CONTRAT_ORDER.map((contrat) => ({
    contrat,
    agents: agents.filter((a) => a.contrat === contrat),
  })).filter((g) => g.agents.length > 0);

  if (agents.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-2xl bg-white p-12 text-center shadow-card">
        <p className="text-sm text-gray-400">
          Aucun agent. Ajoutez un agent depuis la barre latérale pour commencer le planning.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto rounded-2xl bg-white p-4 shadow-card scrollbar-thin">
      <table className="w-full border-separate" style={{ borderSpacing: '0 6px' }}>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-2 pb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Agent
            </th>
            {weekDates.map((date, i) => (
              <th key={toISODate(date)} className="px-2 pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {JOURS_LABELS_COURT[i]}
                <div className="text-[10px] font-normal normal-case text-gray-300">{formatDisplayDate(date)}</div>
              </th>
            ))}
            <th className="px-2 pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              H. théo.
            </th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ contrat, agents: groupAgents }) => (
            <GroupRows
              key={contrat}
              contrat={contrat}
              agents={groupAgents}
              weekDates={weekDates}
              weekISOs={weekISOs}
              shiftsByAgentDay={shiftsByAgentDay}
              onCellClick={onCellClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  contrat,
  agents,
  weekDates,
  weekISOs,
  shiftsByAgentDay,
  onCellClick,
}: {
  contrat: ContratType;
  agents: Agent[];
  weekDates: Date[];
  weekISOs: string[];
  shiftsByAgentDay: Map<string, Shift>;
  onCellClick: PlanningGridProps['onCellClick'];
}) {
  const style = CONTRAT_STYLES[contrat];
  return (
    <>
      <tr>
        <td colSpan={9} className="pb-1 pt-3 first:pt-0">
          <div className="flex items-center gap-1.5 px-1">
            <span className={`h-2 w-2 rounded-full ${style.band}`} />
            <span className={`text-[11px] font-bold uppercase tracking-wide ${style.text}`}>
              {CONTRAT_LABELS[contrat]}
            </span>
          </div>
        </td>
      </tr>
      {agents.map((agent) => {
        const agentShifts = weekISOs
          .map((iso) => shiftsByAgentDay.get(`${agent.id}__${iso}`))
          .filter((s): s is Shift => Boolean(s));
        const total = weeklyTheoreticalHours(agentShifts);
        return (
          <tr key={agent.id}>
            <td className="sticky left-0 z-10 whitespace-nowrap rounded-l-xl bg-white py-1 pl-1 pr-3 text-sm">
              <div className={`flex items-center gap-2 rounded-lg border-l-4 py-1.5 pl-2 ${style.border}`}>
                <span className="font-medium text-gray-800">{agent.prenom}</span>
                <span className="text-gray-400">{agent.nom}</span>
              </div>
            </td>
            {weekDates.map((date) => {
              const iso = toISODate(date);
              return (
                <td key={iso} className="px-1 py-1">
                  <ShiftCell
                    agent={agent}
                    jour={iso}
                    shift={shiftsByAgentDay.get(`${agent.id}__${iso}`)}
                    onClick={() => onCellClick(agent, iso, date, shiftsByAgentDay.get(`${agent.id}__${iso}`))}
                  />
                </td>
              );
            })}
            <td className="px-2 text-center text-xs font-semibold text-gray-500">{decimalToFrench(total)}</td>
          </tr>
        );
      })}
    </>
  );
}
