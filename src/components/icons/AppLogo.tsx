import type { ImgHTMLAttributes } from 'react';
import iconSrc from '@/assets/icon.png';

/**
 * If icon.png has visible padding around the glyph (common with generated
 * icons, since OS icon systems usually expect a safe-zone margin), this
 * zooms in to crop that padding out visually, so the icon fills its box
 * inside the app UI the same way it fills the home-screen icon slot.
 *
 * 1   = no zoom, use the exported image exactly as-is.
 * 1.4 = current default — a reasonable starting guess.
 *
 * Tune this yourself: bump it up (1.5, 1.8...) if the icon still looks
 * too small/padded, or back down toward 1 if it now looks too zoomed-in
 * or cuts off part of the design. Rebuild after each change — a few
 * tries and you'll have the exact number for your specific file.
 */
const ZOOM = 1.4;

export default function AppLogo({
  className,
  alt = '',
  style,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <span
      className={className}
      style={{ display: 'inline-block', overflow: 'hidden', ...style }}
    >
      <img
        src={iconSrc}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${ZOOM})` }}
        {...props}
      />
    </span>
  );
}
