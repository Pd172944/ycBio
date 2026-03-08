interface ConfidenceBarProps {
  score: number // 0–1
  label?: string
  showValue?: boolean
  size?: 'sm' | 'md' | 'lg'
}

function getConfidenceColor(score: number): string {
  if (score >= 0.8) return 'from-emerald-500 to-emerald-400'
  if (score >= 0.6) return 'from-blue-500 to-blue-400'
  if (score >= 0.4) return 'from-amber-500 to-amber-400'
  return 'from-red-500 to-red-400'
}

function getConfidenceLabel(score: number): string {
  if (score >= 0.8) return 'High'
  if (score >= 0.6) return 'Moderate'
  if (score >= 0.4) return 'Low'
  return 'Very Low'
}

const SIZE_MAP = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
}

export function ConfidenceBar({
  score,
  label,
  showValue = true,
  size = 'md',
}: ConfidenceBarProps) {
  const pct = Math.min(100, Math.max(0, score * 100))
  const color = getConfidenceColor(score)
  const confidenceLabel = getConfidenceLabel(score)

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-xs text-text-secondary">{label}</span>}
          {showValue && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">{confidenceLabel}</span>
              <span className="text-sm font-semibold text-text-primary font-mono">
                {(pct).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
      <div
        className={`w-full ${SIZE_MAP[size]} bg-bg-secondary rounded-full overflow-hidden`}
      >
        <div
          className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
