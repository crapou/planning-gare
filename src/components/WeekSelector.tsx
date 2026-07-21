import { formatWeekRange } from '../utils/date';

interface WeekSelectorProps {
  monday: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

/** Sélecteur de semaine : navigation semaine précédente / suivante + retour à la semaine actuelle. */
export default function WeekSelector({ monday, onPrev, onNext, onToday }: WeekSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-card">
      <button
        onClick={onPrev}
        className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100"
        aria-label="Semaine précédente"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        onClick={onToday}
        className="whitespace-nowrap px-3 text-sm font-medium text-gray-700 transition hover:text-gray-900"
      >
        {formatWeekRange(monday)}
      </button>
      <button
        onClick={onNext}
        className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100"
        aria-label="Semaine suivante"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
