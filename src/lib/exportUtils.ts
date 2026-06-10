import { jsPDF } from 'jspdf';
import type { Medicine, AppSettings, DashboardStats, EmergencyCheckResult } from '@/types/medicine';
import { getDaysUntilExpiration } from '@/hooks/useMedicine';

function formatDate(dateStr: string, format: AppSettings['exportPreferences']['dateFormat']): string {
  const d = new Date(dateStr);
  switch (format) {
    case 'us': return d.toLocaleDateString('en-US');
    case 'eu': return d.toLocaleDateString('en-GB');
    default: return d.toISOString().split('T')[0];
  }
}

function getExportDate(format: AppSettings['exportPreferences']['dateFormat']): string {
  return formatDate(new Date().toISOString(), format);
}

function isExpired(expirationDate: string): boolean {
  return getDaysUntilExpiration(expirationDate) < 0;
}

function isExpiringSoon(expirationDate: string): boolean {
  const days = getDaysUntilExpiration(expirationDate);
  return days >= 0 && days <= 30;
}

const AI_ANALYSIS_PROMPT = `
═══════════════════════════════════════════════════════════════
  AI ANALYSIS PROMPT — HomeMed Cabinet Export
═══════════════════════════════════════════════════════════════

Analyze this medicine inventory and determine:

1. PRESCRIBED MEDICINES AVAILABLE
   — List all prescription-required medicines in the inventory

2. POSSIBLE ALTERNATIVES
   — Based on active ingredients, suggest potential alternatives
     that may serve similar purposes

3. EXPIRATION ANALYSIS
   — Identify all medicines nearing expiration (within 30 days)
   — Flag any expired medicines that should be disposed of

4. POTENTIAL DUPLICATES
   — Check for medicines with overlapping active ingredients
     that could be redundant

5. EMERGENCY READINESS GAPS
   — Review the emergency essentials checklist
   — Identify missing critical items for home emergencies

6. MEDICINE INTERACTIONS
   — Flag any known interactions between active ingredients
     in the inventory (consult pharmacist for confirmation)

DISCLAIMER: This analysis is generated from an exported medicine 
inventory for informational purposes only. It is NOT medical advice. 
Always consult a qualified healthcare professional before making 
any decisions about medications, treatments, or emergency preparedness.

═══════════════════════════════════════════════════════════════
`;

