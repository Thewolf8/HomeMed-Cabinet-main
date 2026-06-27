/**
 * ocrScanService.ts  —  Smart Camera Scan  (100% offline)
 *
 * Pipeline — no internet required at any step:
 *   1. Capture image via <input capture="environment"> in the Capacitor WebView
 *   2. Save to Directory.Cache via @capacitor/filesystem (already in project)
 *   3. Run ML Kit Text Recognition on-device via @jcesarmobile/capacitor-ocr
 *   4. Parse the raw OCR text with structured regex heuristics (no LLM needed)
 *   5. Return OcrScanResult — pages apply it to form fields with green highlights
 *
 * Install:
 *   npm install @jcesarmobile/capacitor-ocr
 *   npx cap sync android
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

const isNative = Capacitor.isNativePlatform();
const OCR_TEMP  = 'homemed-ocr-temp.jpg';

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

// ── Step 1 — open native camera and return the captured File ──────────────────

export function openCameraCapture(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment'); // rear camera preferred

    // Must be briefly in the DOM on some Android WebViews
    input.style.cssText = 'position:fixed;top:-9999px;opacity:0;pointer-events:none';
    document.body.appendChild(input);

    let settled = false;
    const done = (file?: File) => {
      if (settled) return;
      settled = true;
      try { document.body.removeChild(input); } catch {}
      if (file) resolve(file);
      else reject(new OcrNoTextError('No image selected.'));
    };

    input.onchange = () => done(input.files?.[0]);

    // Detect camera dismissal — the WebView gets focus back when user closes camera
    const timer = window.setTimeout(() => {
      window.removeEventListener('focus', onFocus);
    }, 60_000);
    const onFocus = () => {
      clearTimeout(timer);
      window.setTimeout(() => { if (!settled) done(); }, 600);
    };
    window.addEventListener('focus', onFocus, { once: true });

    input.click();
  });
}

// ── Step 2+3 — save to cache and run ML Kit OCR on-device ────────────────────

async function runMlKitOcr(file: File): Promise<string> {
  if (!isNative) throw new OcrNotSupportedError();

  // Read as base64 data URL then strip the header
  const base64 = await new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onload  = () => res((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => rej(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });

  // Write to cache dir so the native plugin can open it by file path
  await Filesystem.writeFile({
    path:      OCR_TEMP,
    data:      base64,
    directory: Directory.Cache,
  });

  const { uri } = await Filesystem.getUri({
    path:      OCR_TEMP,
    directory: Directory.Cache,
  });

  let rawText = '';
  try {
    // Dynamic import keeps the web build clean; package only present on native
    const { OCR } = await import('@jcesarmobile/capacitor-ocr');
    const result  = await OCR.recognizeText({ filename: uri });
    rawText = result.text?.trim() ?? '';
  } finally {
    // Best-effort cleanup — non-critical
    Filesystem.deleteFile({ path: OCR_TEMP, directory: Directory.Cache }).catch(() => {});
  }

  if (!rawText) throw new OcrNoTextError();
  return rawText;
}

// ── Step 4 — offline structured parser ───────────────────────────────────────
//
// Implements the same differentiation rules as the system prompt, in code:
//
//  medicine_name     — prominent commercial brand name (often ALL-CAPS, early in text)
//  active_ingredient — chemical/generic name (in parentheses or after DCI/INN labels)
//  dosage_strength   — numeric + unit (500mg, 1g, 200mg/5ml …)
//  form              — physical form keyword (Comprimé, Capsules, Sirop …)
//  additional_info   — remaining warnings, storage info, lab names
//
// Medicine box text in this region (Algeria/Morocco/France) is usually French
// with some Arabic, so patterns cover both.

const DOSAGE_RE = /\b(\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|µg|UI|IU|MG|G|ML)(?:\s*\/\s*\d+\s*(?:ml|g|ML|G))?)/i;

const FORM_RE = /\b(comprim[ée]s?|g[ée]lules?|capsules?|sirop|suspension|solution|pommade|cr[eè]me?|injectable|ampoules?|sachet|suppositoire|lozenge|granul[ée]s?|inhaler?|spray|a[ée]rosol|patch|ointment|tablets?|capsule|syrup|cream|\bgel\b|drops?|gouttes?|poudre|powder)\b/i;

const SKIP_RE = new RegExp(
  FORM_RE.source + '|' +
  DOSAGE_RE.source + '|' +
  /boîte|comprimés|gélules|اقراص|كبسولات|شراب|laboratoire|pharma|production|ministère|وزارة|قرص/i.source,
  'i',
);

function parseOcrText(rawText: string): OcrScanResult {
  const lines = rawText.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);

  // ── dosage_strength ────────────────────────────────────────────────────────
  const dosage_strength = rawText.match(DOSAGE_RE)?.[1]?.trim() ?? null;

  // ── form ──────────────────────────────────────────────────────────────────
  const form = rawText.match(FORM_RE)?.[1] ?? null;

  // ── active_ingredient ─────────────────────────────────────────────────────
  // Priority 1 — content inside parentheses that looks like a chemical name
  let active_ingredient: string | null = null;
  for (const m of rawText.matchAll(/\(([A-Za-zÀ-ÖØ-öø-ÿ][^()]{3,60})\)/g)) {
    const candidate = m[1].trim();
    if (!/^\d/.test(candidate) && !/^(boîte|box|flacon|ml|mg)/i.test(candidate)) {
      active_ingredient = candidate;
      break;
    }
  }
  // Priority 2 — after a DCI / INN / "substance active" label
  if (!active_ingredient) {
    const dciM = rawText.match(
      /(?:DCI|INN|Substance active|Principe actif|مادة فعالة|المادة الفعالة)\s*:?\s*([A-Za-zÀ-ÖØ-öø-ÿ][^\n,;(]{3,60})/i,
    );
    if (dciM) active_ingredient = dciM[1].trim();
  }

  // ── medicine_name ─────────────────────────────────────────────────────────
  // Priority 1 — short ALL-CAPS line (brand names on French medicine boxes are
  //              almost always printed in uppercase and appear alone on a line)
  const capsLine = lines.find(
    (l) =>
      l.length >= 3 && l.length <= 30 &&
      l === l.toUpperCase() &&
      /[A-ZÀ-Ö]/.test(l) &&
      !DOSAGE_RE.test(l) &&
      !FORM_RE.test(l) &&
      l !== active_ingredient,
  );
  // Priority 2 — first clean line that isn't a form / dosage / ingredient
  const cleanLine = lines.find(
    (l) =>
      l.length >= 3 && l.length <= 50 &&
      !/^\d/.test(l) &&
      !SKIP_RE.test(l) &&
      l !== active_ingredient,
  );
  const medicine_name = capsLine ?? cleanLine ?? null;

  // ── additional_info ───────────────────────────────────────────────────────
  // Everything beyond the first 3 lines that wasn't already captured,
  // capped at 300 characters so it fits the notes field cleanly.
  const usedSet = new Set(
    [medicine_name, active_ingredient, dosage_strength, form]
      .filter(Boolean) as string[],
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
// Maps free-text OCR form descriptions to the app's MedicineForm union values.

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
 * Full offline pipeline: capture → ML Kit OCR → regex parse → result.
 *
 * Throws:
 *   OcrNotSupportedError  — running in browser/web, not on native Android
 *   OcrNoTextError        — image captured but ML Kit found no text
 *   Error                 — unexpected native crash (pages show scanBoxError)
 */
export async function scanBoxAndParse(file: File): Promise<OcrScanResult> {
  const rawText = await runMlKitOcr(file);
  return parseOcrText(rawText);
}
