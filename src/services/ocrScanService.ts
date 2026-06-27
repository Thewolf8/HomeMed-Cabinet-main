/**
 * ocrScanService.ts  —  Smart Camera Scan  (100% offline)
 *
 * Uses a custom Capacitor plugin (TextScanPlugin.java + TextScanActivity.java)
 * that opens a native full-screen camera viewfinder — identical UX to the
 * barcode scanner — then runs ML Kit Text Recognition on the captured frame.
 *
 * Pipeline:
 *   1. JS calls TextScan.scan()
 *   2. TextScanActivity opens: live CameraX preview + guide overlay
 *   3. User points camera at medicine box and taps "مسح"
 *   4. ML Kit Text Recognition runs on-device (<200 ms)
 *   5. Raw text is returned to JS via Activity result
 *   6. parseOcrText() structures the raw text into form fields
 *
 * No internet used at any step.
 * No npm package needed — the plugin lives inside android/app/src/main/java/.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

// ── Native plugin interface ───────────────────────────────────────────────────

interface TextScanPlugin {
  /** Opens the native camera viewfinder and returns the recognised text. */
  scan(): Promise<{ text: string }>;
}

// registerPlugin links the JS call to the @CapacitorPlugin(name="TextScan") class.
const TextScan = registerPlugin<TextScanPlugin>('TextScan');

// ── Public result type ────────────────────────────────────────────────────────

export interface OcrScanResult {
  medicine_name:     string | null;
  active_ingredient: string | null;
  dosage_strength:   string | null;
  form:              string | null;
  additional_info:   string | null;
}

// ── Error types ───────────────────────────────────────────────────────────────

export class OcrNotSupportedError extends Error {
  constructor(msg = 'Camera scan is only available on the installed Android app.') { super(msg); }
}
export class OcrNoTextError extends Error {
  constructor(msg = 'No text detected. Try better lighting or a clearer angle.') { super(msg); }
}

// ── Offline structured parser ─────────────────────────────────────────────────
//
// Implements the same differentiation rules described in the system prompt:
//
//  medicine_name     — commercial brand name (ALL-CAPS, prominent, early in text)
//  active_ingredient — chemical/generic name (in parentheses or after DCI/INN labels)
//  dosage_strength   — numeric + unit (500mg, 1g, 200mg/5ml …)
//  form              — physical form keyword (Comprimé, Capsules, Sirop …)
//  additional_info   — remaining warnings, storage info, lab names
//
// Text from Algerian / Moroccan / French medicine boxes is usually French with
// some Arabic, so all patterns cover both scripts.

const DOSAGE_RE =
  /\b(\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|µg|UI|IU|MG|G|ML)(?:\s*\/\s*\d+\s*(?:ml|g|ML|G))?)/i;

const FORM_RE =
  /\b(comprim[ée]s?|g[ée]lules?|capsules?|sirop|suspension|solution|pommade|cr[eè]me?|injectable|ampoules?|sachet|suppositoire|lozenge|granul[ée]s?|inhaler?|spray|a[ée]rosol|patch|ointment|tablets?|capsule|syrup|cream|\bgel\b|drops?|gouttes?|poudre|powder)\b/i;

const SKIP_RE = new RegExp(
  FORM_RE.source + '|' +
  DOSAGE_RE.source + '|' +
  /boîte|gélules|اقراص|كبسولات|شراب|laboratoire|pharma|production|ministère|وزارة|قرص/i.source,
  'i',
);

