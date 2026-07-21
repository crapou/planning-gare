import { useCallback, useEffect, useState } from 'react';
import type { PlanningData } from '../types';
import { seedPlanningData } from '../data/seed';

const STORAGE_KEY = 'planning-gare-data-v1';

function loadFromStorage(): PlanningData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedPlanningData();
    const parsed = JSON.parse(raw) as PlanningData;
    if (!parsed.agents || !parsed.shifts) return seedPlanningData();
    return parsed;
  } catch {
    return seedPlanningData();
  }
}

function saveToStorage(data: PlanningData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Impossible de sauvegarder le planning dans localStorage', err);
  }
}

/**
 * Hook central de persistance : charge les données depuis localStorage au
 * démarrage (ou les initialise avec le jeu de données de départ), et les
 * sauvegarde automatiquement à chaque modification.
 */
export function usePlanningData() {
  const [data, setData] = useState<PlanningData>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(data);
  }, [data]);

  const resetToSeed = useCallback(() => {
    setData(seedPlanningData());
  }, []);

  return { data, setData, resetToSeed };
}
