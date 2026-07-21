import type { Agent, ContratType, PlanningData, Shift } from '../types';
import { getMonday, getWeekDates, toISODate } from '../utils/date';
import { hhmmToDecimal } from '../utils/time';

/**
 * Jeu de données de départ, repris de la fiche papier existante pour la
 * semaine du lundi 27/07/2026 au dimanche 02/08/2026.
 *
 * Chaque agent a un tableau de 7 codes horaires (Lundi -> Dimanche) :
 *  - `null`   -> cellule vide, l'agent ne travaille pas ce jour-là
 *  - `'D'`    -> jour de repos
 *  - `'HH:MM-HH:MM'` -> horaire de travail (l'heure de fin peut dépasser 24
 *                        pour un service qui se termine après minuit, ex: 25:00 = 1h00)
 *
 * Ces valeurs sont approximatives (lues sur une photo) et volontairement
 * faciles à modifier ci-dessous ou directement depuis l'interface.
 */
type HoraireCode = string | 'D' | null;

interface SeedAgent {
  prenom: string;
  nom: string;
  contrat: ContratType;
  horaires: [HoraireCode, HoraireCode, HoraireCode, HoraireCode, HoraireCode, HoraireCode, HoraireCode];
}

const SEED_AGENTS: SeedAgent[] = [
  // RDE — bleu
  { prenom: 'Jonathan', nom: 'I.', contrat: 'RDE', horaires: ['14:15-23:45', '14:15-23:45', '14:15-23:45', null, null, null, '05:30-14:30'] },
  { prenom: 'Hsissen', nom: 'S.', contrat: 'RDE', horaires: [null, null, null, 'D', 'D', 'D', 'D'] },
  { prenom: 'Boumedyen', nom: '', contrat: 'RDE', horaires: [null, null, null, '14:15-23:45', '15:00-25:00', '14:30-24:15', '14:45-23:45'] },
  { prenom: 'Mahir', nom: 'T.', contrat: 'RDE', horaires: ['05:00-14:15', '05:00-14:15', '05:00-14:15', '05:00-14:15', null, null, null] },

  // GDT — orange
  { prenom: 'Samia', nom: 'A.', contrat: 'GDT', horaires: [null, null, null, '06:00-15:00', '05:00-14:30', '05:30-14:30', '07:00-15:00'] },
  { prenom: 'Raphael', nom: 'W.', contrat: 'GDT', horaires: ['D', 'D', 'D', 'D', null, null, 'D'] },
  { prenom: 'Elias', nom: 'G.', contrat: 'GDT', horaires: [null, null, null, '15:45-23:45', '14:00-23:00', '14:45-23:45', '12:00-21:00'] },
  { prenom: 'Jennifer', nom: 'C.', contrat: 'GDT', horaires: ['D', 'D', 'D', null, null, null, 'D'] },

  // ADS — gris
  { prenom: 'Samir', nom: 'A.', contrat: 'ADS', horaires: ['06:30-15:30', '06:30-15:30', '06:30-14:30', null, null, null, '06:30-15:30'] },
  { prenom: 'Houssam', nom: 'C.', contrat: 'ADS', horaires: ['10:00-19:00', '10:00-19:00', '10:00-19:00', '10:00-18:00', null, null, null] },
  { prenom: 'Tarek', nom: 'C.', contrat: 'ADS', horaires: [null, null, null, '13:00-22:00', '13:00-22:00', '13:00-22:00', 'D'] },
  { prenom: 'Halima', nom: 'H.', contrat: 'ADS', horaires: ['07:00-16:00', null, null, null, '07:00-16:00', '08:00-16:00', '10:00-19:00'] },
  { prenom: 'Sarah', nom: 'O.', contrat: 'ADS', horaires: [null, null, '10:00-18:00', null, '06:00-15:00', '06:00-15:00', '12:00-20:00'] },
  { prenom: 'Mohammed', nom: 'B.', contrat: 'ADS', horaires: ['14:45-23:45', '14:45-23:45', null, null, '11:00-19:00', '08:45-15:30', '14:00-22:00'] },
  { prenom: 'Sebastien', nom: 'S.', contrat: 'ADS', horaires: [null, null, null, '10:00-19:00', '10:00-19:00', '10:00-19:00', '08:00-16:00'] },
  { prenom: 'Nourra', nom: 'M.', contrat: 'ADS', horaires: ['08:00-17:00', '08:00-17:00', null, null, 'D', 'D', null] },
  { prenom: 'Ismail', nom: 'Z.', contrat: 'ADS', horaires: [null, '13:00-22:00', '14:00-23:00', '11:00-20:00', '13:00-21:00', null, null] },

  // CDD — vert
  { prenom: 'Yasmina', nom: '', contrat: 'CDD', horaires: ['09:45-18:45', '09:45-18:45', '09:45-18:45', '09:45-17:45', null, null, null] },
  { prenom: 'Emma', nom: '', contrat: 'CDD', horaires: [null, null, '11:00-20:00', '10:00-19:00', '10:00-19:00', null, null] },
  { prenom: 'Ilian', nom: '', contrat: 'CDD', horaires: ['09:45-18:45', '09:45-18:45', '09:45-18:45', '09:45-17:45', null, null, null] },
  { prenom: 'Redouane', nom: '', contrat: 'CDD', horaires: ['13:00-22:00', null, null, '11:00-20:00', '11:00-20:00', '11:00-19:00', null] },
  { prenom: 'Sirine', nom: '', contrat: 'CDD', horaires: ['10:00-19:00', '10:00-19:00', null, '10:00-19:00', '08:00-17:00', '10:00-18:00', null] },
  { prenom: 'Matt', nom: '', contrat: 'CDD', horaires: ['10:00-19:00', '11:00-20:00', null, null, '10:00-19:00', '10:00-19:00', null] },
  { prenom: 'Rayan', nom: '', contrat: 'CDD', horaires: [null, null, '10:00-19:00', '10:00-19:00', '10:00-19:00', '10:00-19:00', null] },
];

