interface IconProps {
  className?: string;
}

const base = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const StarIcon = ({ className }: IconProps) => (
  <svg {...base} className={className} width="1em" height="1em" aria-hidden>
    <path d="M8 1.8 9.9 5.9l4.3.5-3.2 3 .9 4.4L8 11.6 4.1 13.8l.9-4.4-3.2-3 4.3-.5Z" />
  </svg>
);

export const ForkIcon = ({ className }: IconProps) => (
  <svg {...base} className={className} width="1em" height="1em" aria-hidden>
    <circle cx="4" cy="3" r="1.6" />
    <circle cx="12" cy="3" r="1.6" />
    <circle cx="8" cy="13" r="1.6" />
    <path d="M4 4.6v1.6a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V4.6M8 8.2v3.2" />
  </svg>
);

export const IssueIcon = ({ className }: IconProps) => (
  <svg {...base} className={className} width="1em" height="1em" aria-hidden>
    <circle cx="8" cy="8" r="5.6" />
    <circle cx="8" cy="8" r="1.6" />
  </svg>
);

export const ArrowIcon = ({ className }: IconProps) => (
  <svg {...base} className={className} width="1em" height="1em" aria-hidden>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

export const ExternalIcon = ({ className }: IconProps) => (
  <svg {...base} className={className} width="1em" height="1em" aria-hidden>
    <path d="M6.5 3H3v10h10V9.5M9.5 3H13v3.5M13 3 7.5 8.5" />
  </svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg {...base} className={className} width="1em" height="1em" aria-hidden>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export const OrbitIcon = ({ className }: IconProps) => (
  <svg {...base} className={className} width="1em" height="1em" aria-hidden>
    <circle cx="8" cy="8" r="2.2" />
    <ellipse cx="8" cy="8" rx="6.4" ry="2.9" transform="rotate(-22 8 8)" />
  </svg>
);

export const FlightIcon = ({ className }: IconProps) => (
  <svg {...base} className={className} width="1em" height="1em" aria-hidden>
    <path d="M8 1.6 13.4 13 8 10.4 2.6 13Z" />
  </svg>
);

export const SettingsIcon = ({ className }: IconProps) => (
  <svg {...base} className={className} width="1em" height="1em" aria-hidden>
    <circle cx="8" cy="8" r="2.1" />
    <path d="M8 1.6v1.7M8 12.7v1.7M14.4 8h-1.7M3.3 8H1.6M12.5 3.5l-1.2 1.2M4.7 11.3l-1.2 1.2M12.5 12.5l-1.2-1.2M4.7 4.7 3.5 3.5" />
  </svg>
);

export const KeyIcon = ({ className }: IconProps) => (
  <svg {...base} className={className} width="1em" height="1em" aria-hidden>
    <circle cx="5" cy="8" r="2.6" />
    <path d="M7.6 8H14M11.8 8v2.2M13.4 8v1.6" />
  </svg>
);

export const CompassIcon = ({ className }: IconProps) => (
  <svg {...base} className={className} width="1em" height="1em" aria-hidden>
    <circle cx="8" cy="8" r="6.2" />
    <path d="m10.4 5.6-1.2 3.6-3.6 1.2 1.2-3.6Z" />
  </svg>
);

export const XIcon = ({ className }: IconProps) => (
  <svg className={className} width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

