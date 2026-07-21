interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Boîte de dialogue de confirmation générique, style Apple sobre. */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmer',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-floating animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-full px-4 py-2 text-sm font-medium text-white shadow-sm transition ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-900 hover:bg-gray-800'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
