import type { SVGProps } from "react";

export default function AppLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="16 16 480 480"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Rounded rectangle */}
      <rect
        x="136"
        y="96"
        width="240"
        height="320"
        rx="42"
        stroke="currentColor"
        strokeWidth="22"
      />

      {/* Plus */}
      <g
        stroke="#1E6BFF"
        strokeWidth="28"
        strokeLinecap="round"
      >
        <path d="M256 180V332" />
        <path d="M180 256H332" />
      </g>
    </svg>
  );
}
