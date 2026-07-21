import { useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Agent, Shift } from './types';
import { usePlanningData } from './utils/storage';
import { addWeeks, getMonday, getWeekDates, toISODate } from './utils/date';
import { formatShiftCell } from './utils/time';
import { CONTRAT_STYLES } from './utils/colors';
import { printWeek } from './utils/pdf';
import { SEED_WEEK_MONDAY } from './data/seed';

import AgentSidebar from './components/AgentSidebar';
import PlanningGrid from './components/PlanningGrid';
import DayView from './components/DayView';
import WeekSelector from './components/WeekSelector';
import ViewToggle, { type ViewMode } from './components/ViewToggle';
import ShiftEditModal, { type ShiftEditTarget } from './components/ShiftEditModal';

type DragActiveData =
  | { type: 'agent'; agentId: string }
  | { type: 'shift'; shiftId: string; agentId: string; jour: string }
  | { type: 'none' };

export default function App() {
  const { data, setData } = usePlanningData();
  const [weekMonday, setWeekMonday] = useState(() => getMonday(SEED_WEEK_MONDAY));
  const [viewMode, setViewMode] = useState<ViewMode>('agent');
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [editTarget, setEditTarget] = useState<ShiftEditTarget | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ data: DragActiveData; agent?: Agent; shift?: Shift } | null>(null);

  const weekDates = useMemo(() => getWeekDates(weekMonday), [weekMonday]);
  const weekISOs = useMemo(() => weekDates.map(toISODate), [weekDates]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // ---- Agents CRUD ----
  const addAgent = (values: Omit<Agent, 'id'>) => {
    setData((d) => ({ ...d, agents: [...d.agents, { id: uuid(), ...values }] }));
  };
  const updateAgent = (id: string, values: Omit<Agent, 'id'>) => {
    setData((d) => ({ ...d, agents: d.agents.map((a) => (a.id === id ? { id, ...values } : a)) }));
  };
  const deleteAgent = (id: string) => {
    setData((d) => ({
      agents: d.agents.filter((a) => a.id !== id),
      shifts: d.shifts.filter((s) => s.agentId !== id),
    }));
  };

  // ---- Shifts CRUD ----
  const openCellEditor = (agent: Agent, jour: string, date: Date, shift?: Shift) => {
    setEditTarget({ agent, jour, date, shift });
  };

  const saveShift = (values: { repos: boolean; heureDebut: number | null; heureFin: number | null }) => {
    if (!editTarget) return;
    setData((d) => {
      if (editTarget.shift) {
        return {
          ...d,
          shifts: d.shifts.map((s) => (s.id === editTarget.shift!.id ? { ...s, ...values } : s)),
        };
      }
      const newShift: Shift = {
        id: uuid(),
        agentId: editTarget.agent.id,
        jour: editTarget.jour,
        ...values,
      };
      return { ...d, shifts: [...d.shifts, newShift] };
    });
    setEditTarget(null);
  };

  const deleteShift = () => {
    if (!editTarget?.shift) return;
    const shiftId = editTarget.shift.id;
    setData((d) => ({ ...d, shifts: d.shifts.filter((s) => s.id !== shiftId) }));
    setEditTarget(null);
  };

  // ---- Drag & drop ----
  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current as DragActiveData | undefined;
    if (!activeData) return;
    if (activeData.type === 'agent') {
      const agent = data.agents.find((a) => a.id === activeData.agentId);
      setActiveDrag({ data: activeData, agent });
    } else if (activeData.type === 'shift') {
      const shift = data.shifts.find((s) => s.id === activeData.shiftId);
      const agent = shift ? data.agents.find((a) => a.id === shift.agentId) : undefined;
      setActiveDrag({ data: activeData, agent, shift });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const overData = over.data.current as { type: 'cell'; agentId: string; jour: string } | undefined;
    if (!overData || overData.type !== 'cell') return;
    const activeData = active.data.current as DragActiveData | undefined;
    if (!activeData) return;

    if (activeData.type === 'agent') {
      const agent = data.agents.find((a) => a.id === activeData.agentId);
      if (!agent) return;
      const dateIndex = weekISOs.indexOf(overData.jour);
      if (dateIndex === -1) return;
      const existingShift = data.shifts.find((s) => s.agentId === overData.agentId && s.jour === overData.jour);
      // Le drop crée (ou ouvre l'édition d'){un créneau pour l'agent, sur le jour ciblé.
      setEditTarget({
        agent,
        jour: overData.jour,
        date: weekDates[dateIndex],
        shift: agent.id === overData.agentId ? existingShift : undefined,
      });
    } else if (activeData.type === 'shift') {
      if (activeData.agentId === overData.agentId && activeData.jour === overData.jour) return;
      setData((d) => {
        const occupied = d.shifts.find(
          (s) => s.agentId === overData.agentId && s.jour === overData.jour && s.id !== activeData.shiftId,
        );
        if (occupied) return d; // case déjà occupée : on ignore le déplacement
        return {
          ...d,
          shifts: d.shifts.map((s) =>
            s.id === activeData.shiftId ? { ...s, agentId: overData.agentId, jour: overData.jour } : s,
          ),
        };
      });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f7]">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-black/5 bg-[#f5f5f7]/80 px-6 py-4 backdrop-blur-md">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-gray-900">Planning · Services en gare</h1>
          <p className="text-xs text-gray-400">Assistance PMR, personnes âgées &amp; portage de bagages</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <WeekSelector
            monday={weekMonday}
            onPrev={() => setWeekMonday((m) => addWeeks(m, -1))}
            onNext={() => setWeekMonday((m) => addWeeks(m, 1))}
            onToday={() => setWeekMonday(getMonday(new Date()))}
          />
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          <button
            onClick={() => printWeek(data, weekDates)}
            className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9V2h12v7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="6" y="14" width="12" height="8" rx="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Imprimer
          </button>
        </div>
      </header>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDrag(null)}>
        <main className="flex flex-1 gap-4 p-6">
          <AgentSidebar
            agents={data.agents}
            onAddAgent={addAgent}
            onUpdateAgent={updateAgent}
            onDeleteAgent={deleteAgent}
          />
          {viewMode === 'agent' ? (
            <PlanningGrid agents={data.agents} shifts={data.shifts} weekDates={weekDates} onCellClick={openCellEditor} />
          ) : (
            <DayView
              agents={data.agents}
              shifts={data.shifts}
              weekDates={weekDates}
              selectedIndex={selectedDayIndex}
              onSelectIndex={setSelectedDayIndex}
              onCellClick={openCellEditor}
            />
          )}
        </main>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
          {activeDrag?.agent && (
            <div
              className={`rounded-xl border px-3 py-2 text-sm font-medium shadow-floating ${CONTRAT_STYLES[activeDrag.agent.contrat].soft} ${CONTRAT_STYLES[activeDrag.agent.contrat].border} ${CONTRAT_STYLES[activeDrag.agent.contrat].text}`}
            >
              {activeDrag.agent.prenom} {activeDrag.agent.nom}
              {activeDrag.data.type === 'shift' && activeDrag.shift && (
                <span className="ml-1.5 opacity-70">{formatShiftCell(activeDrag.shift)}</span>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {editTarget && (
        <ShiftEditModal
          target={editTarget}
          onSave={saveShift}
          onDelete={editTarget.shift ? deleteShift : undefined}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