export function exportToPDF(
  medicines: Medicine[],
  stats: DashboardStats,
  emergencyCheck: EmergencyCheckResult[],
  settings: AppSettings
): void {
  const doc = new jsPDF();
  const prefs = settings.exportPreferences;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Helper to add text with positioning
  const addText = (text: string, x: number, yPos: number, options?: { size?: number; bold?: boolean; align?: 'center' | 'left' | 'right' }) => {
    const size = options?.size || 11;
    const align = options?.align || 'left';
    if (options?.bold) {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }
    doc.setFontSize(size);
    if (align === 'center') {
      doc.text(text, pageWidth / 2, yPos, { align: 'center' });
    } else if (align === 'right') {
      doc.text(text, pageWidth - margin, yPos, { align: 'right' });
    } else {
      doc.text(text, x, yPos);
    }
    return yPos + size * 0.5;
  };

  // Title
  doc.setFillColor(95, 158, 149);
  doc.rect(0, 0, pageWidth, 50, 'F');
  doc.setTextColor(255, 255, 255);
  y = addText('HomeMed Cabinet', margin, 25, { size: 24, bold: true });
  y = addText('Medicine Inventory Report', margin, 35, { size: 14 });
  y = addText(`Export Date: ${getExportDate(prefs.dateFormat)}`, margin, 45, { size: 10 });
  y = 60;

  // Summary Stats
  doc.setTextColor(30, 41, 59);
  y = addText('Inventory Summary', margin, y, { size: 16, bold: true });
  y += 5;
  const summaryItems = [
    `Total Medicines: ${stats.totalMedicines}`,
    `Expiring Soon: ${stats.expiringSoon}`,
    `Expired: ${stats.expired}`,
    `Low Stock: ${stats.lowStock}`,
    `Emergency Items: ${stats.emergencyCount}`,
    `Readiness Score: ${stats.readinessScore}% (${stats.readinessStatus})`,
  ];
  summaryItems.forEach(item => {
    y = addText(`• ${item}`, margin + 5, y, { size: 10 });
  });
  y += 10;

  // Expiring Soon Section
  const expiringSoon = medicines.filter(m => isExpiringSoon(m.expirationDate) && !isExpired(m.expirationDate));
  if (expiringSoon.length > 0) {
    y = addText('Expiring Soon (Within 30 Days)', margin, y, { size: 14, bold: true });
    y += 3;
    expiringSoon.forEach(m => {
      const daysLeft = getDaysUntilExpiration(m.expirationDate);
      y = addText(`⚠ ${m.name} (${m.dosage}) — ${daysLeft} days left`, margin + 5, y, { size: 9 });
    });
    y += 8;
  }

  // Expired Section
  const expired = medicines.filter(m => isExpired(m.expirationDate));
  if (expired.length > 0 && prefs.includeExpired) {
    y = addText('Expired Medicines (Dispose Immediately)', margin, y, { size: 14, bold: true });
    y += 3;
    expired.forEach(m => {
      const daysOver = Math.abs(getDaysUntilExpiration(m.expirationDate));
      y = addText(`✗ ${m.name} (${m.dosage}) — Expired ${daysOver} days ago`, margin + 5, y, { size: 9 });
    });
    y += 8;
  }

  // Emergency Readiness
  y = addText('Emergency Readiness Check', margin, y, { size: 14, bold: true });
  y += 3;
  emergencyCheck.forEach(ec => {
    const symbol = ec.found ? '✓' : '✗';
    y = addText(`${symbol} ${ec.item.name}${ec.found && ec.matchedMedicine ? ` — ${ec.matchedMedicine.name}` : ''}`, margin + 5, y, { size: 9 });
  });
  y += 8;

  // New page for full inventory
  doc.addPage();
  y = 20;
  y = addText('Complete Medicine Inventory', margin, y, { size: 16, bold: true });
  y += 5;

  medicines.forEach((m, i) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    const status = isExpired(m.expirationDate) ? 'EXPIRED' :
      isExpiringSoon(m.expirationDate) ? 'EXPIRING SOON' : 'Good';

    y = addText(`${i + 1}. ${m.name}`, margin, y, { size: 12, bold: true });
    y = addText(`   Active Ingredient: ${m.activeIngredient}`, margin, y, { size: 9 });
    y = addText(`   Dosage: ${m.dosage} | Form: ${m.form} | Quantity: ${m.quantity}`, margin, y, { size: 9 });
    y = addText(`   Category: ${m.category} | Expires: ${formatDate(m.expirationDate, prefs.dateFormat)} | Status: ${status}`, margin, y, { size: 9 });
    y = addText(`   Prescription: ${m.prescriptionRequired ? 'Required' : 'Not Required'}`, margin, y, { size: 9 });

    if (prefs.includeNotes && m.notes) {
      y = addText(`   Notes: ${m.notes}`, margin, y, { size: 8 });
    }

    if (m.usageInstructions) {
      y = addText(`   Usage: ${m.usageInstructions}`, margin, y, { size: 8 });
    }
    y += 4;
  });

  // AI Analysis Prompt at the end
  doc.addPage();
  y = 20;
  doc.setTextColor(95, 158, 149);
  y = addText('AI Analysis Prompt', margin, y, { size: 16, bold: true });
  y += 5;
  doc.setTextColor(30, 41, 59);

  const lines = AI_ANALYSIS_PROMPT.split('\n');
  lines.forEach(line => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    y = addText(line, margin, y, { size: 8 });
  });

  doc.save(`homemed-inventory-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportToTXT(
  medicines: Medicine[],
  stats: DashboardStats,
  emergencyCheck: EmergencyCheckResult[],
  settings: AppSettings
): void {
  const prefs = settings.exportPreferences;
  let content = '';

  content += '═══════════════════════════════════════════════════════════════\n';
  content += '  HOMED CABINET — MEDICINE INVENTORY REPORT\n';
  content += '═══════════════════════════════════════════════════════════════\n\n';
  content += `Export Date: ${getExportDate(prefs.dateFormat)}\n`;
  content += `Total Medicines: ${stats.totalMedicines}\n`;
  content += `Readiness Score: ${stats.readinessScore}% (${stats.readinessStatus})\n`;
  content += `Expiring Soon: ${stats.expiringSoon}\n`;
  content += `Expired: ${stats.expired}\n`;
  content += `Low Stock: ${stats.lowStock}\n\n`;

  content += '───────────────────────────────────────────────────────────────\n';
  content += '  MEDICINE INVENTORY\n';
  content += '───────────────────────────────────────────────────────────────\n\n';

  medicines.forEach((m, i) => {
    const daysLeft = getDaysUntilExpiration(m.expirationDate);
    const status = daysLeft < 0 ? 'EXPIRED' : daysLeft <= 30 ? 'EXPIRING_SOON' : 'GOOD';

    content += `[${i + 1}] ${m.name}\n`;
    content += `    active_ingredient: ${m.activeIngredient}\n`;
    content += `    dosage: ${m.dosage}\n`;
    content += `    form: ${m.form}\n`;
    content += `    quantity: ${m.quantity}\n`;
    content += `    category: ${m.category}\n`;
    content += `    expiration_date: ${formatDate(m.expirationDate, prefs.dateFormat)}\n`;
    content += `    days_remaining: ${daysLeft}\n`;
    content += `    status: ${status}\n`;
    content += `    prescription_required: ${m.prescriptionRequired}\n`;
    content += `    usage_instructions: ${m.usageInstructions}\n`;
    if (prefs.includeNotes && m.notes) {
      content += `    notes: ${m.notes}\n`;
    }
    content += `    added_date: ${formatDate(m.createdAt, prefs.dateFormat)}\n\n`;
  });

  content += '───────────────────────────────────────────────────────────────\n';
  content += '  EMERGENCY READINESS CHECK\n';
  content += '───────────────────────────────────────────────────────────────\n\n';

  emergencyCheck.forEach(ec => {
    content += `[${ec.found ? 'X' : ' '}] ${ec.item.name}`;
    if (ec.found && ec.matchedMedicine) {
      content += ` → Found: ${ec.matchedMedicine.name}`;
    }
    content += '\n';
  });
  content += `\nScore: ${stats.readinessScore}% — Status: ${stats.readinessStatus.toUpperCase()}\n\n`;

  content += AI_ANALYSIS_PROMPT;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `homemed-inventory-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToJSON(
  medicines: Medicine[],
  stats: DashboardStats,
  emergencyCheck: EmergencyCheckResult[],
): void {
  const exportData = {
    metadata: {
      app: 'HomeMed Cabinet',
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      purpose: 'AI-assisted medicine inventory analysis',
      disclaimer: 'This data is exported for informational purposes only. NOT medical advice.',
    },
    summary: {
      totalMedicines: stats.totalMedicines,
      expiringSoon: stats.expiringSoon,
      expired: stats.expired,
      lowStock: stats.lowStock,
      emergencyItems: stats.emergencyCount,
      readinessScore: stats.readinessScore,
      readinessStatus: stats.readinessStatus,
    },
    medicines: medicines.map(m => ({
      id: m.id,
      name: m.name,
      activeIngredient: m.activeIngredient,
      dosage: m.dosage,
      form: m.form,
      quantity: m.quantity,
      category: m.category,
      expirationDate: m.expirationDate,
      daysUntilExpiration: getDaysUntilExpiration(m.expirationDate),
      status: getDaysUntilExpiration(m.expirationDate) < 0 ? 'expired' :
        getDaysUntilExpiration(m.expirationDate) <= 30 ? 'expiring_soon' : 'good',
      prescriptionRequired: m.prescriptionRequired,
      usageInstructions: m.usageInstructions,
      notes: m.notes,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    })),
    emergencyReadiness: {
      score: stats.readinessScore,
      status: stats.readinessStatus,
      items: emergencyCheck.map(ec => ({
        name: ec.item.name,
        found: ec.found,
        matchedMedicine: ec.matchedMedicine ? {
          id: ec.matchedMedicine.id,
          name: ec.matchedMedicine.name,
          activeIngredient: ec.matchedMedicine.activeIngredient,
        } : null,
      })),
    },
    aiAnalysisPrompt: AI_ANALYSIS_PROMPT.trim(),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `homemed-inventory-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
