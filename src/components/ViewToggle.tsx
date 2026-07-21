export type ViewMode = 'agent' | 'jour';

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

/** Contrôle segmenté pour basculer entre la vue « par agent » et la vue « par jour ». */
export default function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-gray-100 p-1">
      {(
        [
          ['agent', 'Vue par agent'],
          ['jour', 'Vue par jour'],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            mode === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
