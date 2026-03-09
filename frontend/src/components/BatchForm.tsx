import { useState, type FormEvent } from 'react'

// Validate a single mutation string like "V5A"
const MUTATION_RE = /^[A-Za-z]\d+[A-Za-z]$/

function validateMutation(m: string): boolean {
    return MUTATION_RE.test(m.trim())
}

interface BatchFormProps {
    onSubmit: (wildtype: string, mutations: string[]) => Promise<void>
}

export function BatchForm({ onSubmit }: BatchFormProps) {
    const [wildtype, setWildtype] = useState('')
    const [mutationsRaw, setMutationsRaw] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const mutations = mutationsRaw
        .split('\n')
        .map((m) => m.trim())
        .filter(Boolean)

    const invalidMutations = mutations.filter((m) => !validateMutation(m))
    const isValid =
        wildtype.trim().length > 0 && mutations.length > 0 && invalidMutations.length === 0

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!isValid) return

        setIsSubmitting(true)
        setError(null)

        try {
            await onSubmit(wildtype.trim().toUpperCase(), mutations)
            setWildtype('')
            setMutationsRaw('')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit batch')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="card p-6 animate-fade-in">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-text-primary">Mutation Batch Analysis</h2>
                <p className="text-sm text-text-muted mt-0.5">
                    Run AlphaFold on a wildtype + variants and compare structural impact
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Wildtype sequence */}
                <div>
                    <label className="label block mb-2" htmlFor="wildtype">
                        Wildtype Sequence
                    </label>
                    <input
                        id="wildtype"
                        type="text"
                        value={wildtype}
                        onChange={(e) => setWildtype(e.target.value)}
                        placeholder="MKTAYIAKQRQISFVK"
                        className="input-base w-full font-mono text-sm"
                        spellCheck={false}
                        autoComplete="off"
                    />
                    {wildtype.trim().length > 0 && (
                        <p className="text-xs text-text-muted mt-1">
                            {wildtype.trim().length} residues
                        </p>
                    )}
                </div>

                {/* Mutations */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="label" htmlFor="mutations">
                            Point Mutations
                        </label>
                        <span className="text-xs text-text-muted">one per line, e.g. V5A</span>
                    </div>
                    <textarea
                        id="mutations"
                        value={mutationsRaw}
                        onChange={(e) => setMutationsRaw(e.target.value)}
                        placeholder={'V5A\nK7R\nQ9E'}
                        rows={5}
                        className="input-base w-full font-mono text-sm resize-none leading-relaxed"
                        spellCheck={false}
                    />

                    {/* Validation feedback per line */}
                    {mutations.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {mutations.map((m, i) => {
                                const valid = validateMutation(m)
                                return (
                                    <div key={i} className="flex items-center gap-2 text-xs font-mono">
                                        <span
                                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${valid ? 'bg-emerald-400' : 'bg-red-400'
                                                }`}
                                        />
                                        <span className={valid ? 'text-text-secondary' : 'text-red-400'}>
                                            {m}
                                            {!valid && (
                                                <span className="ml-2 text-red-400/70">
                                                    — expected format like V5A
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

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
                        {mutations.length > 0
                            ? `${mutations.length} mutant${mutations.length !== 1 ? 's' : ''} + wildtype = ${mutations.length + 1} jobs`
                            : 'Enter mutations above'}
                    </p>
                    <button
                        type="submit"
                        disabled={!isValid || isSubmitting}
                        className="btn-primary flex items-center gap-2 min-w-[160px] justify-center"
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
                                        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                                    />
                                </svg>
                                <span>Run Batch</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}
