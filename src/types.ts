/** Types de contrat possibles pour un agent d'assistance en gare. */
export type ContratType = 'RDE' | 'GDT' | 'ADS' | 'CDD';

/** Ordre d'affichage des groupes de contrat dans la grille de planning. */
export const CONTRAT_ORDER: ContratType[] = ['RDE', 'GDT', 'ADS', 'CDD'];

export const CONTRAT_LABELS: Record<ContratType, string> = {
  RDE: 'RDE',
  GDT: 'GDT',
  ADS: 'ADS',
  CDD: 'CDD',
};

export interface Agent {
  id: string;
  nom: string;
  prenom: string;
  contrat: ContratType;
}

/**
 * Un créneau de travail (ou de repos) pour un agent, un jour donné.
 * Les heures sont stockées en décimal (14.25 = 14h15) pour coller au format
 * de la fiche source. `heureFin` peut dépasser 24 pour représenter un
 * horaire qui se termine après minuit (ex: 15h00 -> 25h00 = 1h00 le lendemain).
 */
export interface Shift {
  id: string;
  agentId: string;
  /** Date ISO (YYYY-MM-DD) du jour concerné. */
  jour: string;
  /** true si ce jour est un jour de repos ("D"). Dans ce cas heureDebut/heureFin sont ignorées. */
  repos: boolean;
  heureDebut: number | null;
  heureFin: number | null;
}

export interface PlanningData {
  agents: Agent[];
  shifts: Shift[];
}
