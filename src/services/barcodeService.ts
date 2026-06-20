import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { getMedications } from './medicationService';
import type { Medication } from '@/types/medication';

const isNative = Capacitor.isNativePlatform();

// All formats that pharmacy / medicine packaging commonly uses:
// linear barcodes (Code128, EAN-13, etc.) plus the square Data Matrix / QR
// codes increasingly used on medicine boxes.
const SCAN_FORMATS = [
  BarcodeFormat.QrCode,
  BarcodeFormat.DataMatrix,
  BarcodeFormat.Code128,
  BarcodeFormat.Code39,
  BarcodeFormat.Code93,
  BarcodeFormat.Codabar,
  BarcodeFormat.Ean13,
  BarcodeFormat.Ean8,
  BarcodeFormat.Itf,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
  BarcodeFormat.Pdf417,
  BarcodeFormat.Aztec,
];

export class BarcodeNotSupportedError extends Error {}
export class BarcodePermissionDeniedError extends Error {}

// Lets cancelBarcodeScan() (called from a "Cancel" button rendered on top of
// the camera) resolve the *same* promise that scanBarcodeOnce() returned,
// instead of stopping the native scan independently and leaving the caller
// awaiting forever.
let activeCancel: (() => void) | null = null;

/**
 * Opens the device camera and scans for a single barcode / Data Matrix /
 * QR code, fully on-device (the ML Kit barcode model ships inside the app,
 * so no network connection or Google Play Services download is needed).
 *
 * Resolves with the decoded value, or null if the user cancelled.
 */
export async function scanBarcodeOnce(): Promise<string | null> {
  if (!isNative) {
    throw new BarcodeNotSupportedError('Barcode scanning is only available on the installed app.');
  }

  const { supported } = await BarcodeScanner.isSupported();
  if (!supported) {
    throw new BarcodeNotSupportedError('This device does not support barcode scanning.');
  }

  const permission = await BarcodeScanner.checkPermissions();
  if (permission.camera !== 'granted' && permission.camera !== 'limited') {
    const requested = await BarcodeScanner.requestPermissions();
    if (requested.camera !== 'granted' && requested.camera !== 'limited') {
      throw new BarcodePermissionDeniedError('Camera permission was denied.');
    }
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = async () => {
      try {
        await BarcodeScanner.removeAllListeners();
        await BarcodeScanner.stopScan();
        await BarcodeScanner.showBackground();
      } catch {
        // ignore — scanner may already be stopped
      }
      document.body.classList.remove('barcode-scanner-active');
      activeCancel = null;
    };

    const finish = async (value: string | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      await cleanup();
      if (error) reject(error);
      else resolve(value);
    };

    activeCancel = () => finish(null);

    (async () => {
      try {
        // The native camera preview renders *behind* the WebView, so the
        // WebView itself must be made visually transparent for the user to
        // see it — both the CSS class (App.css) and this plugin call are
        // required.
        document.body.classList.add('barcode-scanner-active');
        await BarcodeScanner.hideBackground();

        const listener = await BarcodeScanner.addListener('barcodeScanned', async (event) => {
          await listener.remove();
          finish(event.barcode?.rawValue ?? null);
        });

        await BarcodeScanner.startScan({ formats: SCAN_FORMATS });
      } catch (err) {
        finish(null, err);
      }
    })();
  });
}

/**
 * Cancels an in-progress scan started by scanBarcodeOnce() — call this from
 * the "Cancel" button the page renders on top of the camera preview. Safe to
 * call even if no scan is active.
 */
export function cancelBarcodeScan(): void {
  activeCancel?.();
}

/**
 * Offline "first scan teaches the app" lookup: searches existing medications
 * for one previously linked to this barcode, so the rest of the form can be
 * auto-filled on subsequent scans without needing any server/internet.
 */
export function findMedicationByBarcode(barcode: string): Medication | undefined {
  if (!barcode) return undefined;
  const meds = getMedications();
  // Prefer the most recently updated match if the same barcode was linked more than once.
  return meds
    .filter((m) => m.barcode === barcode)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}
