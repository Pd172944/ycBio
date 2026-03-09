import type { Batch, JobStatus, MutationVariant, RankingEntry } from '../types'
import { StatusBadge } from './StatusBadge'

interface BatchDetailProps {
    batch: Batch
    onClose: () => void
}

// ---------------------------------------------------------------------------
// Small shared primitives
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="flex-1 h-px bg-border-subtle" />
            <span>{children}</span>
            <span className="flex-1 h-px bg-border-subtle" />
        </h3>
    )
}

function ImpactBadge({ impact }: { impact: string }) {
    const styles: Record<string, string> = {
        stabilizing: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        neutral: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
        destabilizing: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    return (
        <span
            className={`inline-flex text-xs px-2 py-0.5 rounded border font-medium capitalize ${styles[impact] ?? 'bg-bg-secondary text-text-secondary border-border-subtle'
                }`}
        >
            {impact}
        </span>
    )
}

function DeltaDisplay({ delta }: { delta: number | null }) {
    if (delta === null) return <span className="font-mono text-xs text-text-muted">—</span>
    const sign = delta > 0 ? '+' : ''
    const color =
        delta > 0.03
            ? 'text-emerald-400'
            : delta < -0.03
                ? 'text-red-400'
                : 'text-text-secondary'
    return (
        <span className={`font-mono text-xs font-semibold ${color}`}>
            {sign}{(delta * 100).toFixed(1)}%
        </span>
    )
}

// ---------------------------------------------------------------------------
// Variant card
// ---------------------------------------------------------------------------

function VariantCard({ variant }: { variant: MutationVariant }) {
    const isWildtype = variant.label === 'wildtype'
    const confidence = variant.moe_report?.overall_confidence ?? null

    return (
        <div
            className={`card p-4 flex flex-col gap-3 ${isWildtype ? 'ring-1 ring-blue-500/30' : ''
                }`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-text-primary">
                        {variant.label}
                    </span>
                    {isWildtype && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            wildtype
                        </span>
                    )}
                </div>
                <StatusBadge status={variant.status as JobStatus} />
            </div>

            <div className="font-mono text-xs text-text-muted break-all leading-relaxed bg-bg-secondary rounded px-2 py-1.5">
                {variant.sequence.length > 40
                    ? `${variant.sequence.slice(0, 40)}…`
                    : variant.sequence}
            </div>

            {confidence !== null && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">Confidence</span>
                    <span className="font-mono text-sm font-semibold text-gradient">
                        {(confidence * 100).toFixed(1)}%
                    </span>
                </div>
            )}

            {variant.job_id && (
                <p className="font-mono text-xs text-text-muted truncate">
                    job: {variant.job_id}
                </p>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Rankings table
// ---------------------------------------------------------------------------

function RankingsTable({ rankings }: { rankings: RankingEntry[] }) {
    return (
        <div className="card overflow-hidden">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-border-subtle bg-bg-secondary">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                            Rank
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                            Variant
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                            ΔpLDDT
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                            Impact
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                            Notes
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                    {rankings.map((entry, i) => (
                        <tr
                            key={entry.label}
                            className={`transition-colors hover:bg-bg-elevated ${i === 0 ? 'bg-emerald-500/5' : ''
                                }`}
                        >
                            <td className="px-4 py-3 text-text-muted font-mono text-xs">
                                {i + 1}
                            </td>
                            <td className="px-4 py-3 font-mono text-sm font-semibold text-text-primary">
                                {entry.label}
                            </td>
                            <td className="px-4 py-3">
                                <DeltaDisplay delta={entry.plddt_delta} />
                            </td>
                            <td className="px-4 py-3">
                                <ImpactBadge impact={entry.impact} />
                            </td>
                            <td className="px-4 py-3 text-xs text-text-secondary leading-relaxed max-w-xs">
                                {entry.notes}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function ActiveSpinner() {
    return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-border-subtle" />
                <div
                    className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-accent-blue"
                    style={{ animation: 'spin 1s linear infinite' }}
                />
            </div>
            <div className="text-center">
                <p className="text-text-secondary text-sm font-medium">Variants running</p>
                <p className="text-text-muted text-xs mt-1">Polling every 30 seconds</p>
            </div>
        </div>
    )
}

export function BatchDetail({ batch, onClose }: BatchDetailProps) {
    const isComplete = batch.status === 'complete'
    const isFailed = batch.status === 'failed'
    const isActive = !isComplete && !isFailed

    const completeCount = batch.variants.filter((v) => v.status === 'complete').length
    const totalCount = batch.variants.length

    return (
        <div className="card flex flex-col h-full animate-slide-up overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-border-subtle flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <StatusBadge status={batch.status as JobStatus} />
                            {isActive && (
                                <span className="text-xs text-text-muted animate-pulse-slow">· live</span>
                            )}
                        </div>
                        <p className="font-mono text-xs text-text-muted truncate mt-1">
                            Batch: {batch.batch_id}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                            {completeCount} / {totalCount} variants complete ·{' '}
                            {new Date(batch.created_at).toLocaleString()}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                        aria-label="Close"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Variant grid */}
                <div>
                    <SectionHeading>Variants</SectionHeading>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {batch.variants.map((v) => (
                            <VariantCard key={v.label} variant={v} />
                        ))}
                    </div>
                </div>

                {/* Active spinner */}
                {isActive && <ActiveSpinner />}

                {/* Failed state */}
                {isFailed && !isComplete && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-5">
                        <div className="flex items-center gap-2">
                            <svg
                                className="w-4 h-4 text-red-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <span className="text-sm font-medium text-red-400">Batch Failed</span>
                        </div>
                    </div>
                )}

                {/* Comparator report */}
                {isComplete && batch.comparator_report && (
                    <>
                        {/* Summary */}
                        <div>
                            <SectionHeading>Comparative Summary</SectionHeading>
                            <div className="card p-5">
                                <p className="text-sm text-text-primary leading-relaxed">
                                    {batch.comparator_report.summary}
                                </p>
                            </div>
                        </div>

                        {/* Rankings */}
                        {batch.comparator_report.rankings.length > 0 && (
                            <div>
                                <SectionHeading>Variant Rankings</SectionHeading>
                                <RankingsTable rankings={batch.comparator_report.rankings} />
                            </div>
                        )}

                        {/* Recommendation */}
                        <div>
                            <SectionHeading>Recommendation</SectionHeading>
                            <div className="card p-5 bg-emerald-500/5 border-emerald-500/20">
                                <div className="flex items-start gap-3">
                                    <svg
                                        className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    <p className="text-sm text-text-primary leading-relaxed">
                                        {batch.comparator_report.recommendation}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Caveats */}
                        {batch.comparator_report.caveats.length > 0 && (
                            <div>
                                <SectionHeading>Caveats</SectionHeading>
                                <div className="card p-5">
                                    <ul className="space-y-2">
                                        {batch.comparator_report.caveats.map((caveat, i) => (
                                            <li
                                                key={i}
                                                className="flex items-start gap-2 text-sm text-text-muted"
                                            >
                                                <span className="flex-shrink-0 mt-1.5 w-1 h-1 rounded-full bg-text-muted" />
                                                {caveat}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
