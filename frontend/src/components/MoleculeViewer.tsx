import { useEffect, useRef, useState } from 'react'

interface MoleculeViewerProps {
    jobId: string
    plddt?: number | null
}

declare global {
    interface Window {
        $3Dmol: any
    }
}

const STYLE_OPTIONS = [
    { key: 'cartoon', label: 'Ribbon' },
    { key: 'sphere', label: 'Sphere' },
    { key: 'stick', label: 'Stick' },
    { key: 'surface', label: 'Surface' },
] as const

type StyleKey = typeof STYLE_OPTIONS[number]['key']

const COLOR_OPTIONS = [
    { key: 'spectrum', label: 'Rainbow' },
    { key: 'ssPyMol', label: 'Secondary Structure' },
    { key: 'chain', label: 'By Chain' },
] as const

type ColorKey = typeof COLOR_OPTIONS[number]['key']

function load3DmolScript(): Promise<void> {
    if (window.$3Dmol) return Promise.resolve()
    if (document.getElementById('3dmol-script')) {
        return new Promise(resolve => {
            const check = setInterval(() => {
                if (window.$3Dmol) { clearInterval(check); resolve() }
            }, 50)
        })
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.id = '3dmol-script'
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.1.0/3Dmol-min.js'
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load 3Dmol.js'))
        document.head.appendChild(script)
    })
}

export function MoleculeViewer({ jobId, plddt }: MoleculeViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewerRef = useRef<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [style, setStyle] = useState<StyleKey>('cartoon')
    const [color, setColor] = useState<ColorKey>('spectrum')
    const [spinning, setSpinning] = useState(true)
    const pdbRef = useRef<string | null>(null)

    // Fetch PDB text
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)

        fetch(`http://localhost:8000/jobs/${jobId}/structure/pdb-content`)
            .then(r => {
                if (!r.ok) throw new Error('Structure not available for this job.')
                return r.text()
            })
            .then(text => {
                if (cancelled) return
                pdbRef.current = text
                setLoading(false)
            })
            .catch(err => {
                if (cancelled) return
                setError(err.message)
                setLoading(false)
            })

        return () => { cancelled = true }
    }, [jobId])

    // Initialize / re-render viewer whenever pdb, style, or color changes
    useEffect(() => {
        if (loading || error || !pdbRef.current || !containerRef.current) return

        load3DmolScript().then(() => {
            if (!containerRef.current || !pdbRef.current) return

            // Clean up previous viewer
            if (viewerRef.current) {
                try { viewerRef.current.clear() } catch { }
            }

            const viewer = window.$3Dmol.createViewer(containerRef.current, {
                backgroundColor: '0x0d1117',
                antialias: true,
            })
            viewerRef.current = viewer

            viewer.addModel(pdbRef.current, 'pdb')

            const styleObj: any =
                style === 'cartoon' ? { cartoon: { colorscheme: color } }
                    : style === 'sphere' ? { sphere: { colorscheme: color, radius: 0.4 } }
                        : style === 'stick' ? { stick: { colorscheme: color, radius: 0.15 } }
                            : { surface: { colorscheme: color, opacity: 0.85 } }

            viewer.setStyle({}, styleObj)
            viewer.zoomTo()
            viewer.render()

            if (spinning) viewer.spin('y', 0.5)
        }).catch(err => {
            setError(err.message)
        })
    }, [loading, error, style, color, spinning])

    // Toggle spin without full re-render
    useEffect(() => {
        if (!viewerRef.current) return
        if (spinning) viewerRef.current.spin('y', 0.5)
        else viewerRef.current.spin(false)
        viewerRef.current.render()
    }, [spinning])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-2 border-border-subtle" />
                    <div
                        className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-blue"
                        style={{ animation: 'spin 1s linear infinite' }}
                    />
                </div>
                <p className="text-text-muted text-xs">Loading 3D structure…</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
                <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-text-muted text-xs max-w-xs">{error}</p>
                <p className="text-text-muted text-[11px] opacity-60">
                    3D view is available for jobs run with a real AlphaFold model.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {/* Viewer canvas */}
            <div className="relative rounded-xl overflow-hidden border border-border-subtle" style={{ height: 320 }}>
                <div ref={containerRef} className="w-full h-full" />

                {/* pLDDT badge */}
                {plddt != null && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-bg-primary/80 backdrop-blur-sm border border-border-subtle rounded-lg px-2.5 py-1.5">
                        <span className="text-[10px] text-text-muted uppercase tracking-wider">pLDDT</span>
                        <span className={`font-mono text-xs font-semibold ${plddt >= 90 ? 'text-emerald-400'
                                : plddt >= 70 ? 'text-blue-400'
                                    : plddt >= 50 ? 'text-amber-400'
                                        : 'text-red-400'
                            }`}>{plddt.toFixed(1)}</span>
                    </div>
                )}

                {/* Spin toggle */}
                <button
                    onClick={() => setSpinning(s => !s)}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-bg-primary/80 backdrop-blur-sm border border-border-subtle text-text-muted hover:text-text-primary transition-colors"
                    title={spinning ? 'Pause rotation' : 'Start rotation'}
                >
                    {spinning ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                        </svg>
                    ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-3 items-center">
                {/* Style picker */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">Style</span>
                    <div className="flex rounded-lg overflow-hidden border border-border-subtle divide-x divide-border-subtle">
                        {STYLE_OPTIONS.map(o => (
                            <button
                                key={o.key}
                                onClick={() => setStyle(o.key)}
                                className={`px-2.5 py-1 text-xs transition-colors ${style === o.key
                                        ? 'bg-accent-blue/10 text-accent-blue'
                                        : 'bg-bg-secondary text-text-muted hover:text-text-primary'
                                    }`}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Color picker */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">Color</span>
                    <div className="flex rounded-lg overflow-hidden border border-border-subtle divide-x divide-border-subtle">
                        {COLOR_OPTIONS.map(o => (
                            <button
                                key={o.key}
                                onClick={() => setColor(o.key)}
                                className={`px-2.5 py-1 text-xs transition-colors ${color === o.key
                                        ? 'bg-accent-blue/10 text-accent-blue'
                                        : 'bg-bg-secondary text-text-muted hover:text-text-primary'
                                    }`}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <p className="text-[11px] text-text-muted">
                Best-ranked AlphaFold model · Drag to rotate · Scroll to zoom
            </p>
        </div>
    )
}
