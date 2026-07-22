import { useEffect, useRef, useState } from 'react';
import type { PlanningData } from '../types';
import { downloadEmargementPDF, downloadPlanningPDF, printWeek } from '../utils/pdf';

interface PrintMenuProps {
  data: PlanningData;
  weekDates: Date[];
}

const PrintIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 9V2h12v7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="6" y="14" width="12" height="8" rx="1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Bouton "Imprimer" avec panneau déroulant pour choisir quel(s) PDF télécharger. */
export default function PrintMenu({ data, weekDates }: PrintMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const run = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800"
      >
        <PrintIcon />
        Imprimer
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-black/5 bg-white p-1.5 shadow-floating">
          <button
            onClick={() => run(() => downloadPlanningPDF(data, weekDates))}
            className="flex w-full flex-col items-start rounded-xl px-3 py-2.5 text-left transition hover:bg-gray-50"
          >
            <span className="text-sm font-medium text-gray-900">Planning de la semaine</span>
            <span className="text-xs text-gray-400">PDF paysage, tous les agents</span>
          </button>
          <button
            onClick={() => run(() => downloadEmargementPDF(data, weekDates))}
            className="flex w-full flex-col items-start rounded-xl px-3 py-2.5 text-left transition hover:bg-gray-50"
          >
            <span className="text-sm font-medium text-gray-900">Feuilles d'émargement</span>
            <span className="text-xs text-gray-400">PDF portrait, une page par jour</span>
          </button>
          <div className="my-1 h-px bg-gray-100" />
          <button
            onClick={() => run(() => printWeek(data, weekDates))}
            className="flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Télécharger les deux
          </button>
        </div>
      )}
    </div>
  );
}
