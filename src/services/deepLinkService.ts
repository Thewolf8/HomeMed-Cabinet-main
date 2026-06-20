import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Encoding } from '@capacitor/filesystem';
import { decodeHomeMedFile, type HomeMedPayload } from './homemedFormat';

const isNative = Capacitor.isNativePlatform();

/**
 * Reads the content of a file the OS handed us a URI for (content:// on
 * Android, file:// elsewhere). No `directory` is passed so the Filesystem
 * plugin resolves the URI as-is.
 */
async function readUrlContent(url: string): Promise<string> {
  const result = await Filesystem.readFile({ path: url, encoding: Encoding.UTF8 });
  return result.data as string;
}

function looksLikeHomeMedFile(url: string): boolean {
  return url.toLowerCase().includes('.homemed');
}

/**
 * Tries to load a .homemed file from a URL the app was opened/resumed with.
 *
 * Note: this always attempts to read + decode the URL, rather than only
 * doing so when the URL string ends in ".homemed". Many apps (WhatsApp
 * included) hand off content:// URIs whose path is an opaque database id
 * that never shows the real filename, so the magic header written by
 * encodeHomeMedFile() — not the URL text — is what actually decides whether
 * this is a valid .homemed file. `looksLikeHomeMedFile` is only used to
 * decide whether a decode failure is worth bothering the user about.
 */
async function tryLoadHomeMedFromUrl(
  url: string,
  onError?: (err: unknown) => void
): Promise<HomeMedPayload | null> {
  if (!url) return null;
  try {
    const content = await readUrlContent(url);
    return await decodeHomeMedFile(content);
  } catch (err) {
    console.error('Failed to read .homemed file from', url, err);
    // Only surface an error to the user if the filename strongly suggested
    // this *was* meant to be a .homemed file.
    if (looksLikeHomeMedFile(url)) onError?.(err);
    return null;
  }
}

/**
 * Registers the listener that catches `.homemed` files opened from outside
 * the app (tapped in a file manager, opened from a WhatsApp chat, etc.) and
 * also checks the URL the app was cold-launched with. Returns an unsubscribe
 * function.
 */
export function registerHomeMedFileListener(
  onFileOpened: (payload: HomeMedPayload) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!isNative) return () => {};

  let cancelled = false;

  // Cold start: the app may have just been launched by tapping a .homemed file.
  void App.getLaunchUrl().then(async (result) => {
    if (cancelled || !result?.url) return;
    const payload = await tryLoadHomeMedFromUrl(result.url, onError);
    if (payload && !cancelled) onFileOpened(payload);
  });

  // Warm start: the app was already running/suspended and got reopened via the file.
  const listenerPromise = App.addListener('appUrlOpen', async (data) => {
    const payload = await tryLoadHomeMedFromUrl(data.url, onError);
    if (payload) onFileOpened(payload);
  });

  return () => {
    cancelled = true;
    void listenerPromise.then((handle) => handle.remove());
  };
}
