import type { SVGProps } from 'react';

/**
 * The HomeMed Cabinet app logo — a broken/split capsule. Used everywhere
 * the app's own icon/branding appears in the UI (header, Settings "About"
 * card, onboarding welcome screen) so all three stay visually consistent.
 *
 * Drop-in compatible with how lucide-react icons are used elsewhere in the
 * app: pass a `className` with a size utility (`w-4 h-4`) and a text-color
 * utility (`text-primary`) — the stroke uses `currentColor`, so it inherits
 * color exactly the same way.
 */
export default function AppLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g transform="translate(200,200) rotate(-45)">
        {/* Outer capsule outline — continuous, unbroken */}
        <rect
          x="-150"
          y="-70"
          width="300"
          height="140"
          rx="70"
          ry="70"
          stroke="currentColor"
          strokeWidth="24"
          strokeLinejoin="round"
        />
        {/* Jagged seam crossing the middle — gives the "split capsule" impression */}
        <polyline
          points="-40,-70 -15,-35 -42,-5 -10,28 -35,55 0,70"
          stroke="currentColor"
          strokeWidth="24"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