function parseOcrText(rawText: string): OcrScanResult {
  const lines = rawText.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);

  // ── dosage_strength ──────────────────────────────────────────────────────
  const dosage_strength = rawText.match(DOSAGE_RE)?.[1]?.trim() ?? null;

  // ── form ─────────────────────────────────────────────────────────────────
  const form = rawText.match(FORM_RE)?.[1] ?? null;

  // ── active_ingredient ────────────────────────────────────────────────────
  // Priority 1: chemical name inside parentheses — e.g. "Doliprane (Paracétamol)"
  let active_ingredient: string | null = null;
  for (const m of rawText.matchAll(/\(([A-Za-zÀ-ÖØ-öø-ÿ][^()]{3,60})\)/g)) {
    const c = m[1].trim();
    if (!/^\d/.test(c) && !/^(boîte|box|flacon|ml|mg)/i.test(c)) {
      active_ingredient = c;
      break;
    }
  }
  // Priority 2: after a DCI / INN / "substance active" label
  if (!active_ingredient) {
    const dciM = rawText.match(
      /(?:DCI|INN|Substance\s+active|Principe\s+actif|مادة\s+فعالة|المادة\s+الفعالة)\s*:?\s*([A-Za-zÀ-ÖØ-öø-ÿ][^\n,;(]{3,60})/i,
    );
    if (dciM) active_ingredient = dciM[1].trim();
  }

  // ── medicine_name ─────────────────────────────────────────────────────────
  // Priority 1: short ALL-CAPS line — brand names on French medicine boxes are
  //             almost always printed in uppercase and appear alone on a line.
  const capsLine = lines.find(
    (l) =>
      l.length >= 3 && l.length <= 30 &&
      l === l.toUpperCase() &&
      /[A-ZÀ-Ö]/.test(l) &&
      !DOSAGE_RE.test(l) &&
      !FORM_RE.test(l) &&
      l !== active_ingredient,
  );
  // Priority 2: first clean line that isn't a form / dosage / ingredient
  const cleanLine = lines.find(
    (l) =>
      l.length >= 3 && l.length <= 50 &&
      !/^\d/.test(l) &&
      !SKIP_RE.test(l) &&
      l !== active_ingredient,
  );
  const medicine_name = capsLine ?? cleanLine ?? null;

  // ── additional_info ───────────────────────────────────────────────────────
  const usedSet = new Set(
    [medicine_name, active_ingredient, dosage_strength, form].filter(Boolean) as string[],
  );
  const additional_info =
    lines
      .filter((l) => l.length > 5 && !usedSet.has(l))
      .slice(3)
      .join(' ')
      .substring(0, 300) || null;

  return { medicine_name, active_ingredient, dosage_strength, form, additional_info };
}

// ── Form-value mapper ─────────────────────────────────────────────────────────

const FORM_MAP: Array<[RegExp, string]> = [
  [/comprim[ée]|tablet/i,        'tablets'],
  [/g[ée]lule|capsule/i,         'capsules'],
  [/sirop|syrup/i,               'syrup'],
  [/\bsolution\b/i,              'solution'],
  [/suspension/i,                'suspension'],
  [/inject|ampoule/i,            'injection'],
  [/gouttes?|drops?/i,           'drops'],
  [/spray|a[ée]rosol/i,          'spray'],
  [/inhalat|inhaler/i,           'inhaler'],
  [/cr[eè]me?|cream/i,           'cream'],
  [/pommade|ointment/i,          'ointment'],
  [/\bgel\b/i,                   'gel'],
  [/patch|timbre/i,              'patch'],
  [/suppositoire|suppository/i,  'suppository'],
  [/poudre|powder/i,             'powder'],
  [/pastille|lozenge/i,          'lozenge'],
  [/granul[ée]/i,                'granules'],
];

export function mapOcrFormToMedicineForm(ocrForm: string | null): string | null {
  if (!ocrForm) return null;
  for (const [re, appForm] of FORM_MAP) {
    if (re.test(ocrForm)) return appForm;
  }
  return null;
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Opens the native camera viewfinder, waits for the user to tap Scan,
 * runs on-device ML Kit OCR, and returns structured form data.
 *
 * Throws OcrNotSupportedError  — called from a browser / non-native build
 * Throws OcrNoTextError        — user cancelled or no text found
 */
export async function scanBoxAndParse(): Promise<OcrScanResult> {
  if (!isNative) throw new OcrNotSupportedError();

  let rawText: string;
  try {
    const result = await TextScan.scan();
    rawText = result.text?.trim() ?? '';
  } catch (err: unknown) {
    // "CANCELLED" is a normal user action, map to OcrNoTextError so the page
    // clears the loading state without showing a toast.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('CANCELLED')) throw new OcrNoTextError('Scan cancelled.');
    throw err;
  }

  if (!rawText) throw new OcrNoTextError();
  return parseOcrText(rawText);
}
