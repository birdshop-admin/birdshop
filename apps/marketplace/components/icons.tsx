const props = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  "aria-hidden": true as const,
};
export function SearchIcon() {
  return (
    <svg {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </svg>
  );
}
export function ArrowIcon() {
  return (
    <svg {...props}>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}
export function ShieldIcon() {
  return (
    <svg {...props}>
      <path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Z" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}
export function GridIcon() {
  return (
    <svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
