export const JOURS_LABELS = [
  'LUNDI',
  'MARDI',
  'MERCREDI',
  'JEUDI',
  'VENDREDI',
  'SAMEDI',
  'DIMANCHE',
] as const;

export const JOURS_LABELS_COURT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

/** Retourne le lundi de la semaine contenant `date`. */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dimanche, 1 = lundi, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Retourne les 7 dates (lundi -> dimanche) de la semaine à partir d'un lundi. */
export function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Décale une date de N semaines. */
export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

/** Format ISO YYYY-MM-DD, en heure locale (pas d'UTC shift). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Format d'affichage court JJ/MM/AAAA. */
export function formatDisplayDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/** Libellé complet pour une colonne du planning: "LUNDI 27/07/2026". */
export function formatColumnHeader(date: Date): string {
  const jourIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
  return `${JOURS_LABELS[jourIndex]} ${formatDisplayDate(date)}`;
}

/** Libellé "Semaine du 27/07/2026 au 02/08/2026". */
export function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return `Semaine du ${formatDisplayDate(monday)} au ${formatDisplayDate(sunday)}`;
}