/** Lundi de la semaine de départ pré-remplie. */
export const SEED_WEEK_MONDAY = new Date(2026, 6, 27); // 27 juillet 2026 (mois 0-indexé)

function parseHoraireCode(code: HoraireCode): Pick<Shift, 'repos' | 'heureDebut' | 'heureFin'> | null {
  if (code == null) return null;
  if (code === 'D') return { repos: true, heureDebut: null, heureFin: null };
  const [debut, fin] = code.split('-');
  return { repos: false, heureDebut: hhmmToDecimal(debut), heureFin: hhmmToDecimal(fin) };
}

let seedIdCounter = 0;
function nextSeedId(prefix: string): string {
  seedIdCounter += 1;
  return `${prefix}-seed-${seedIdCounter}`;
}

/** Construit un jeu de données initial complet (agents + shifts pré-remplis). */
export function seedPlanningData(): PlanningData {
  seedIdCounter = 0;
  const monday = getMonday(SEED_WEEK_MONDAY);
  const weekDates = getWeekDates(monday);
  const weekISOs = weekDates.map(toISODate);

  const agents: Agent[] = [];
  const shifts: Shift[] = [];

  for (const seedAgent of SEED_AGENTS) {
    const agent: Agent = {
      id: nextSeedId('agent'),
      nom: seedAgent.nom,
      prenom: seedAgent.prenom,
      contrat: seedAgent.contrat,
    };
    agents.push(agent);

    seedAgent.horaires.forEach((code, dayIndex) => {
      const parsed = parseHoraireCode(code);
      if (!parsed) return;
      shifts.push({
        id: nextSeedId('shift'),
        agentId: agent.id,
        jour: weekISOs[dayIndex],
        ...parsed,
      });
    });
  }

  return { agents, shifts };
}
