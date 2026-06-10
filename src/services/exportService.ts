import { jsPDF } from 'jspdf';
// @ts-ignore
import { autoTable } from 'jspdf-autotable';
import type { Medication } from '@/types/medication';
import { EMERGENCY_ITEMS } from '@/types/medication';
import { saveAndShareFile, savePDFFile } from './fileSystem';
import { getMedications } from './medicationService';

export type ExportFormat = 'pdf' | 'txt' | 'json';

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

export async function exportToPDF(options: ExportOptions = {}): Promise<void> {
  const medications = getMedications();
  const doc = new jsPDF();
  const { includeEmergencySection = true } = options;
  
  // Title
  doc.setFontSize(22);
  doc.text('HomeMed Cabinet', 14, 20);
  doc.setFontSize(12);
  doc.text(`Inventory Report - ${new Date().toLocaleDateString()}`, 14, 30);
  
  // Summary stats
  const expired = medications.filter((m) => getExpirationStatus(m.expirationDate) === 'expired');
  const expiringSoon = medications.filter((m) => getExpirationStatus(m.expirationDate) === 'expiring-soon');
  const lowStock = medications.filter((m) => m.quantity <= 5);
  
  doc.setFontSize(10);
  doc.text(`Total Medicines: ${medications.length}`, 14, 42);
  doc.text(`Expired: ${expired.length}`, 14, 48);
  doc.text(`Expiring Soon: ${expiringSoon.length}`, 14, 54);
  doc.text(`Low Stock: ${lowStock.length}`, 14, 60);
  
  let yPos = 70;
  
  // Medicines table
  if (medications.length > 0) {
    doc.setFontSize(14);
    doc.text('Medicine Inventory', 14, yPos);
    yPos += 8;
    
    const tableData = medications.map((med) => {
      const days = getDaysUntilExpiration(med.expirationDate);
      const status = days < 0 ? 'Expired' : days <= 30 ? `Expiring (${days}d)` : 'Valid';
      return [
        med.name,
        med.dosage,
        med.quantity.toString(),
        new Date(med.expirationDate).toLocaleDateString(),
        status,
        med.category,
      ];
    });
    
    autoTable(doc, {
      startY: yPos,
      head: [['Name', 'Dosage', 'Qty', 'Expires', 'Status', 'Category']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Expiring medicines section
  if (expiringSoon.length > 0 && yPos < 250) {
    doc.setFontSize(14);
    doc.text('Expiring Soon (30 days)', 14, yPos);
    yPos += 8;
    
    const expiringData = expiringSoon.map((med) => {
      const days = getDaysUntilExpiration(med.expirationDate);
      return [med.name, med.dosage, `${days} days`];
    });
    
    autoTable(doc, {
      startY: yPos,
      head: [['Name', 'Dosage', 'Days Left']],
      body: expiringData,
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [245, 158, 11] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Emergency readiness section
  if (includeEmergencySection && yPos < 240) {
    const readiness = getEmergencyReadiness(medications);
    doc.setFontSize(14);
    doc.text('Emergency Readiness', 14, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.text(`Score: ${readiness.score}% (${readiness.status})`, 14, yPos);
    yPos += 6;
    
    if (readiness.missing.length > 0) {
      doc.text(`Missing: ${readiness.missing.join(', ')}`, 14, yPos);
      yPos += 10;
    }
  }
  
  // AI Analysis Prompt on new page
  doc.addPage();
  doc.setFontSize(14);
  doc.text('AI Analysis Prompt', 14, 20);
  doc.setFontSize(10);
  
  const promptText = `Analyze this medicine inventory and determine:
- Which prescribed medicines are already available
- Possible alternatives based on active ingredients
- Medicines nearing expiration
- Potential duplicates
- Missing emergency essentials
- Possible medicine interactions

This report is not medical advice.`;
  
  doc.text(promptText, 14, 35);
  
  // Disclaimer
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Generated by HomeMed Cabinet - This report is not medical advice.', 14, 280);
  
  const pdfBase64 = doc.output('datauristring').split(',')[1];
  await savePDFFile(pdfBase64, `homemed-inventory-${Date.now()}.pdf`);
}

// ==================== TXT Export ====================

export async function exportToTXT(options: ExportOptions = {}): Promise<void> {
  const medications = getMedications();
  const { includeNotes = true, includeEmergencySection = true } = options;
  
  let content = '========================================\n';
  content += '      HomeMed Cabinet Inventory\n';
  content += '========================================\n\n';
  content += `Export Date: ${new Date().toLocaleString()}\n`;
  content += `Total Medicines: ${medications.length}\n\n`;
  
  // Medicines list
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
  
  // Emergency readiness
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
  
  // AI Prompt
  content += '----------------------------------------\n';
  content += '        AI ANALYSIS PROMPT\n';
  content += '----------------------------------------\n\n';
  content += 'Analyze this medicine inventory and determine:\n';
  content += '- Which prescribed medicines are already available\n';
  content += '- Possible alternatives based on active ingredients\n';
  content += '- Medicines nearing expiration\n';
  content += '- Potential duplicates\n';
  content += '- Missing emergency essentials\n';
  content += '- Possible medicine interactions\n\n';
  content += 'This report is not medical advice.\n\n';
  
  content += '--- End of Report ---\n';
  
  await saveAndShareFile(content, `homemed-inventory-${Date.now()}.txt`, 'text/plain');
}

// ==================== JSON Export ====================

export async function exportToJSON(): Promise<void> {
  const medications = getMedications();
  
  const exportData = {
    app: 'HomeMed Cabinet',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    medications,
    metadata: {
      total: medications.length,
      expired: medications.filter((m) => getExpirationStatus(m.expirationDate) === 'expired').length,
      expiringSoon: medications.filter((m) => getExpirationStatus(m.expirationDate) === 'expiring-soon').length,
    },
  };
  
  const content = JSON.stringify(exportData, null, 2);
  await saveAndShareFile(content, `homemed-backup-${Date.now()}.json`, 'application/json');
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
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

export { getDaysUntilExpiration, getExpirationStatus, getEmergencyReadiness };
