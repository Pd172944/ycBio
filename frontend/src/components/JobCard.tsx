import type { Job } from '../types'
import { StatusBadge } from './StatusBadge'

interface JobCardProps {
  job: Job
  isSelected: boolean
  onClick: () => void
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncateSequence(seq: string, maxLen = 40): string {
  const clean = seq.replace(/^>.*\n?/, '').replace(/\s/g, '')
  if (clean.length <= maxLen) return clean
  return clean.slice(0, maxLen) + '...'
}

export function JobCard({ job, isSelected, onClick }: JobCardProps) {
  const isTerminal = job.status === 'complete' || job.status === 'failed'
  const confidence = job.moe_report?.overall_confidence

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer
        ${
          isSelected
            ? 'bg-bg-elevated border-accent-blue/40 glow-blue'
            : 'bg-bg-card border-border-subtle hover:border-border-default hover:bg-bg-elevated'
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Job ID */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs text-text-muted truncate max-w-[200px]">
              {job.job_id}
            </span>
            {!isTerminal && (
              <span className="text-xs text-text-muted animate-pulse-slow">polling</span>
            )}
          </div>

          {/* Sequence preview */}
          <p className="font-mono text-sm text-text-secondary truncate">
            {truncateSequence(job.sequence_input.sequence)}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-text-muted bg-bg-secondary px-2 py-0.5 rounded font-mono">
              {job.sequence_input.format.toUpperCase()}
            </span>
            <span className="text-xs text-text-muted">
              {formatDate(job.submitted_at)} · {formatTime(job.submitted_at)}
            </span>
          </div>

          {/* Confidence preview if available */}
          {confidence !== undefined && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1 bg-bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    confidence >= 0.8
                      ? 'bg-emerald-500'
                      : confidence >= 0.6
                      ? 'bg-blue-500'
                      : confidence >= 0.4
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span className="text-xs font-mono text-text-muted whitespace-nowrap">
                {(confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="flex-shrink-0">
          <StatusBadge status={job.status} />
        </div>
      </div>

      {/* Error preview */}
      {job.error && (
        <div className="mt-3 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 truncate">
          {job.error}
        </div>
      )}
    </button>
  )
}
