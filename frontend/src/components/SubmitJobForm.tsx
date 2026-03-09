import { useState, type FormEvent } from 'react'
import type { SequenceFormat } from '../types'
import { PipelineBuilder, type PipelineStage } from './PipelineBuilder'

interface SubmitJobFormProps {
  onSubmit: (sequence: string, format: SequenceFormat, pipeline?: PipelineStage[]) => Promise<void>
}

const EXAMPLE_SEQUENCES: Record<SequenceFormat, string> = {
  raw: 'MKTIIALSYIFCLVFA',
  fasta: '>sp|P0DTD1|R1AB_SARS2 Replicase polyprotein 1ab\nMKTIIALSYIFCLVFA',
}

export function SubmitJobForm({ onSubmit }: SubmitJobFormProps) {
  const [sequence, setSequence] = useState('')
  const [format, setFormat] = useState<SequenceFormat>('raw')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pipeline, setPipeline] = useState<PipelineStage[]>([])
  const [showPipelineBuilder, setShowPipelineBuilder] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!sequence.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit(sequence.trim(), format, pipeline.length > 0 ? pipeline : undefined)
      setSequence('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit job')
    } finally {
      setIsSubmitting(false)
    }
  }

  const loadExample = () => {
    setSequence(EXAMPLE_SEQUENCES[format])
  }

  const charCount = sequence.trim().length

  return (
    <div className="card p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Submit Analysis Job</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Run protein structure prediction and analysis
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-text-muted">API Connected</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Format selector */}
        <div>
          <label className="label block mb-2">Input Format</label>
          <div className="flex gap-2">
            {(['raw', 'fasta'] as SequenceFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${
                    format === f
                      ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/20'
                      : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-elevated border border-border-default'
                  }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Sequence input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label" htmlFor="sequence">
              Amino Acid Sequence
            </label>
            <button
              type="button"
              onClick={loadExample}
              className="text-xs text-accent-blue hover:text-accent-blue-glow transition-colors"
            >
              Load example
            </button>
          </div>
          <div className="relative">
            <textarea
              id="sequence"
              value={sequence}
              onChange={(e) => setSequence(e.target.value)}
              placeholder={
                format === 'fasta'
                  ? '>protein_name\nMKTIIALSYIFCLVFA...'
                  : 'MKTIIALSYIFCLVFA...'
              }
              rows={6}
              className="input-base w-full font-mono text-sm resize-none leading-relaxed"
              spellCheck={false}
              autoComplete="off"
            />
            {charCount > 0 && (
              <span className="absolute bottom-3 right-3 text-xs text-text-muted font-mono">
                {charCount} chars
              </span>
            )}
          </div>
          {format === 'raw' && (
            <p className="text-xs text-text-muted mt-1.5">
              Enter the raw amino acid sequence using single-letter codes (A–Z)
            </p>
          )}
          {format === 'fasta' && (
            <p className="text-xs text-text-muted mt-1.5">
              Start with a FASTA header line beginning with {">"}, followed by the sequence
            </p>
          )}
        </div>

        {/* Pipeline Builder Toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowPipelineBuilder(!showPipelineBuilder)}
            className="flex items-center justify-between w-full p-3 rounded-lg border border-border-default hover:border-border-strong transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-medium text-text-primary">
                  Customize Pipeline
                </span>
                <p className="text-xs text-text-muted mt-0.5">
                  {pipeline.length > 0 
                    ? `${pipeline.length} stages configured`
                    : 'Use default pipeline or customize stages'
                  }
                </p>
              </div>
            </div>
            <svg 
              className={`w-4 h-4 text-text-muted transition-transform ${showPipelineBuilder ? 'rotate-180' : ''}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Pipeline Builder */}
        {showPipelineBuilder && (
          <div className="animate-fade-in">
            <PipelineBuilder
              onPipelineChange={setPipeline}
              className="border border-border-default rounded-lg p-4 bg-bg-secondary/20"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <span className="text-red-400 mt-0.5 text-lg leading-none">!</span>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-text-muted">
            Pipeline: <span className="text-text-secondary font-mono">
              {pipeline.length > 0 
                ? pipeline.map(s => s.name.toLowerCase()).join(' → ')
                : 'default'
              }
            </span>
          </p>
          <button
            type="submit"
            disabled={!sequence.trim() || isSubmitting}
            className="btn-primary flex items-center gap-2 min-w-[140px] justify-center"
          >
            {isSubmitting ? (
              <>
                <div className="spinner" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span>Run Analysis</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
