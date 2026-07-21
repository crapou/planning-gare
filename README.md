# Planning Gare — Assistance PMR

Application web (single-page) pour créer et imprimer le planning hebdomadaire d'une équipe d'agents d'assistance en gare (personnes à mobilité réduite, personnes âgées, portage de bagages). Fonctionne entièrement en local, sans backend : les données sont stockées dans le `localStorage` du navigateur.

## Démarrage

```bash
npm install
npm run dev
```

Puis ouvrir l'URL affichée dans le terminal (par défaut [http://localhost:5173](http://localhost:5173)).

Autres commandes utiles :

```bash
npm run build     # build de production dans dist/
npm run preview   # sert le build de production en local
npm run lint      # vérifie le code avec ESLint
```

## Fonctionnalités

- **Gestion des agents** : ajout, modification, suppression (avec confirmation), regroupés par type de contrat (`RDE`, `GDT`, `ADS`, `CDD`), chacun avec sa couleur dédiée.
- **Planning hebdomadaire par glisser-déposer** :
  - glisser un agent depuis la barre latérale sur une case jour pour créer un créneau ;
  - glisser un créneau existant vers un autre jour (ou un autre agent) pour le déplacer ;
  - cliquer sur une case pour saisir précisément les heures de début/fin, marquer un jour de repos (« D ») ou supprimer le créneau.
- **Deux vues** : *par agent* (grille complète de la semaine) et *par jour* (liste des agents en service ce jour-là, avec les agents en repos/non planifiés en dessous).
- **Navigation par semaine** : semaine précédente / suivante, retour à la semaine en cours.
- **Export PDF** (bouton « Imprimer », génère 2 fichiers) :
  1. **Planning général** — format paysage A4, identique à la fiche existante (colonne NOMS, 7 colonnes jours avec date complète, bandeau latéral coloré par type de contrat, colonne « H. THÉORIQUE » avec le total hebdomadaire en décimal).
  2. **Feuilles d'émargement** — une page par jour, une ligne par agent en service, avec les heures théoriques pré-remplies et les colonnes heure d'arrivée réelle / heure de sortie réelle / heures supplémentaires / signature laissées vides pour être complétées à la main.

  Les horaires affichés dans l'interface, dans le PDF planning et dans le PDF émargement proviennent tous de la même source de données (`localStorage`) : ils sont donc toujours cohérents entre eux.

## Modèle de données

- **Agent** : `id`, `nom`, `prénom`, `contrat` (`RDE` bleu / `GDT` orange / `ADS` gris / `CDD` vert).
- **Shift** (créneau) : `id`, `agentId`, `jour` (date ISO), `repos` (booléen), `heureDebut` / `heureFin` en décimal (ex : `14.25` = 14h15), comme sur la fiche papier source. Une heure de fin ≥ 24 indique un service qui se termine après minuit (ex : `25.00` = 1h00 le lendemain). Une case vide dans l'interface signifie qu'aucun shift n'existe pour ce jour ; il n'y a donc rien à saisir tant qu'on ne glisse pas un agent dessus ou qu'on ne clique pas dessus.

## Données de départ

L'application est pré-remplie avec le planning de la semaine du **lundi 27 juillet au dimanche 2 août 2026**, lu depuis la fiche papier existante (voir [src/data/seed.ts](src/data/seed.ts)). Ces valeurs sont approximatives et volontairement faciles à corriger, soit directement dans le fichier source, soit depuis l'interface (l'app charge les données de `localStorage` en priorité ; pour revenir au jeu de données de départ, vider le `localStorage` du site ou les données du site dans les outils développeur du navigateur).

## Stack technique

- [React](https://react.dev/) + [Vite](https://vitejs.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) pour le style (palette neutre, coins arrondis, ombres douces)
- [`@dnd-kit/core`](https://dndkit.com/) pour le glisser-déposer
- [`jspdf`](https://github.com/parallax/jsPDF) + [`jspdf-autotable`](https://github.com/simonbengtsson/jsPDF-AutoTable) pour la génération des PDF
- Persistance via `localStorage` (aucune base de données, aucun backend)

## Structure du projet

```
src/
  types.ts              modèle de données (Agent, Shift, ContratType)
  data/seed.ts           jeu de données de départ (semaine du 27/07/2026)
  utils/
    time.ts               conversions heures décimales <-> HH:MM
    date.ts               calculs de semaine, formatage des dates
    colors.ts              styles Tailwind par type de contrat
    storage.ts             hook de persistance localStorage
    pdf.ts                  génération des 2 PDF
    combineRefs.ts          utilitaire pour dnd-kit (ref draggable + droppable)
  components/
    AgentSidebar.tsx        barre latérale des agents (glissables + CRUD)
    DraggableAgentChip.tsx  puce d'agent glissable
    AgentForm.tsx            formulaire d'ajout/modification d'agent
    PlanningGrid.tsx        vue « par agent » (grille de la semaine)
    ShiftCell.tsx             case de la grille (drop + drag + clic pour éditer)
    ShiftEditModal.tsx      modale d'édition d'un créneau (heures / repos)
    DayView.tsx               vue « par jour »
    WeekSelector.tsx        navigation de semaine
    ViewToggle.tsx            bascule entre les deux vues
    ConfirmDialog.tsx        confirmation générique (ex : suppression d'agent)
  App.tsx                  assemblage de l'application, DndContext, état global
```
