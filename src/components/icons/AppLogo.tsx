import type { ImgHTMLAttributes } from 'react';
import iconSrc from '@/assets/icon.png';

/**
 * The HomeMed Cabinet app logo — the same icon.png used for the native
 * Android app icon, rendered as-is (no crop or zoom). The source image
 * already fills its own 1024x1024 canvas edge-to-edge (only its natural
 * rounded corners are transparent), so it should always be sized to match
 * — not centered inside — whatever decorative box it's placed in. If a
 * call site still wraps it in its own colored/rounded container, remove
 * that wrapper and size AppLogo directly instead.
 */
export default function AppLogo({
  className,
  alt = '',
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return <img src={iconSrc} alt={alt} className={className} {...props} />;
}
