import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

// Cache directory works reliably across all Android versions for sharing
// Documents directory may have permission issues on Android 10
const SHARE_DIR = Directory.Cache;
const SAVE_DIR = Directory.Documents;

/**
 * Convert a base64 string to a Blob
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteArrays: Uint8Array[] = [];
  
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  
  return new Blob(byteArrays as any, { type: mimeType });
}

/**
 * Download a file on web by creating a blob URL and triggering download
 */
function downloadOnWeb(content: string | Blob, filename: string, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Write file to Cache directory and share it (works on Android 10+)
 */
async function writeAndShare(
  content: string,
  filename: string,
  mimeType: string,
  isBinary: boolean = false
): Promise<void> {
  // Write to cache (no external storage permissions needed)
  await Filesystem.writeFile({
    path: filename,
    data: content,
    directory: SHARE_DIR,
    encoding: isBinary ? undefined : Encoding.UTF8,
    recursive: true,
  });

  // Get URI
  const fileUri = await Filesystem.getUri({
    path: filename,
    directory: SHARE_DIR,
  });

  // Share — this opens the system share sheet on all Android versions
  await Share.share({
    title: filename,
    url: fileUri.uri,
    dialogTitle: 'Share Export',
  });
}

/**
 * Save file to device and share it
 */
export async function saveAndShareFile(
  content: string,
  filename: string,
  mimeType: string
): Promise<void> {
  if (isNative) {
    try {
      await writeAndShare(content, filename, mimeType, false);
    } catch (error) {
      console.error('Native share error:', error);
      // Fallback to web download
      downloadOnWeb(content, filename, mimeType);
    }
  } else {
    // Web fallback
    downloadOnWeb(content, filename, mimeType);
  }
}

/**
 * Save PDF file specifically (handles base64 PDF content)
 */
export async function savePDFFile(pdfBase64: string, filename: string): Promise<void> {
  if (isNative) {
    try {
      await writeAndShare(pdfBase64, filename, 'application/pdf', true);
    } catch (error) {
      console.error('Native PDF share error:', error);
      // Fallback: convert base64 to blob and download
      const blob = base64ToBlob(pdfBase64, 'application/pdf');
      downloadOnWeb(blob, filename, 'application/pdf');
    }
  } else {
    const blob = base64ToBlob(pdfBase64, 'application/pdf');
    downloadOnWeb(blob, filename, 'application/pdf');
  }
}

/**
 * Read a file from the device
 */
export async function readFile(path: string): Promise<string> {
  if (isNative) {
    const result = await Filesystem.readFile({
      path,
      directory: SAVE_DIR,
      encoding: Encoding.UTF8,
    });
    return result.data as string;
  }
  throw new Error('File reading only supported on native platforms');
}

/**
 * Read file from input element (for web import)
 */
export function readFileFromInput(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * Save file directly to device storage under Documents/homemed-backups/
 * Returns the save path for display in a toast
 */
export async function downloadFile(
  content: string,
  filename: string,
  isBinary: boolean = false
): Promise<string> {
  if (!isNative) {
    downloadOnWeb(content, filename, 'application/octet-stream');
    return filename;
  }

  const path = `homemed-backups/${filename}`;

  try {
    const perm = await Filesystem.checkPermissions();
    if (perm.publicStorage !== 'granted') {
      await Filesystem.requestPermissions();
    }
  } catch {
    // Newer Android versions handle permissions differently; continue anyway
  }

  await Filesystem.writeFile({
    path,
    data: content,
    directory: Directory.Documents,
    encoding: isBinary ? undefined : Encoding.UTF8,
    recursive: true,
  });

  return `Documents/${path}`;
}

// ==================== Fixed-filename weekly auto-backup ====================
// A single, always-overwritten file (rather than the timestamped exports
// above) so the backup doesn't pile up files in the user's Documents folder.

const AUTO_BACKUP_PATH = 'homemed-backups/HM-backup.json';

/** Writes (overwrites) the single auto-backup file with the given JSON content. */
export async function writeAutoBackup(content: string): Promise<void> {
  if (!isNative) return; // No meaningful "fixed file on disk" concept on web.
  await Filesystem.writeFile({
    path: AUTO_BACKUP_PATH,
    data: content,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
}

/** Reads the auto-backup file's content, or null if it doesn't exist / can't be read. */
export async function readAutoBackup(): Promise<string | null> {
  if (!isNative) return null;
  try {
    const result = await Filesystem.readFile({
      path: AUTO_BACKUP_PATH,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return result.data as string;
  } catch {
    return null;
  }
}

/** Returns the auto-backup file's last-modified time (ms since epoch), or null if it doesn't exist. */
export async function getAutoBackupModifiedTime(): Promise<number | null> {
  if (!isNative) return null;
  try {
    const stat = await Filesystem.stat({
      path: AUTO_BACKUP_PATH,
      directory: Directory.Documents,
    });
    return stat.mtime ?? null;
  } catch {
    return null;
  }
}
