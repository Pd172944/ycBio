import type { MoEReport as MoEReportType, ModalOutput } from '../types'
import { ConfidenceBar } from './ConfidenceBar'

interface MoEReportProps {
  report: MoEReportType
  modalOutput: ModalOutput | null
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
      <span className="flex-1 h-px bg-border-subtle" />
      <span>{children}</span>
      <span className="flex-1 h-px bg-border-subtle" />
    </h3>
  )
}

function Tag({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'warning' | 'success' }) {
  const colors = {
    default: 'bg-bg-secondary text-text-secondary border-border-subtle',
    warning: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    success: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  }
  return (
    <span className={`inline-flex text-xs px-2 py-0.5 rounded border ${colors[variant]}`}>
      {children}
    </span>
  )
}

function PLDDTBar({ name, score }: { name: string; score: number }) {
  // pLDDT is 0–100
  const pct = Math.min(100, Math.max(0, score))
  const color =
    pct >= 90
      ? 'bg-emerald-500'
      : pct >= 70
      ? 'bg-blue-500'
      : pct >= 50
      ? 'bg-amber-500'
      : 'bg-red-500'

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-text-secondary w-24 flex-shrink-0 truncate">
        {name}
      </span>
      <div className="flex-1 h-5 bg-bg-secondary rounded overflow-hidden relative">
        <div
          className={`h-full ${color} rounded transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
        <span className="absolute inset-0 flex items-center px-2 text-xs font-mono font-medium text-white mix-blend-screen">
          {pct.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

export function MoEReport({ report, modalOutput }: MoEReportProps) {
  const { statistician, critic, synthesizer } = report
  const severityColors: Record<string, string> = {
    low: 'text-emerald-400',
    medium: 'text-amber-400',
    high: 'text-red-400',
    critical: 'text-red-500',
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Overall Confidence */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Overall Confidence</h3>
            <p className="text-xs text-text-muted mt-0.5">Mixture of Experts consensus score</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gradient font-mono">
              {(report.overall_confidence * 100).toFixed(1)}%
            </div>
          </div>
        </div>
        <ConfidenceBar score={report.overall_confidence} size="lg" showValue={false} />
      </div>

      {/* Executive Summary */}
      <div>
        <SectionHeading>Executive Summary</SectionHeading>
        <div className="card p-5">
          <p className="text-sm text-text-primary leading-relaxed">
            {synthesizer.executive_summary}
          </p>
        </div>
      </div>

      {/* Key Findings */}
      {synthesizer.key_findings.length > 0 && (
        <div>
          <SectionHeading>Key Findings</SectionHeading>
          <div className="card divide-y divide-border-subtle">
            {synthesizer.key_findings.map((finding, i) => (
              <div key={i} className="flex items-start gap-3 p-4">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-blue/10 text-accent-blue text-xs flex items-center justify-center font-semibold mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-text-secondary leading-relaxed">{finding}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistician */}
      <div>
        <SectionHeading>Statistician Analysis</SectionHeading>
        <div className="card p-5 space-y-4">
          <div>
            <ConfidenceBar
              score={statistician.confidence_score}
              label="Confidence Score"
              size="md"
            />
          </div>
          {statistician.interpretation && (
            <p className="text-sm text-text-secondary leading-relaxed border-t border-border-subtle pt-4">
              {statistician.interpretation}
            </p>
          )}
          {Object.keys(statistician.metrics).length > 0 && (
            <div className="border-t border-border-subtle pt-4">
              <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">Metrics</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statistician.metrics).map(([key, val]) => (
                  <div key={key} className="bg-bg-secondary rounded-lg px-3 py-2">
                    <p className="text-xs text-text-muted capitalize">{key.replace(/_/g, ' ')}</p>
                    <p className="text-sm font-mono text-text-primary font-medium mt-0.5">
                      {typeof val === 'number' ? val.toFixed(3) : String(val)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Critic */}
      <div>
        <SectionHeading>Critic Review</SectionHeading>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`flex items-center gap-2 ${
                critic.has_concerns ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {critic.has_concerns ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="text-sm font-medium">
                {critic.has_concerns ? 'Concerns Identified' : 'No Concerns'}
              </span>
            </div>
            {critic.severity && (
              <Tag variant={critic.severity === 'low' ? 'success' : 'warning'}>
                <span className={severityColors[critic.severity] || 'text-text-secondary'}>
                  {critic.severity} severity
                </span>
              </Tag>
            )}
            {critic.recommend_rerun && (
              <Tag variant="warning">Rerun Recommended</Tag>
            )}
          </div>

          {critic.concerns.length > 0 && (
            <ul className="space-y-2">
              {critic.concerns.map((concern, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-300/80">
                  <span className="flex-shrink-0 mt-1.5 w-1 h-1 rounded-full bg-amber-400" />
                  {concern}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* pLDDT Scores */}
      {modalOutput && modalOutput.per_model_scores.length > 0 && (
        <div>
          <SectionHeading>pLDDT Scores by Model</SectionHeading>
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-text-muted">Per-model predicted local distance difference test</p>
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> ≥90
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" /> ≥70
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" /> ≥50
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> &lt;50
                </span>
              </div>
            </div>
            {modalOutput.per_model_scores.map((s, i) => (
              <PLDDTBar
                key={i}
                name={s.model || `Model ${i + 1}`}
                score={s.plddt_mean}
              />
            ))}
            <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
              <span className="text-xs text-text-muted">Best pLDDT mean</span>
              <span className="font-mono text-sm font-semibold text-emerald-400">
                {modalOutput.best_plddt_mean.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Next Steps */}
      {synthesizer.next_steps.length > 0 && (
        <div>
          <SectionHeading>Recommended Next Steps</SectionHeading>
          <div className="card p-5">
            <ol className="space-y-3">
              {synthesizer.next_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                  <span className="flex-shrink-0 w-5 h-5 rounded bg-bg-secondary text-text-muted text-xs flex items-center justify-center font-mono mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Caveats */}
      {synthesizer.caveats.length > 0 && (
        <div>
          <SectionHeading>Caveats</SectionHeading>
          <div className="card p-5">
            <ul className="space-y-2">
              {synthesizer.caveats.map((caveat, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-muted">
                  <span className="flex-shrink-0 mt-1.5 w-1 h-1 rounded-full bg-text-muted" />
                  {caveat}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
