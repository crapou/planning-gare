import type { ContratType } from '../types';

interface ContratStyle {
  /** Bande latérale / accent fort. */
  band: string;
  /** Fond doux pour les cellules / badges. */
  soft: string;
  /** Texte accentué. */
  text: string;
  /** Bordure douce. */
  border: string;
  /** Couleur hex brute (utilisée pour le PDF). */
  hex: string;
  hexSoft: string;
}

export const CONTRAT_STYLES: Record<ContratType, ContratStyle> = {
  RDE: {
    band: 'bg-rde',
    soft: 'bg-rde-soft',
    text: 'text-rde-text',
    border: 'border-blue-200',
    hex: '#3b82f6',
    hexSoft: '#eff6ff',
  },
  GDT: {
    band: 'bg-gdt',
    soft: 'bg-gdt-soft',
    text: 'text-gdt-text',
    border: 'border-orange-200',
    hex: '#f97316',
    hexSoft: '#fff7ed',
  },
  ADS: {
    band: 'bg-ads',
    soft: 'bg-ads-soft',
    text: 'text-ads-text',
    border: 'border-gray-300',
    hex: '#9ca3af',
    hexSoft: '#f9fafb',
  },
  CDD: {
    band: 'bg-cdd',
    soft: 'bg-cdd-soft',
    text: 'text-cdd-text',
    border: 'border-green-200',
    hex: '#22c55e',
    hexSoft: '#f0fdf4',
  },
};
