import { Capacitor } from '@capacitor/core';
import {
  BarcodeScanner,
  BarcodeFormat,
  GoogleBarcodeScannerModuleInstallState,
} from '@capacitor-mlkit/barcode-scanning';
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

let moduleReadyChecked = false;

/**
 * On Android, scan() depends on the "Google Barcode Scanner" module, which
 * ships separately from the app via Google Play Services. It's already
 * installed on the vast majority of Android phones (Play Services installs
 * it lazily for other apps too), but if it's genuinely missing this triggers
 * a small one-time install. That install needs Google Play Services and a
 * network connection; everything *after* that happens fully on-device.
 */
async function ensureGoogleScannerModuleReady(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android' || moduleReadyChecked) return;

  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (available) {
    moduleReadyChecked = true;
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      void listenerPromise.then((handle) => handle.remove());
      if (err) reject(err);
      else resolve();
    };

    const listenerPromise = BarcodeScanner.addListener(
      'googleBarcodeScannerModuleInstallProgress',
      (event) => {
        if (event.state === GoogleBarcodeScannerModuleInstallState.COMPLETED) {
          finish();
        } else if (
          event.state === GoogleBarcodeScannerModuleInstallState.FAILED ||
          event.state === GoogleBarcodeScannerModuleInstallState.CANCELED
        ) {
          finish(new Error('Failed to install the barcode scanner module.'));
        }
      }
    );

    BarcodeScanner.installGoogleBarcodeScannerModule().catch(finish);
  });

  moduleReadyChecked = true;
}

/**
 * Opens Google's ready-to-use barcode scanner screen and returns a single
 * decoded value, or null if the user cancelled.
 *
 * This uses BarcodeScanner.scan() — Google's own first-party full-screen
 * scanner UI — rather than building a custom camera preview inside the
 * WebView. The previous approach (startScan(), with the WebView made
 * transparent so the native camera showed through) is known to be unreliable
 * across devices (the plugin's own issue tracker documents black screens and
 * native crashes from it), and scan() is what Google actively recommends.
 *
 * Trade-off: the on-device barcode model used by scan() ships as part of
 * Google Play Services rather than inside the app itself. It's already
 * present on the large majority of Android phones, and once available it
 * works fully offline — but if a specific device doesn't have it yet, the
 * very first scan attempt needs internet access for a small one-time
 * download (handled automatically below).
 */
export async function scanBarcodeOnce(): Promise<string | null> {
  if (!isNative) {
    throw new BarcodeNotSupportedError('Barcode scanning is only available on the installed app.');
  }

  const { supported } = await BarcodeScanner.isSupported();
  if (!supported) {
    throw new BarcodeNotSupportedError('This device does not support barcode scanning.');
  }

  try {
    await ensureGoogleScannerModuleReady();
  } catch (err) {
    throw new BarcodeNotSupportedError('Could not prepare the barcode scanner module.');
  }

  try {
    const { barcodes } = await BarcodeScanner.scan({ formats: SCAN_FORMATS });
    const first = barcodes?.[0];
    // rawValue is only populated for UTF-8 encoded barcodes; displayValue is
    // ML Kit's human-readable fallback and is virtually always present.
    return first?.rawValue || first?.displayValue || null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The user backing out of Google's scanner screen surfaces as a rejected
    // promise rather than an empty result — treat that as a cancellation,
    // not an error.
    if (/cancel/i.test(message)) return null;
    if (/permission/i.test(message)) throw new BarcodePermissionDeniedError(message);
    throw err;
  }
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
