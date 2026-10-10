const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' } as const

export const MenuIcon = () => (
  <svg {...base}>
    <path d="M4 6.5h16M4 12h16M4 17.5h16" />
  </svg>
)

export const SearchIcon = () => (
  <svg {...base}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5 5" />
  </svg>
)

export const BackIcon = () => (
  <svg {...base}>
    <path d="M20 12H5m6-6.5L4.5 12l6.5 6.5" />
  </svg>
)

export const CloseIcon = () => (
  <svg {...base}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

export const DownIcon = () => (
  <svg {...base}>
    <path d="m6 9.5 6 6 6-6" />
  </svg>
)

export const MoonIcon = () => (
  <svg {...base}>
    <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />
  </svg>
)

export const WindowIcon = () => (
  <svg {...base}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <path d="M3.5 9h17" />
  </svg>
)

export const CodeIcon = () => (
  <svg {...base}>
    <path d="m8.5 7-5 5 5 5m7-10 5 5-5 5" />
  </svg>
)

export const IssueIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5.5m0 3.2v.1" />
  </svg>
)
