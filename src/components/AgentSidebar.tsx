import { useState } from 'react';
import type { Agent, ContratType } from '../types';
import { CONTRAT_LABELS, CONTRAT_ORDER } from '../types';
import { CONTRAT_STYLES } from '../utils/colors';
import DraggableAgentChip from './DraggableAgentChip';
import AgentForm from './AgentForm';
import ConfirmDialog from './ConfirmDialog';

interface AgentSidebarProps {
  agents: Agent[];
  onAddAgent: (agent: Omit<Agent, 'id'>) => void;
  onUpdateAgent: (id: string, agent: Omit<Agent, 'id'>) => void;
  onDeleteAgent: (id: string) => void;
}

/**
 * Barre latérale : liste des agents groupés par type de contrat, glissables
 * vers la grille de planning, avec gestion CRUD (ajout / modification / suppression).
 */
export default function AgentSidebar({ agents, onAddAgent, onUpdateAgent, onDeleteAgent }: AgentSidebarProps) {
  const [formState, setFormState] = useState<{ mode: 'add' } | { mode: 'edit'; agent: Agent } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);

  const grouped = CONTRAT_ORDER.map((contrat) => ({
    contrat,
    agents: agents.filter((a) => a.contrat === contrat),
  }));

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col rounded-2xl bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Agents</h2>
        <button
          onClick={() => setFormState({ mode: 'add' })}
          className="flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-gray-800"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Ajouter
        </button>
      </div>

      <p className="mb-3 text-xs leading-relaxed text-gray-400">
        Glissez un agent sur une case du planning pour créer un créneau.
      </p>

      <div className="flex-1 space-y-5 overflow-y-auto scrollbar-thin pr-1">
        {grouped.map(
          ({ contrat, agents: groupAgents }) =>
            groupAgents.length > 0 && (
              <div key={contrat}>
                <div className="mb-2 flex items-center gap-1.5 px-0.5">
                  <span className={`h-2 w-2 rounded-full ${CONTRAT_STYLES[contrat as ContratType].band}`} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {CONTRAT_LABELS[contrat as ContratType]}
                  </span>
                  <span className="text-[11px] text-gray-300">· {groupAgents.length}</span>
                </div>
                <div className="space-y-1.5">
                  {groupAgents.map((agent) => (
                    <DraggableAgentChip
                      key={agent.id}
                      agent={agent}
                      onEdit={() => setFormState({ mode: 'edit', agent })}
                      onDelete={() => setDeleteTarget(agent)}
                    />
                  ))}
                </div>
              </div>
            ),
        )}
        {agents.length === 0 && (
          <p className="mt-6 text-center text-xs text-gray-400">Aucun agent pour le moment.</p>
        )}
      </div>

      {formState && (
        <AgentForm
          initial={formState.mode === 'edit' ? formState.agent : undefined}
          onClose={() => setFormState(null)}
          onSave={(values) => {
            if (formState.mode === 'edit') {
              onUpdateAgent(formState.agent.id, values);
            } else {
              onAddAgent(values);
            }
            setFormState(null);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Supprimer cet agent ?"
          message={`${deleteTarget.prenom} ${deleteTarget.nom} sera retiré ainsi que tous ses créneaux planifiés. Cette action est irréversible.`}
          confirmLabel="Supprimer"
          onConfirm={() => {
            onDeleteAgent(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </aside>
  );
}
