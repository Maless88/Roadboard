interface LogoProps {
  size?: number;
  className?: string;
}

/** Roadboard mark: ascending bars (kanban/board metaphor) on the app's indigo gradient. */
export function Logo({ size = 28, className }: LogoProps) {

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="#6366f1" />
      <rect width="32" height="32" rx="7" fill="url(#roadboard-logo-gradient)" />
      <rect x="8" y="14" width="4" height="10" rx="2" fill="white" />
      <rect x="14" y="8" width="4" height="16" rx="2" fill="white" />
      <rect x="20" y="11" width="4" height="13" rx="2" fill="white" />
      <defs>
        <linearGradient id="roadboard-logo-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#818cf8" />
        </linearGradient>
      </defs>
    </svg>
  );
}
