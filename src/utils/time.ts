import type { Shift } from '../types';

/**
 * Convertit une heure décimale (14.25 = 14h15) en chaîne "HH:MM".
 * Les valeurs >= 24 sont conservées telles quelles (ex: 25.5 -> "25:30")
 * pour représenter un horaire qui se termine après minuit, comme sur la fiche source.
 */
export function decimalToHHMM(decimal: number): string {
  const totalMinutes = Math.round(decimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Convertit "HH:MM" en décimal (14:15 -> 14.25). */
export function hhmmToDecimal(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
}

/** Formate une heure décimale au format français avec virgule (14.25 -> "14,25"). */
export function decimalToFrench(decimal: number): string {
  return decimal.toFixed(2).replace('.', ',');
}

/** Texte affiché dans une cellule du planning pour un shift donné. */
export function formatShiftCell(shift: Shift | undefined): string {
  if (!shift) return '';
  if (shift.repos) return 'D';
  if (shift.heureDebut == null || shift.heureFin == null) return '';
  return `${decimalToHHMM(shift.heureDebut)}–${decimalToHHMM(shift.heureFin)}`;
}

/** Nombre d'heures travaillées pour un shift (0 si repos ou incomplet). */
export function shiftDurationHours(shift: Shift | undefined): number {
  if (!shift || shift.repos) return 0;
  if (shift.heureDebut == null || shift.heureFin == null) return 0;
  const duration = shift.heureFin - shift.heureDebut;
  return duration > 0 ? duration : 0;
}

/** Total hebdomadaire théorique (en décimal) pour une liste de shifts. */
export function weeklyTheoreticalHours(shifts: Shift[]): number {
  return shifts.reduce((total, s) => total + shiftDurationHours(s), 0);
}
