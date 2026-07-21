import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Agent, ContratType, PlanningData, Shift } from '../types';
import { CONTRAT_ORDER } from '../types';
import { formatColumnHeader, formatDisplayDate, JOURS_LABELS, toISODate } from './date';
import { decimalToFrench, decimalToHHMM, formatShiftCell, weeklyTheoreticalHours } from './time';
import { CONTRAT_STYLES } from './colors';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function groupAgentsByContrat(agents: Agent[]): Agent[] {
  const sorted: Agent[] = [];
  for (const contrat of CONTRAT_ORDER) {
    sorted.push(...agents.filter((a) => a.contrat === contrat));
  }
  return sorted;
}

function fullName(agent: Agent): string {
  return [agent.prenom, agent.nom].filter(Boolean).join(' ');
}

/**
 * PDF 1 — Planning général hebdomadaire, format paysage A4.
 * Reproduit la fiche existante : colonne NOMS, 7 colonnes jours, colonne H. THEORIQUE,
 * agents groupés par type de contrat avec bandeau latéral coloré.
 */
export function generatePlanningPDF(data: PlanningData, weekDates: Date[]): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const orderedAgents = groupAgentsByContrat(data.agents);
  const weekISOs = weekDates.map(toISODate);

  const shiftsByAgentDay = new Map<string, Shift>();
  for (const s of data.shifts) {
    shiftsByAgentDay.set(`${s.agentId}__${s.jour}`, s);
  }

  const head = [
    ['NOMS', ...weekDates.map((d) => formatColumnHeader(d)), 'H. THEORIQUE'],
  ];

  const body = orderedAgents.map((agent) => {
    const agentShifts = data.shifts.filter((s) => s.agentId === agent.id && weekISOs.includes(s.jour));
    const total = weeklyTheoreticalHours(agentShifts);
    const dayCells = weekISOs.map((iso) => formatShiftCell(shiftsByAgentDay.get(`${agent.id}__${iso}`)));
    return [fullName(agent), ...dayCells, decimalToFrench(total)];
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Planning hebdomadaire — Services en gare', 14, 10);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const rangeLabel = `${formatDisplayDate(weekDates[0])} — ${formatDisplayDate(weekDates[6])}`;
  doc.text(rangeLabel, 14, 14.5);

  autoTable(doc, {
    head,
    body,
    startY: 18,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.6,
      cellPadding: 1.3,
      valign: 'middle',
      halign: 'center',
      lineColor: [220, 220, 224],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
      cellPadding: 1.5,
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 34 },
      8: { fontStyle: 'bold', cellWidth: 20 },
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;
      const rowIndex = hookData.row.index;
      const agent = orderedAgents[rowIndex];
      if (!agent) return;
      const style = CONTRAT_STYLES[agent.contrat];
      if (hookData.column.index === 0) {
        hookData.cell.styles.fillColor = hexToRgb(style.hexSoft);
        hookData.cell.styles.textColor = hexToRgb(style.hex);
      }
      const text = Array.isArray(hookData.cell.raw) ? hookData.cell.raw.join('') : String(hookData.cell.raw ?? '');
      if (text === 'D') {
        hookData.cell.styles.textColor = [156, 163, 175];
        hookData.cell.styles.fontStyle = 'italic';
      }
    },
    didDrawCell: (hookData) => {
      if (hookData.section !== 'body' || hookData.column.index !== 0) return;
      const agent = orderedAgents[hookData.row.index];
      if (!agent) return;
      const [r, g, b] = hexToRgb(CONTRAT_STYLES[agent.contrat].hex);
      doc.setFillColor(r, g, b);
      doc.rect(hookData.cell.x, hookData.cell.y, 1.4, hookData.cell.height, 'F');
    },
    margin: { left: 14, right: 14 },
  });

  // Légende des types de contrat
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  let legendX = 14;
  doc.setFontSize(8);
  for (const contrat of CONTRAT_ORDER as ContratType[]) {
    const [r, g, b] = hexToRgb(CONTRAT_STYLES[contrat].hex);
    doc.setFillColor(r, g, b);
    doc.rect(legendX, finalY - 3, 3, 3, 'F');
    doc.setTextColor(60, 60, 60);
    doc.text(contrat, legendX + 5, finalY);
    legendX += 22;
  }

  return doc;
}

/**
 * PDF 2 — Feuilles d'émargement, une page portrait par jour.
 * Une ligne par agent travaillant ce jour-là, avec colonnes vides à remplir à la main.
 */
export function generateEmargementPDF(data: PlanningData, weekDates: Date[]): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const agentsById = new Map(data.agents.map((a) => [a.id, a]));

  weekDates.forEach((date, dayIndex) => {
    if (dayIndex > 0) doc.addPage();
    const iso = toISODate(date);
    const dayShifts = data.shifts
      .filter((s) => s.jour === iso && !s.repos && s.heureDebut != null && s.heureFin != null)
      .map((s) => ({ shift: s, agent: agentsById.get(s.agentId) }))
      .filter((x): x is { shift: Shift; agent: Agent } => Boolean(x.agent))
      .sort((a, b) => (a.shift.heureDebut ?? 0) - (b.shift.heureDebut ?? 0));

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(`Feuille d'émargement — ${JOURS_LABELS[dayIndex]} ${formatDisplayDate(date)}`, 14, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text('Services en gare — Assistance PMR / bagages', 14, 22);
    doc.setTextColor(0, 0, 0);

    const head = [
      ['Nom / Prénom', 'Début prévu', 'Arrivée réelle', 'Fin prévue', 'Sortie réelle', 'Heures sup.', 'Signature'],
    ];
    const body = dayShifts.map(({ shift, agent }) => [
      fullName(agent),
      decimalToHHMM(shift.heureDebut as number),
      '',
      decimalToHHMM(shift.heureFin as number),
      '',
      '',
      '',
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 28,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 10,
        cellPadding: 3,
        valign: 'middle',
        minCellHeight: 12,
        lineColor: [210, 210, 214],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [31, 41, 55],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 44 },
        6: { cellWidth: 38 },
      },
    });

    if (dayShifts.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(140, 140, 140);
      doc.text('Aucun agent planifié ce jour.', 14, 34);
      doc.setTextColor(0, 0, 0);
    }
  });

  return doc;
}

function fileDateSuffix(weekDates: Date[]): string {
  return `${toISODate(weekDates[0])}_${toISODate(weekDates[6])}`;
}

/** Génère et déclenche le téléchargement des deux PDF (planning + émargement). */
export function printWeek(data: PlanningData, weekDates: Date[]): void {
  const suffix = fileDateSuffix(weekDates);
  generatePlanningPDF(data, weekDates).save(`planning_${suffix}.pdf`);
  generateEmargementPDF(data, weekDates).save(`emargement_${suffix}.pdf`);
}
