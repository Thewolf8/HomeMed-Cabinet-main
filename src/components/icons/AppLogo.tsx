import type { ImgHTMLAttributes } from 'react';
import iconSrc from '@/assets/icon.png';

/**
 * The HomeMed Cabinet app logo. Uses the same source image as the native
 * Android app icon (see /assets/icon.png — the master file Capacitor's icon
 * generation reads), so every place the app's own branding appears in the
 * UI (header, Settings "About" card, onboarding welcome screen) matches the
 * home-screen icon exactly, with no separate hand-drawn approximation to
 * keep in sync.
 *
 * Drop-in compatible with how this component was used before: pass a
 * `className` with a size utility (`w-4 h-4`) to control the rendered size.
 */
export default function AppLogo({
  className,
  alt = '',
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return <img src={iconSrc} alt={alt} className={className} {...props} />;
}
