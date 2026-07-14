import type { SVGProps } from "react";

export default function AppLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="100 140 312 232"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g
        transform="translate(256 256) rotate(-45) translate(-256 -256)"
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Capsule */}
        <path d="M136 166H376A90 90 0 0 1 376 346H136A90 90 0 0 1 136 166Z" />

        {/* Divider */}
        <path d="M256 166V346" />
      </g>
    </svg>
  );
}
