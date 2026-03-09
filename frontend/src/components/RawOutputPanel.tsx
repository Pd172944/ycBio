import type { ModalOutput } from '../types'

interface RawOutputPanelProps {
    jobId: string
    modalOutput: ModalOutput | null
}

const BASE_URL = 'http://localhost:8000'

function DownloadButton({
    href,
    label,
    icon,
}: {
    href: string
    label: string
    icon: React.ReactNode
}) {
    return (
        <a
            href={href}
            download
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-secondary border border-border-subtle text-xs text-text-secondary hover:text-text-primary hover:border-border-strong hover:bg-bg-elevated transition-all"
        >
            {icon}
            {label}
        </a>
    )
}

function MetricCell({ value }: { value: number | null | undefined }) {
    if (value == null) return <span className="text-text-muted font-mono text-xs">—</span>
    return (
        <span className="font-mono text-xs text-text-primary">
            {typeof value === 'number' ? value.toFixed(3) : value}
        </span>
    )
}

function ScoreTag({ score }: { score: number | null | undefined }) {
    if (score == null) return <span className="text-text-muted text-xs">—</span>
    const pct = Math.min(100, Math.max(0, score))
    const color =
        pct >= 90
            ? 'text-emerald-400'
            : pct >= 70
                ? 'text-blue-400'
                : pct >= 50
                    ? 'text-amber-400'
                    : 'text-red-400'
    return <span className={`font-mono text-xs font-semibold ${color}`}>{pct.toFixed(1)}</span>
}

export function RawOutputPanel({ jobId, modalOutput }: RawOutputPanelProps) {
    const downloadIcon = (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
    )

    return (
        <div className="space-y-4 animate-slide-up">
            {/* Downloads */}
            <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="flex-1 h-px bg-border-subtle" />
                    <span>Download Artifacts</span>
                    <span className="flex-1 h-px bg-border-subtle" />
                </h3>
                <div className="flex flex-wrap gap-2">
                    {/* Primary: actual PDB structure files from Tamarind */}
                    <a
                        href={`${BASE_URL}/jobs/${jobId}/download/structure`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/30 text-xs text-accent-blue hover:bg-accent-blue/20 hover:border-accent-blue/50 transition-all font-medium"
                    >
                        {downloadIcon}
                        Structure Files (.pdb zip)
                    </a>
                    <DownloadButton
                        href={`${BASE_URL}/jobs/${jobId}/download/raw-output`}
                        label="AlphaFold Scores (.json)"
                        icon={downloadIcon}
                    />
                    <DownloadButton
                        href={`${BASE_URL}/jobs/${jobId}/download/moe-report`}
                        label="MoE Expert Report (.json)"
                        icon={downloadIcon}
                    />
                </div>
                <p className="text-xs text-text-muted mt-2">
                    Structure files: ZIP archive with all ranked PDB models + confidence score JSON files from Tamarind Bio.
                </p>
            </div>

            {/* Per-model scores table */}
            {modalOutput && modalOutput.per_model_scores && modalOutput.per_model_scores.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="flex-1 h-px bg-border-subtle" />
                        <span>Per-Model AlphaFold Scores</span>
                        <span className="flex-1 h-px bg-border-subtle" />
                    </h3>
                    <div className="card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-border-subtle">
                                        <th className="px-4 py-2.5 text-xs text-text-muted font-medium uppercase tracking-wider">Rank</th>
                                        <th className="px-4 py-2.5 text-xs text-text-muted font-medium uppercase tracking-wider">pLDDT Mean</th>
                                        <th className="px-4 py-2.5 text-xs text-text-muted font-medium uppercase tracking-wider">pLDDT Min</th>
                                        <th className="px-4 py-2.5 text-xs text-text-muted font-medium uppercase tracking-wider">Max PAE</th>
                                        <th className="px-4 py-2.5 text-xs text-text-muted font-medium uppercase tracking-wider">PTM</th>
                                        <th className="px-4 py-2.5 text-xs text-text-muted font-medium uppercase tracking-wider">iPTM</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {modalOutput.per_model_scores.map((s, i) => (
                                        <tr key={i} className={i === 0 ? 'bg-emerald-500/5' : 'hover:bg-bg-elevated/50 transition-colors'}>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-xs text-text-secondary">#{(s as any).rank ?? i + 1}</span>
                                                    {i === 0 && (
                                                        <span className="text-xs text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded text-[10px]">Best</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <ScoreTag score={s.plddt_mean} />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <MetricCell value={(s as any).plddt_min} />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <MetricCell value={(s as any).max_pae} />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <MetricCell value={(s as any).ptm} />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <MetricCell value={(s as any).iptm} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Config footer */}
                        {modalOutput && (
                            <div className="px-4 py-3 border-t border-border-subtle bg-bg-secondary/50 flex flex-wrap gap-4">
                                {(modalOutput as any).model_type && (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-text-muted uppercase tracking-wider">Model</span>
                                        <span className="font-mono text-xs text-text-secondary">{(modalOutput as any).model_type}</span>
                                    </div>
                                )}
                                {(modalOutput as any).num_models && (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-text-muted uppercase tracking-wider">Models run</span>
                                        <span className="font-mono text-xs text-text-secondary">{(modalOutput as any).num_models}</span>
                                    </div>
                                )}
                                {(modalOutput as any).num_recycles != null && (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-text-muted uppercase tracking-wider">Recycles</span>
                                        <span className="font-mono text-xs text-text-secondary">{(modalOutput as any).num_recycles}</span>
                                    </div>
                                )}
                                {(modalOutput as any).sequence_length && (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-text-muted uppercase tracking-wider">Seq. length</span>
                                        <span className="font-mono text-xs text-text-secondary">{(modalOutput as any).sequence_length} aa</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* If no per-model scores but output exists, show raw key-value dump */}
            {modalOutput && (!modalOutput.per_model_scores || modalOutput.per_model_scores.length === 0) && (
                <div>
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="flex-1 h-px bg-border-subtle" />
                        <span>Pipeline Output Data</span>
                        <span className="flex-1 h-px bg-border-subtle" />
                    </h3>
                    <div className="card p-4">
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(modalOutput)
                                .filter(([, v]) => typeof v !== 'object' && v != null)
                                .map(([k, v]) => (
                                    <div key={k} className="bg-bg-secondary rounded-lg px-3 py-2">
                                        <p className="text-xs text-text-muted capitalize">{k.replace(/_/g, ' ')}</p>
                                        <p className="text-sm font-mono text-text-primary font-medium mt-0.5 truncate">
                                            {String(v)}
                                        </p>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
