import React from "react"

// Replaces the placeholder hazard-triangle logo.png, which reads as a
// warning/caution icon -- the wrong association for a trust-first GRC
// product. A shield (governance/protection) with a checkmark (verified
// compliance) drawn in currentColor so it inherits the surrounding text
// color and stays theme-correct without a raster asset.
const Logo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <path
      d="M20 3.5L33.5 9V18.5C33.5 27.4 27.9 34.6 20 37C12.1 34.6 6.5 27.4 6.5 18.5V9L20 3.5Z"
      fill="currentColor"
      fillOpacity="0.12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M13.5 19.5L18 24L27 14.5"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default Logo
