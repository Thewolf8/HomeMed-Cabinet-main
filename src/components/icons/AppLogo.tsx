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
        transform="rotate(-45 256 256)"
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Capsule */}
        <path d="
          M 156 186
          H 356
          A 70 70 0 0 1 356 326
          H 156
          A 70 70 0 0 1 156 186
          Z
        " />

        {/* Split */}
        <path d="
          M 235 186
          C 245 202 245 215 252 224
          C 259 233 272 235 282 238
          C 293 241 300 251 305 266
          C 309 278 319 290 332 302
        " />
      </g>
    </svg>
  );
}
