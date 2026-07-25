import { jsPDF } from 'jspdf';
// @ts-ignore
import { autoTable } from 'jspdf-autotable';
import type { Medication } from '@/types/medication';
import { EMERGENCY_ITEMS, isLowStock } from '@/types/medication';
import { saveAndShareFile, savePDFFile, downloadFile } from './fileSystem';
import { getMedications } from './medicationService';
import { encodeHomeMedFile } from './homemedFormat';

export type ExportFormat = 'pdf' | 'txt' | 'json' | 'homemed';

export interface ExportOptions {
  includeNotes?: boolean;
  includeEmergencySection?: boolean;
}

function getDaysUntilExpiration(expirationDate: string): number {
  const exp = new Date(expirationDate);
  const now = new Date();
  const diff = exp.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getExpirationStatus(expirationDate: string): 'expired' | 'expiring-soon' | 'valid' {
  const days = getDaysUntilExpiration(expirationDate);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring-soon';
  return 'valid';
}

function getEmergencyReadiness(medications: Medication[]): { score: number; missing: string[]; status: string } {
  const medNames = medications.map((m) => m.name.toLowerCase());
  const medIngredients = medications.map((m) => m.activeIngredient.toLowerCase());
  
  let found = 0;
  const missing: string[] = [];
  
  for (const item of EMERGENCY_ITEMS) {
    const itemLower = item.toLowerCase();
    const hasItem = medNames.some((name) => name.includes(itemLower)) ||
      medIngredients.some((ing) => ing.includes(itemLower));
    
    if (hasItem) {
      found++;
    } else {
      missing.push(item);
    }
  }
  
  const score = Math.round((found / EMERGENCY_ITEMS.length) * 100);
  let status = 'weak';
  if (score >= 80) status = 'excellent';
  else if (score >= 50) status = 'moderate';
  
  return { score, missing, status };
}

// ==================== PDF Export ====================

// Brand palette — kept consistent with the colors already used elsewhere
// in the app (e.g. the format cards on ExportPage, low-stock/expiry
// badges) so the PDF feels like part of the same product, not a
// generic report.
const COLOR_PRIMARY: [number, number, number] = [37, 99, 235]; // blue-600
const COLOR_RED: [number, number, number] = [185, 28, 28]; // red-700
const COLOR_RED_BG: [number, number, number] = [254, 226, 226]; // red-100
const COLOR_AMBER: [number, number, number] = [180, 83, 9]; // amber-700
const COLOR_AMBER_BG: [number, number, number] = [254, 243, 199]; // amber-100
const COLOR_EMERALD: [number, number, number] = [4, 120, 87]; // emerald-700
const COLOR_ORANGE: [number, number, number] = [194, 65, 12]; // orange-700
const COLOR_MUTED: [number, number, number] = [107, 114, 128]; // gray-500
const COLOR_DARK: [number, number, number] = [31, 41, 55]; // gray-800

/**
 * Builds the full inventory report as a jsPDF document — shared by both the
 * "share" and "download" paths so they always produce identical, fully
 * featured output (previously downloadInventory had its own trimmed-down
 * copy of this logic that had drifted out of sync).
 *
 * Rows in the medicine table are color-coded by expiry status (red for
 * expired, amber for expiring within 30 days) so the report is scannable
 * at a glance without reading every cell.
 */
function buildPDF(options: ExportOptions = {}): jsPDF {
  const medications = getMedications();
  const doc = new jsPDF();
  const { includeEmergencySection = true } = options;
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header band ──
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('HomeMed Cabinet', 14, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Inventory Report — ${new Date().toLocaleDateString()}`, 14, 23);

  // ── Summary stats ──
  const expired = medications.filter((m) => getExpirationStatus(m.expirationDate) === 'expired');
  const expiringSoon = medications.filter((m) => getExpirationStatus(m.expirationDate) === 'expiring-soon');
  const lowStock = medications.filter((m) => isLowStock(m));

  let yPos = 42;
  const stats: Array<[string, number, [number, number, number]]> = [
    ['Total', medications.length, COLOR_DARK],
    ['Expired', expired.length, COLOR_RED],
    ['Expiring Soon', expiringSoon.length, COLOR_AMBER],
    ['Low Stock', lowStock.length, COLOR_ORANGE],
  ];
  const colWidth = (pageWidth - 28) / stats.length;
  stats.forEach(([label, count, color], i) => {
    const x = 14 + i * colWidth;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...color);
    doc.text(String(count), x, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(label, x, yPos + 5);
  });

  yPos += 15;

  // ── Medicine table — color-coded by expiry status ──
  if (medications.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COLOR_DARK);
    doc.text('Medicine Inventory', 14, yPos);
    yPos += 7;

    const tableData = medications.map((med) => {
      const days = getDaysUntilExpiration(med.expirationDate);
      const status = days < 0 ? 'Expired' : days <= 30 ? `Expiring (${days}d)` : 'Valid';
      const qty = isLowStock(med) ? `${med.quantity} ⚠` : String(med.quantity);
      return [med.name, med.dosage, qty, new Date(med.expirationDate).toLocaleDateString(), status, med.category];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Name', 'Dosage', 'Qty', 'Expires', 'Status', 'Category']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: COLOR_PRIMARY, textColor: 255 },
      didParseCell: (data: { section: string; row: { index: number }; cell: { styles: { fillColor?: unknown; textColor?: unknown } } }) => {
        if (data.section !== 'body') return;
        const med = medications[data.row.index];
        if (!med) return;
        const days = getDaysUntilExpiration(med.expirationDate);
        if (days < 0) {
          data.cell.styles.fillColor = COLOR_RED_BG;
          data.cell.styles.textColor = COLOR_RED;
        } else if (days <= 30) {
          data.cell.styles.fillColor = COLOR_AMBER_BG;
          data.cell.styles.textColor = COLOR_AMBER;
        }
      },
    });

    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  }

  // ── Emergency readiness ──
  if (includeEmergencySection && yPos < 250) {
    const readiness = getEmergencyReadiness(medications);
    const badgeColor =
      readiness.status === 'excellent' ? COLOR_EMERALD : readiness.status === 'moderate' ? COLOR_AMBER : COLOR_RED;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COLOR_DARK);
    doc.text('Emergency Readiness', 14, yPos);
    yPos += 7;

    doc.setFontSize(11);
    doc.setTextColor(...badgeColor);
    doc.text(`${readiness.score}% — ${readiness.status}`, 14, yPos);
    yPos += 6;

    if (readiness.missing.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...COLOR_MUTED);
      const missingLines = doc.splitTextToSize(`Missing: ${readiness.missing.join(', ')}`, pageWidth - 28);
      doc.text(missingLines, 14, yPos);
    }
  }

  // ── Disclaimer footer on every page ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('Generated by HomeMed Cabinet — this report is not medical advice.', 14, 287);
  }

  return doc;
}

export async function exportToPDF(options: ExportOptions = {}): Promise<void> {
  const doc = buildPDF(options);
  const pdfBase64 = doc.output('datauristring').split(',')[1];
  await savePDFFile(pdfBase64, `homemed-inventory-${Date.now()}.pdf`);
}

// ==================== TXT Export ====================

function buildTXTContent(options: ExportOptions = {}): string {
  const medications = getMedications();
  const { includeNotes = true, includeEmergencySection = true } = options;
  
  let content = '========================================\n';
  content += '      HomeMed Cabinet Inventory\n';
  content += '========================================\n\n';
  content += `Export Date: ${new Date().toLocaleString()}\n`;
  content += `Total Medicines: ${medications.length}\n\n`;
  
  content += '----------------------------------------\n';
  content += '         MEDICINE INVENTORY\n';
  content += '----------------------------------------\n\n';
  
  for (const med of medications) {
    const days = getDaysUntilExpiration(med.expirationDate);
    const status = days < 0 ? 'EXPIRED' : days <= 30 ? `EXPIRING SOON (${days} days)` : 'Valid';
    
    content += `Name: ${med.name}\n`;
    content += `  Active Ingredient: ${med.activeIngredient}\n`;
    content += `  Dosage: ${med.dosage}\n`;
    content += `  Form: ${med.form}\n`;
    content += `  Quantity: ${med.quantity}\n`;
    content += `  Expiration: ${new Date(med.expirationDate).toLocaleDateString()} (${status})\n`;
    content += `  Category: ${med.category}\n`;
    content += `  Prescription: ${med.prescriptionRequired ? 'Yes' : 'No'}\n`;
    content += `  Instructions: ${med.usageInstructions}\n`;
    
    if (includeNotes && med.notes) {
      content += `  Notes: ${med.notes}\n`;
    }
    
    content += '\n';
  }
  
  if (includeEmergencySection) {
    const readiness = getEmergencyReadiness(medications);
    content += '----------------------------------------\n';
    content += '      EMERGENCY READINESS\n';
    content += '----------------------------------------\n\n';
    content += `Score: ${readiness.score}% (${readiness.status})\n`;
    if (readiness.missing.length > 0) {
      content += `Missing Items: ${readiness.missing.join(', ')}\n`;
    }
    content += '\n';
  }
  
  content += '----------------------------------------\n';
  content += '--- End of Report ---\n';
  
  return content;
}

export async function exportToTXT(options: ExportOptions = {}): Promise<void> {
  const content = buildTXTContent(options);
  await saveAndShareFile(content, `homemed-inventory-${Date.now()}.txt`, 'text/plain');
}

// ==================== JSON Export ====================

function buildJSONContent(): string {
  const medications = getMedications();
  
  const exportData = {
    app: 'HomeMed Cabinet',
    version: '1.0.2',
    exportDate: new Date().toISOString(),
    medications,
    metadata: {
      total: medications.length,
      expired: medications.filter((m) => getExpirationStatus(m.expirationDate) === 'expired').length,
      expiringSoon: medications.filter((m) => getExpirationStatus(m.expirationDate) === 'expiring-soon').length,
    },
  };
  
  return JSON.stringify(exportData, null, 2);
}

export async function exportToJSON(): Promise<void> {
  const content = buildJSONContent();
  await saveAndShareFile(content, `homemed-backup-${Date.now()}.json`, 'application/json');
}

// ==================== HomeMed Export (.homemed) ====================

export async function exportToHomeMed(): Promise<void> {
  const medications = getMedications();
  const content = await encodeHomeMedFile(medications);
  await saveAndShareFile(content, `homemed-share-${Date.now()}.homemed`, 'application/octet-stream');
}

// ==================== Generic Export ====================

export async function exportInventory(format: ExportFormat, options: ExportOptions = {}): Promise<void> {
  switch (format) {
    case 'pdf':
      await exportToPDF(options);
      break;
    case 'txt':
      await exportToTXT(options);
      break;
    case 'json':
      await exportToJSON();
      break;
    case 'homemed':
      await exportToHomeMed();
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// ==================== Direct Download (saves to Documents/homemed-backups/) ====================

export async function downloadInventory(format: ExportFormat, options: ExportOptions = {}): Promise<string> {
  switch (format) {
    case 'pdf': {
      const doc = buildPDF(options);
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const filename = `homemed-inventory-${Date.now()}.pdf`;
      return await downloadFile(pdfBase64, filename, true);
    }
    case 'txt': {
      const content = buildTXTContent(options);
      const filename = `homemed-inventory-${Date.now()}.txt`;
      return await downloadFile(content, filename, false);
    }
    case 'json': {
      const content = buildJSONContent();
      const filename = `homemed-backup-${Date.now()}.json`;
      return await downloadFile(content, filename, false);
    }
    case 'homemed': {
      const medications = getMedications();
      const content = await encodeHomeMedFile(medications);
      const filename = `homemed-share-${Date.now()}.homemed`;
      return await downloadFile(content, filename, false);
    }
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

export { getDaysUntilExpiration, getExpirationStatus, getEmergencyReadiness };
