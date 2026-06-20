import type { Medication } from '@/types/medication';

/**
 * The .homemed file format
 * ------------------------
 * A small text container with a magic header, so the app (and only the app)
 * recognizes the file, followed by the inventory data gzip-compressed and
 * base64-encoded. Everything happens locally on the device — no server or
 * network call is involved in producing or reading this file.
 *
 * Layout: "HOMEDV1:GZ:<base64 gzip data>"  (falls back to "HOMEDV1:RAW:<base64 json>"
 * on the rare browser/WebView that lacks the Compression Streams API).
 */

const MAGIC = 'HOMEDV1';

export interface HomeMedPayload {
  app: 'HomeMed Cabinet';
  formatVersion: 1;
  exportDate: string;
  medications: Medication[];
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function supportsCompressionStream(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

/** Builds the .homemed file content (a plain string, ready to write to disk). */
export async function encodeHomeMedFile(medications: Medication[]): Promise<string> {
  const payload: HomeMedPayload = {
    app: 'HomeMed Cabinet',
    formatVersion: 1,
    exportDate: new Date().toISOString(),
    medications,
  };
  const json = JSON.stringify(payload);

  if (supportsCompressionStream()) {
    const compressedStream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
    const buffer = await new Response(compressedStream).arrayBuffer();
    return `${MAGIC}:GZ:${arrayBufferToBase64(buffer)}`;
  }

  // Fallback for environments without the Compression Streams API.
  return `${MAGIC}:RAW:${btoa(unescape(encodeURIComponent(json)))}`;
}

/** Parses a .homemed file's content back into a payload. Throws if the file is invalid/unsupported. */
export async function decodeHomeMedFile(content: string): Promise<HomeMedPayload> {
  const trimmed = content.trim();
  if (!trimmed.startsWith(`${MAGIC}:`)) {
    throw new Error('Not a valid .homemed file');
  }

  const rest = trimmed.slice(MAGIC.length + 1);
  const separatorIndex = rest.indexOf(':');
  if (separatorIndex === -1) throw new Error('Corrupted .homemed file');

  const tag = rest.slice(0, separatorIndex);
  const base64 = rest.slice(separatorIndex + 1);

  let json: string;
  if (tag === 'GZ') {
    if (!supportsCompressionStream()) {
      throw new Error('This device cannot decompress .homemed files');
    }
    const buffer = base64ToArrayBuffer(base64);
    const decompressedStream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    json = await new Response(decompressedStream).text();
  } else if (tag === 'RAW') {
    json = decodeURIComponent(escape(atob(base64)));
  } else {
    throw new Error('Unsupported .homemed file version');
  }

  const parsed = JSON.parse(json);
  if (!parsed || parsed.app !== 'HomeMed Cabinet' || !Array.isArray(parsed.medications)) {
    throw new Error('Corrupted or unrecognized .homemed file');
  }
  return parsed as HomeMedPayload;
}
