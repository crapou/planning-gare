import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Agent, Shift } from '../types';
import { CONTRAT_STYLES } from '../utils/colors';
import { combineRefs } from '../utils/combineRefs';
import { formatShiftCell } from '../utils/time';

interface ShiftCellProps {
  agent: Agent;
  jour: string;
  shift?: Shift;
  onClick: () => void;
}

/** Case de la grille de planning : zone de dépôt (drop) + créneau glissable si présent. */
export default function ShiftCell({ agent, jour, shift, onClick }: ShiftCellProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `cell:${agent.id}:${jour}`,
    data: { type: 'cell', agentId: agent.id, jour },
  });

  const { setNodeRef: setDragRef, listeners, attributes, isDragging } = useDraggable({
    id: shift ? `shift:${shift.id}` : `empty:${agent.id}:${jour}`,
    data: shift ? { type: 'shift', shiftId: shift.id, agentId: agent.id, jour } : { type: 'none' },
    disabled: !shift,
  });

  const style = CONTRAT_STYLES[agent.contrat];
  const label = formatShiftCell(shift);
  const isRepos = shift?.repos;

  return (
    <div
      ref={combineRefs(setDropRef, setDragRef)}
      onClick={onClick}
      {...(shift ? { ...listeners, ...attributes } : {})}
      className={`group flex h-14 min-w-[104px] items-center justify-center rounded-xl border text-xs font-medium transition-all ${
        isOver
          ? `${style.soft} border-gray-400 ring-2 ring-gray-900/10`
          : shift
            ? `${style.soft} ${style.border}`
            : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
      } ${shift ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isDragging ? 'opacity-30' : ''}`}
      title={shift ? 'Cliquer pour modifier · glisser pour déplacer' : 'Cliquer pour ajouter un créneau'}
    >
      {isRepos ? (
        <span className="text-sm font-semibold text-gray-400">D</span>
      ) : label ? (
        <span className={style.text}>{label}</span>
      ) : (
        <span className="text-gray-300 opacity-0 transition-opacity group-hover:opacity-100">+</span>
      )}
    </div>
  );
}
