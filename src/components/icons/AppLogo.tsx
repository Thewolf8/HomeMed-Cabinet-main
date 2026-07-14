import type { SVGProps } from "react";

export default function AppLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 512 512"
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
        <path d="M156 186H356A70 70 0 0 1 356 326H156A70 70 0 0 1 156 186Z" />

        {/* Divider */}
        <path d="M256 186V326" />
      </g>
    </svg>
  );
}
