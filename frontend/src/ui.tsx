import type { ReactNode } from 'react'
import type { Order } from './api/client'
import styles from './app.module.css'

const paths = {
  brand: (
    <>
      <path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M19 3c-2.2 1-4 3.7-4 7v3h4m0-10v18" />
    </>
  ),
  menu: (
    <>
      <path d="M3 5h18M3 12h18M3 19h18M8 3v4m8 3v4M7 17v4" />
    </>
  ),
  orders: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 9h6m-6 4h6m-6 4h4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </>
  ),
  bag: (
    <>
      <path d="M5 7h14l2 14H3L5 7zM9 9V6a3 3 0 1 1 6 0v3" />
    </>
  ),
  logout: (
    <>
      <path d="M11 5H5v14h6m4-11 4 4-4 4m4-4H9" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="5.5" />
      <path d="m14 14 5 5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  back: <path d="M19 12H5m6-6-6 6 6 6" />,
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3v4m8-4v4" />
    </>
  ),
  main: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M3 4v5m18-5v5" />
    </>
  ),
  soup: (
    <>
      <path d="M3 12h18c0 5-4 8-9 8s-9-3-9-8Zm4-4c-2-2 2-2 0-5m5 5c-2-2 2-2 0-5m5 5c-2-2 2-2 0-5" />
    </>
  ),
  salad: (
    <>
      <path d="M12 21c0-7 4-10 8-15-7-1-14 2-15 8-1 4 2 6 7 7Zm0 0c-1-4-3-7-6-8" />
    </>
  ),
  check: <path d="m5 12 4 4 10-10" />,
  location: (
    <>
      <path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
}

export function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

export function Loading({ children = 'Wczytywanie…' }: { children?: ReactNode }) {
  return (
    <div className={styles.loading} role="status">
      <span className={styles.spinner} />
      {children}
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className={styles.error} role="alert">
      <span>{error instanceof Error ? error.message : 'Nie udało się wykonać operacji.'}</span>
      {onRetry && (
        <button type="button" className={styles.textButton} onClick={onRetry}>
          Ponów
        </button>
      )}
    </div>
  )
}

export function StatusBadge({ status }: { status: Order['status'] }) {
  const labels: Record<Order['status'], string> = { submitted: 'Oczekuje na magazyn' }
  return (
    <span className={styles.status}>
      <span />
      {labels[status]}
    </span>
  )
}
