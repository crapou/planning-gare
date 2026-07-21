import { useDraggable } from '@dnd-kit/core';
import type { Agent } from '../types';
import { CONTRAT_STYLES } from '../utils/colors';

interface DraggableAgentChipProps {
  agent: Agent;
  onEdit: () => void;
  onDelete: () => void;
}

/** Puce d'agent, glissable depuis la barre latérale vers une case du planning. */
export default function DraggableAgentChip({ agent, onEdit, onDelete }: DraggableAgentChipProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `agent:${agent.id}`,
    data: { type: 'agent', agentId: agent.id },
  });
  const style = CONTRAT_STYLES[agent.contrat];

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className={`group flex cursor-grab items-center justify-between rounded-xl border px-3 py-2 text-sm transition active:cursor-grabbing ${style.border} ${style.soft} ${
        isDragging ? 'opacity-40 shadow-none' : 'shadow-sm hover:shadow-card'
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${style.band}`} />
        <span className="truncate font-medium text-gray-800">
          {agent.prenom} <span className="text-gray-400">{agent.nom}</span>
        </span>
      </div>
      <div className="ml-1 hidden shrink-0 gap-0.5 group-hover:flex">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onEdit}
          className="rounded-md p-1 text-gray-400 hover:bg-white hover:text-gray-700"
          title="Modifier"
          aria-label="Modifier l'agent"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" strokeLinecap="round" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDelete}
          className="rounded-md p-1 text-gray-400 hover:bg-white hover:text-red-500"
          title="Supprimer"
          aria-label="Supprimer l'agent"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18" strokeLinecap="round" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
