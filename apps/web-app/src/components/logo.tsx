interface LogoProps {
  size?: number;
  className?: string;
}

/** Roadboard mark: winding road with checkpoint nodes, on a deep navy-violet tile. */
export function Logo({ size = 28, className }: LogoProps) {

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="url(#roadboard-logo-gradient)" />
      <path
        d="M 9 27 C 7 19 23 17 16 9 C 13.5 6.2 17.5 4.5 18.5 3"
        fill="none"
        stroke="#2dd4bf"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="18.5" cy="3" r="3" fill="#f59e0b" />
      <circle cx="9" cy="27" r="2.6" fill="#a78bfa" />
      <defs>
        <linearGradient id="roadboard-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#171335" />
          <stop offset="1" stopColor="#241a4a" />
        </linearGradient>
      </defs>
    </svg>
  );
}
