import type { Job } from '../types'
import { StatusBadge } from './StatusBadge'
import { MoEReport } from './MoEReport'
import { RawOutputPanel } from './RawOutputPanel'
import { MoleculeViewer } from './MoleculeViewer'

interface JobDetailProps {
  job: Job
  onClose: () => void
}

const STATUS_STEPS = [
  'pending',
  'validating',
  'auditing',
  'running',
  'analyzing',
  'complete',
] as const

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number])
  return idx === -1 ? (status === 'failed' ? -1 : 0) : idx
}

function ProgressStepper({ status }: { status: string }) {
  const currentIdx = getStepIndex(status)
  const isFailed = status === 'failed'

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STATUS_STEPS.map((step, i) => {
        const isPast = currentIdx > i
        const isCurrent = currentIdx === i && !isFailed
        const isFuture = currentIdx < i

        return (
          <div key={step} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all
                ${isFailed && step === 'complete'
                  ? 'bg-red-500/10 text-red-400'
                  : isPast
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : isCurrent
                      ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/30'
                      : 'bg-bg-secondary text-text-muted'
                }`}
            >
              {isPast && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 dot-pulse" />}
              {isFuture && <span className="w-1.5 h-1.5 rounded-full bg-border-strong" />}
              <span className="capitalize">{step}</span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div
                className={`w-4 h-px ${isPast ? 'bg-emerald-500/40' : 'bg-border-subtle'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
      <span className="text-sm font-mono text-text-secondary">{value}</span>
    </div>
  )
}

function ActiveSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-border-subtle" />
        <div
          className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-accent-blue"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>
      <div className="text-center">
        <p className="text-text-secondary text-sm font-medium">Analysis in progress</p>
        <p className="text-text-muted text-xs mt-1">Polling every 10 seconds</p>
      </div>
    </div>
  )
}

export function JobDetail({ job, onClose }: JobDetailProps) {
  const isTerminal = job.status === 'complete' || job.status === 'failed'
  const isActive = !isTerminal

  return (
    <div className="card flex flex-col h-full animate-slide-up overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={job.status} />
              {isActive && (
                <span className="text-xs text-text-muted animate-pulse-slow">
                  · live
                </span>
              )}
            </div>
            <p className="font-mono text-xs text-text-muted truncate mt-1">
              ID: {job.job_id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress stepper */}
        <ProgressStepper status={job.status} />
      </div>

      {/* Sequence info */}
      <div className="px-5 py-4 border-b border-border-subtle flex-shrink-0">
        <div className="grid grid-cols-2 gap-4 mb-3">
          <InfoRow label="Format" value={job.sequence_input.format.toUpperCase()} />
          <InfoRow label="Submitted" value={new Date(job.submitted_at).toLocaleTimeString()} />
        </div>
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1.5">Sequence</p>
          <div className="bg-bg-secondary rounded-lg p-3 max-h-28 overflow-y-auto">
            <p className="font-mono text-xs text-text-secondary leading-relaxed break-all whitespace-pre-wrap">
              {job.sequence_input.sequence}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Error state */}
        {job.status === 'failed' && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-5">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-red-400">Job Failed</span>
            </div>
            {job.error && (
              <p className="text-sm text-red-300/80 font-mono leading-relaxed">{job.error}</p>
            )}
          </div>
        )}

        {/* Active state */}
        {isActive && <ActiveSpinner />}

        {/* Complete: 3D Structure Viewer */}
        {job.status === 'complete' && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="flex-1 h-px bg-border-subtle" />
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
              <span>3D Structure</span>
              <span className="flex-1 h-px bg-border-subtle" />
            </h3>
            <MoleculeViewer
              jobId={job.job_id}
              plddt={job.modal_output?.best_plddt_mean ?? null}
            />
          </div>
        )}

        {/* Complete: MoE Report */}
        {job.status === 'complete' && job.moe_report && (
          <MoEReport report={job.moe_report} modalOutput={job.modal_output} />
        )}

        {/* Complete: Raw Output Panel (scores table + downloads) */}
        {job.status === 'complete' && (
          <div className="mt-6">
            <RawOutputPanel jobId={job.job_id} modalOutput={job.modal_output} />
          </div>
        )}

        {/* Complete but no report */}
        {job.status === 'complete' && !job.moe_report && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-text-muted text-sm">No expert analysis available for this job.</p>
          </div>
        )}
      </div>
    </div>
  )
}
