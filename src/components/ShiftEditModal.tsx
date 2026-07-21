import { useState } from 'react';
import type { Agent, Shift } from '../types';
import { formatColumnHeader } from '../utils/date';
import { decimalToHHMM, hhmmToDecimal } from '../utils/time';

export interface ShiftEditTarget {
  agent: Agent;
  jour: string; // ISO date
  date: Date;
  shift?: Shift;
}

interface ShiftEditModalProps {
  target: ShiftEditTarget;
  onSave: (values: { repos: boolean; heureDebut: number | null; heureFin: number | null }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const DEFAULT_DEBUT = '09:00';
const DEFAULT_FIN = '17:00';

/** Modale d'édition d'un créneau : heures de début/fin, repos, ou suppression. */
export default function ShiftEditModal({ target, onSave, onDelete, onClose }: ShiftEditModalProps) {
  const existing = target.shift;
  const [repos, setRepos] = useState(existing?.repos ?? false);
  const overnightInitial = (existing?.heureFin ?? 0) >= 24;
  const [debut, setDebut] = useState(existing?.heureDebut != null ? decimalToHHMM(existing.heureDebut) : DEFAULT_DEBUT);
  const [fin, setFin] = useState(
    existing?.heureFin != null ? decimalToHHMM(overnightInitial ? existing.heureFin - 24 : existing.heureFin) : DEFAULT_FIN,
  );
  const [overnight, setOvernight] = useState(overnightInitial);

  const handleSave = () => {
    if (repos) {
      onSave({ repos: true, heureDebut: null, heureFin: null });
      return;
    }
    const heureDebut = hhmmToDecimal(debut);
    let heureFin = hhmmToDecimal(fin);
    if (overnight) heureFin += 24;
    onSave({ repos: false, heureDebut, heureFin });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900">
          {target.agent.prenom} {target.agent.nom}
        </h3>
        <p className="mt-0.5 text-sm text-gray-400">{formatColumnHeader(target.date)}</p>

        <label className="mt-5 flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5">
          <span className="text-sm font-medium text-gray-700">Jour de repos (D)</span>
          <input
            type="checkbox"
            checked={repos}
            onChange={(e) => setRepos(e.target.checked)}
            className="h-4 w-4 rounded accent-gray-900"
          />
        </label>

        {!repos && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Début</label>
                <input
                  type="time"
                  value={debut}
                  onChange={(e) => setDebut(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-900/5"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Fin</label>
                <input
                  type="time"
                  value={fin}
                  onChange={(e) => setFin(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-900/5"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={overnight}
                onChange={(e) => setOvernight(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-gray-900"
              />
              Se termine après minuit (le lendemain)
            </label>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <div>
            {existing && onDelete && (
              <button
                onClick={onDelete}
                className="rounded-full px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50"
              >
                Supprimer
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
