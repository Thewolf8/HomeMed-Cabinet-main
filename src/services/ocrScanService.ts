/**
 * ocrScanService.ts
 *
 * Pipeline:
 *   1. Capture image via native camera (<input capture="camera">)
 *   2. Run ML Kit Text Recognition on-device  →  raw OCR text
 *   3a. Parse via Anthropic API (online)       →  structured JSON
 *   3b. OR parse via regex heuristics (offline fallback)
 *
 * Requires: @capacitor-mlkit/text-recognition ^8.0.0
 *   npm install @capacitor-mlkit/text-recognition
 *   npx cap sync android
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
// NOTE: install @capacitor-mlkit/text-recognition to enable native OCR.
// The import is wrapped in a lazy dynamic import so the web build doesn't
// crash when the package is absent in a dev/browser environment.

const isNative = Capacitor.isNativePlatform();

const OCR_TEMP = 'homemed-ocr-temp.jpg';

// ── Public result shape ───────────────────────────────────────────────────────

export interface OcrScanResult {
  medicine_name:    string | null;
  active_ingredient: string | null;
  dosage_strength:  string | null;
  form:             string | null;
  additional_info:  string | null;
}

// ── Error types ───────────────────────────────────────────────────────────────

export class OcrNotSupportedError extends Error {
  constructor(msg = 'Camera scan is only available on the Android app.') { super(msg); }
}
export class OcrNoTextError extends Error {
  constructor(msg = 'No text detected. Try better lighting or a clearer photo.') { super(msg); }
}

// ── Step 1 — open camera and return the captured File ─────────────────────────

export function openCameraCapture(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment'); // prefer rear camera

    // Some Android WebViews need the element in the DOM briefly
    input.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(input);

    let settled = false;
    const finish = (file?: File) => {
      if (settled) return;
      settled = true;
      document.body.removeChild(input);
      if (file) resolve(file);
      else reject(new OcrNoTextError('No image selected.'));
    };

    input.onchange = () => finish(input.files?.[0]);

    // If the user dismisses the picker without choosing, fire after a delay
    window.addEventListener('focus', function onFocus() {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => {
        if (!settled && !input.files?.length) finish();
      }, 600);
    }, { once: true });

    input.click();
  });
}

// ── Step 2 — run ML Kit Text Recognition ──────────────────────────────────────

async function extractTextFromFile(file: File): Promise<string> {
  if (!isNative) {
    throw new OcrNotSupportedError();
  }

  // Read as base64
  const dataUrl = await new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onload  = () => res(reader.result as string);
    reader.onerror = () => rej(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
  const base64 = dataUrl.split(',')[1] ?? dataUrl;

  // Persist to cache dir so the ML Kit plugin can open it via file path
  await Filesystem.writeFile({
    path: OCR_TEMP,
    data: base64,
    directory: Directory.Cache,
  });

  const { uri } = await Filesystem.getUri({ path: OCR_TEMP, directory: Directory.Cache });

  let rawText = '';
  try {
    // Lazy-load to keep the web bundle clean (package only present on native)
    const { TextRecognition } = await import('@capacitor-mlkit/text-recognition');
    const result = await TextRecognition.recognizeText({ path: uri });
    rawText = result.text?.trim() ?? '';
  } finally {
    // Best-effort cleanup
    Filesystem.deleteFile({ path: OCR_TEMP, directory: Directory.Cache }).catch(() => {});
  }

  if (!rawText) throw new OcrNoTextError();
  return rawText;
}

// ── Step 3a — Anthropic API parser ───────────────────────────────────────────
// Uses the exact system prompt and output rules as specified.

const SYSTEM_PROMPT = `You are an expert medical data parser operating locally on a mobile device. Your task is to analyze chaotic, raw OCR text extracted from a medicine box image and structure it into a clean, valid JSON object.

Strictly differentiate between the Brand Name (Commercial name) and the Active Ingredient (Chemical compound).

Guidelines for Differentiation:
- "medicine_name": The main commercial/marketing brand name of the medicine (e.g., Doliprane, Adfen, Clamoxyl). It is usually prominent and stands alone.
- "active_ingredient": The scientific chemical name/generic compound (e.g., Paracetamol, Ibuprofene, Amoxicilline). It is often near the dosage weight or inside parentheses. If multiple ingredients exist, separate them with a comma.
- "dosage_strength": The quantitative strength of the drug (e.g., 500mg, 1g, 200mg/5ml).
- "form": The physical form of the medicine if mentioned (e.g., Comprimé, Capsules, Sirop, Gélules).
- "additional_info": Any other relevant safety warnings, storage instructions, or laboratory names found in the text.

Output Rules:
1. Provide the output ONLY as a valid JSON object.
2. Do NOT include markdown blocks like \`\`\`json ... \`\`\`, do NOT include explanations or extra words.
3. If a field cannot be found, set its value to null.
4. Keep the languages of the names exactly as they appear in the OCR text (usually French or Arabic).`;

async function parseWithApi(rawText: string): Promise<OcrScanResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Input Raw OCR Text:\n${rawText}` },
      ],
    }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json() as {
    content: Array<{ type: string; text?: string }>;
  };

  const text = data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  // Strip accidental markdown fences before parsing
  const clean = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  return JSON.parse(clean) as OcrScanResult;
}

// ── Step 3b — Offline regex fallback ─────────────────────────────────────────
// Used when the API call fails (no network, quota exceeded, etc.).
// Imperfect but gives the user a useful starting point offline.

function parseWithFallback(rawText: string): OcrScanResult {
  const lines = rawText.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);

  // Dosage: 500mg | 1g | 200mg/5ml | 0.5g | 1000UI
  const dosageMatch = rawText.match(
    /\b(\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|µg|UI|IU)(?:\s*\/\s*\d+\s*(?:ml|g))?)/i,
  );
  const dosage_strength = dosageMatch?.[1]?.trim() ?? null;

  // Form keywords (FR / EN / AR)
  const FORM_RE = /\b(comprim[ée]s?|g[ée]lules?|capsules?|sirop|suspension|solution|pommade|cr[eè]me?|injectable|ampoule|sachet|ovule|suppositoire|lozenge|granul[ée]s?|inhaler?|spray|patch|ointment|tablets?|capsule|syrup|cream|gel|drops?|gouttes?)\b/i;
  const formMatch = rawText.match(FORM_RE);
  const form = formMatch?.[1] ?? null;

  // Active ingredient: text inside parentheses OR after DCI/INN/substance label
  const inParens  = rawText.match(/\(([A-Za-zÀ-ÖØ-öø-ÿ][^)]{3,60})\)/);
  const afterLabel = rawText.match(/(?:DCI|INN|princip[ae]|substance\s+active|مادة فعالة)\s*:?\s*([A-Za-zÀ-ÖØ-öø-ÿ][^\n,;]{3,60})/i);
  const active_ingredient = (inParens?.[1] ?? afterLabel?.[1])?.trim() ?? null;

  // Name: first non-numeric line that isn't a form/dosage string
  const nameCandidates = lines.filter(
    (l) =>
      l.length >= 3 &&
      l.length <= 60 &&
      !/^\d/.test(l) &&
      !FORM_RE.test(l) &&
      !dosageMatch || !l.includes(dosageMatch?.[1] ?? '\x00'),
  );
  const medicine_name = nameCandidates[0] ?? null;

  // Additional info: everything beyond the first 3 lines, capped at 300 chars
  const additional_info = lines.slice(3).join(' ').substring(0, 300) || null;

  return { medicine_name, active_ingredient, dosage_strength, form, additional_info };
}

// ── Form-value mapper ─────────────────────────────────────────────────────────
// Converts free-text OCR form descriptions to the app's MedicineForm union.

const FORM_MAP: Array<[RegExp, string]> = [
  [/comprim[ée]|tablet/i,              'tablets'],
  [/g[ée]lule|capsule/i,               'capsules'],
  [/sirop|syrup/i,                     'syrup'],
  [/solution/i,                        'solution'],
  [/suspension/i,                      'suspension'],
  [/inject|ampoule/i,                  'injection'],
  [/gouttes?|drops?/i,                 'drops'],
  [/spray|a[ée]rosol/i,                'spray'],
  [/inhalat|inhaler/i,                 'inhaler'],
  [/cr[eè]me?|cream/i,                 'cream'],
  [/pommade|ointment/i,                'ointment'],
  [/\bgel\b/i,                         'gel'],
  [/patch|timbre/i,                    'patch'],
  [/suppositoire|suppository/i,        'suppository'],
  [/poudre|powder/i,                   'powder'],
  [/pastille|lozenge/i,                'lozenge'],
  [/granul[ée]/i,                      'granules'],
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
 * Full pipeline: capture → OCR → parse.
 * Throws OcrNotSupportedError or OcrNoTextError on hard failures.
 * Never throws on parse/API failure — falls back to regex instead.
 */
export async function scanBoxAndParse(file: File): Promise<OcrScanResult> {
  const rawText = await extractTextFromFile(file);

  try {
    return await parseWithApi(rawText);
  } catch {
    // No network or API error — use on-device regex heuristics
    return parseWithFallback(rawText);
  }
}
