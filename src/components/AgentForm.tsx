import { useState, type FormEvent } from 'react';
import type { Agent, ContratType } from '../types';
import { CONTRAT_LABELS, CONTRAT_ORDER } from '../types';

interface AgentFormProps {
  initial?: Agent;
  onSave: (agent: Omit<Agent, 'id'>) => void;
  onClose: () => void;
}

/** Modale d'ajout / modification d'un agent (nom, prénom, type de contrat). */
export default function AgentForm({ initial, onSave, onClose }: AgentFormProps) {
  const [prenom, setPrenom] = useState(initial?.prenom ?? '');
  const [nom, setNom] = useState(initial?.nom ?? '');
  const [contrat, setContrat] = useState<ContratType>(initial?.contrat ?? 'RDE');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!prenom.trim()) return;
    onSave({ prenom: prenom.trim(), nom: nom.trim(), contrat });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-floating"
      >
        <h3 className="text-base font-semibold text-gray-900">
          {initial ? "Modifier l'agent" : 'Ajouter un agent'}
        </h3>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Prénom</label>
            <input
              autoFocus
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              placeholder="Prénom"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-900/5"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Nom</label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom (ou initiale)"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-900/5"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Type de contrat</label>
            <div className="grid grid-cols-4 gap-2">
              {CONTRAT_ORDER.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setContrat(c)}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                    contrat === c
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {CONTRAT_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-40"
            disabled={!prenom.trim()}
          >
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
