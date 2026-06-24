import type { CSSProperties, ReactNode } from 'react'

// Lucide-style icon set ported from design-v2/project/product-shell.jsx (1.6px stroke,
// currentColor). Grounded in the designer's icon library; extend as screens need.
const ICONS = {
  inbox: (
    <path d="M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3 7v6a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-6l3-7z" />
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  receipt: <path d="M6 2v20l3-2 3 2 3-2 3 2V2H6zM10 7h8M10 11h8M10 15h5" />,
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </>
  ),
  coins: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82" />
    </>
  ),
  star: <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7l3-7z" />,
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M5 12v9h14v-9M12 8s-3-4-6-2 2 4 6 2zM12 8s3-4 6-2-2 4-6 2z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
      <circle cx="17" cy="6.5" r="2.8" />
      <path d="M16 14h2a4 4 0 0 1 4 4v2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .35 1.86l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.86-.35 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.86.35l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .35-1.86 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.35-1.86l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.86.35H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.86-.35l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.35 1.86V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </>
  ),
  home: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V9z" />,
  kanban: (
    <>
      <rect x="3" y="3" width="6" height="14" rx="1" />
      <rect x="11" y="3" width="6" height="10" rx="1" />
      <rect x="19" y="3" width="2" height="6" rx="0.5" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="1" />
      <path d="M9 8h.01M9 12h.01M9 16h.01M15 8h.01M15 12h.01M15 16h.01" />
    </>
  ),
  truck: (
    <path d="M14 18V6h-9v12h9zM14 8h4l3 4v6h-7M5 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
  ),
  edit: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  bell: <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9zM13.7 21a2 2 0 0 1-3.4 0" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12l5 5L20 7" />,
  alert: (
    <>
      <path d="M12 2L2 22h20L12 2zM12 9v5" />
      <circle cx="12" cy="18" r="0.5" fill="currentColor" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </>
  ),
  chevron: <path d="M6 9l6 6 6-6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof ICONS

export interface IconProps {
  name: IconName
  /** Pixel size (width = height). @default 16 */
  size?: number
  className?: string
  style?: CSSProperties
}

/** Renders a design-system icon by name (inherits `currentColor`). */
export function Icon({ name, size = 16, className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}
