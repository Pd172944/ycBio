import type { JobStatus } from '../types'

interface StatusBadgeProps {
  status: JobStatus
  pulse?: boolean
}

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  pending: {
    label: 'Pending',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    dot: 'bg-amber-400',
  },
  validating: {
    label: 'Validating',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    dot: 'bg-blue-400',
  },
  auditing: {
    label: 'Auditing',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    dot: 'bg-purple-400',
  },
  running: {
    label: 'Running',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    dot: 'bg-blue-400',
  },
  analyzing: {
    label: 'Analyzing',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    dot: 'bg-violet-400',
  },
  complete: {
    label: 'Complete',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    dot: 'bg-emerald-400',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    dot: 'bg-red-400',
  },
}

const ACTIVE_STATUSES: JobStatus[] = ['pending', 'validating', 'auditing', 'running', 'analyzing']

export function StatusBadge({ status, pulse = true }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const isActive = ACTIVE_STATUSES.includes(status)

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                  ${config.color} ${config.bg}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${config.dot} ${
          isActive && pulse ? 'dot-pulse' : ''
        }`}
      />
      {config.label}
    </span>
  )
}
