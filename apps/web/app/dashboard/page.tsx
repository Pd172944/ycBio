'use client'

import { useState, useEffect, useCallback } from 'react'

const API = 'http://localhost:8000'

type RunStatus = 'pending' | 'running' | 'completed' | 'failed'
type StepStatus = 'pending' | 'running' | 'completed' | 'failed'

interface PipelineStep {
  id: string
  step_name: string
  status: StepStatus
  agent_reasoning?: string
  error_message?: string
}

interface PipelineRun {
  id: string
  name: string
  status: RunStatus
  target_sequence: string
  created_at: string
  error_message?: string
  steps: PipelineStep[]
}

const STEP_NAMES = ['folding', 'binding_site', 'docking', 'admet', 'literature', 'documentation'] as const

const EXAMPLE_SEQUENCES = [
  { label: 'Insulin', value: 'MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKT' },
  { label: 'Barnase', value: 'MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTL' },
]

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    running: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
  }
  const dots: Record<string, string> = {
    pending: 'bg-yellow-400',
    running: 'bg-blue-500 animate-pulse',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status] ?? ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] ?? ''}`} />
      {status}
    </span>
  )
}

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('researcher@bioos.dev')
  const [password, setPassword] = useState('bioos2024')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    // trim/limit to 72 chars to mirror bcrypt behavior and avoid server
    // ValueErrors when an overly long string is entered by mistake
    const safePassword = password.trim().slice(0, 72)
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: safePassword }),
      })
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
      const { access_token } = await res.json()
      onLogin(access_token)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="font-bold text-gray-900 text-lg">BioOS</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-5">Sign in</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg transition-colors">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-4 text-center">
          Run <code className="bg-gray-100 px-1 rounded">python seed.py</code> in apps/api to create a test user
        </p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null)
  const [sequence, setSequence] = useState('')
  const [runName, setRunName] = useState('My Pipeline Run')
  const [enabledSteps, setEnabledSteps] = useState<Record<string, boolean>>({
    folding: true, binding_site: false, docking: true, admet: true, literature: false, documentation: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runs, setRuns] = useState<PipelineRun[]>([])
  const [activeTab, setActiveTab] = useState<'submit' | 'runs'>('submit')
  const [apiHealth, setApiHealth] = useState<'checking' | 'ok' | 'error'>('checking')

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token])

  useEffect(() => {
    fetch(`${API}/health`).then(r => r.json()).then(() => setApiHealth('ok')).catch(() => setApiHealth('error'))
  }, [])

  const pollRuns = useCallback(() => {
    if (!token) return
    runs.forEach(async run => {
      if (run.status !== 'pending' && run.status !== 'running') return
      try {
        const res = await fetch(`${API}/api/pipelines/${run.id}`, { headers: authHeaders() })
        if (!res.ok) return
        const updated: PipelineRun = await res.json()
        setRuns(prev => prev.map(r => r.id === run.id ? updated : r))
      } catch {}
    })
  }, [token, runs, authHeaders])

  useEffect(() => {
    const interval = setInterval(pollRuns, 3000)
    return () => clearInterval(interval)
  }, [pollRuns])

  async function submitRun() {
    if (!sequence.trim() || !token) return
    setError(null)
    setSubmitting(true)
    try {
      const pipeline_config = STEP_NAMES.map(name => ({
        step_name: name, enabled: enabledSteps[name] ?? false, params: {},
      }))
      const res = await fetch(`${API}/api/pipelines`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: runName, target_sequence: sequence.trim(), pipeline_config }),
      })
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
      const run: PipelineRun = await res.json()
      setRuns(prev => [run, ...prev])
      setActiveTab('runs')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) return <LoginForm onLogin={setToken} />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg">BioOS Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <span className={`flex items-center gap-1.5 text-sm font-medium ${apiHealth === 'ok' ? 'text-green-600' : apiHealth === 'error' ? 'text-red-600' : 'text-yellow-600'}`}>
              <span className={`w-2 h-2 rounded-full ${apiHealth === 'ok' ? 'bg-green-500' : apiHealth === 'error' ? 'bg-red-500' : 'bg-yellow-400 animate-pulse'}`} />
              {apiHealth === 'ok' ? 'API Connected' : apiHealth === 'error' ? 'API Offline' : 'Checking…'}
            </span>
            <button onClick={() => setToken(null)} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-1 mb-8 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {(['submit', 'runs'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              {tab === 'runs' ? `Runs${runs.length > 0 ? ` (${runs.length})` : ''}` : 'Submit'}
            </button>
          ))}
        </div>

        {activeTab === 'submit' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-5">Submit Pipeline Run</h2>

                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Quick fill</p>
                  <div className="flex gap-2">
                    {EXAMPLE_SEQUENCES.map(ex => (
                      <button key={ex.label} onClick={() => setSequence(ex.value)}
                        className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md border border-blue-200 transition-colors">
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Run name</label>
                  <input value={runName} onChange={e => setRunName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Sequence <span className="text-red-500">*</span>
                  </label>
                  <textarea value={sequence} onChange={e => setSequence(e.target.value)} rows={5}
                    placeholder="Paste amino acid sequence (standard 20 amino acids)…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
                </div>

                <div className="mb-5">
                  <p className="text-sm font-medium text-gray-700 mb-2">Pipeline steps</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STEP_NAMES.map(step => (
                      <label key={step} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                        <input type="checkbox" checked={enabledSteps[step] ?? false}
                          onChange={e => setEnabledSteps(prev => ({ ...prev, [step]: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        {step.replace('_', ' ')}
                      </label>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <strong>Error:</strong> {error}
                  </div>
                )}

                <button onClick={submitRun} disabled={submitting || !sequence.trim() || apiHealth !== 'ok'}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                  {submitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Submitting…
                    </>
                  ) : 'Run Pipeline'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm h-fit">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Steps</h3>
              <ul className="space-y-2.5 text-sm text-gray-600">
                {[
                  ['folding', 'ESMFold / AlphaFold3 via Modal → Tamarind'],
                  ['binding_site', 'Binding site identification'],
                  ['docking', 'Molecular docking (DiffDock / Vina)'],
                  ['admet', 'ADMET screening & drug-likeness'],
                  ['literature', 'PubMed / ChEMBL literature search'],
                  ['documentation', 'FDA-grade report generation'],
                ].map(([name, desc]) => (
                  <li key={name} className="flex gap-2">
                    <span className={`flex-shrink-0 w-2 h-2 mt-1.5 rounded-full ${enabledSteps[name!] ? 'bg-blue-500' : 'bg-gray-300'}`} />
                    <span>
                      <span className="font-medium text-gray-700">{name?.replace('_', ' ')}</span>
                      <br /><span className="text-xs">{desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'runs' && (
          <div className="space-y-4">
            {runs.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
                <p className="text-gray-500 text-sm">No runs yet.</p>
                <button onClick={() => setActiveTab('submit')} className="mt-3 text-sm text-blue-600 hover:underline">Go to Submit →</button>
              </div>
            ) : runs.map(run => (
              <div key={run.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{run.name}</span>
                      <StatusBadge status={run.status} />
                    </div>
                    <code className="text-xs text-gray-400 font-mono">{run.id}</code>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{new Date(run.created_at).toLocaleTimeString()}</span>
                </div>

                <p className="text-xs text-gray-500 font-mono truncate">
                  {run.target_sequence.slice(0, 80)}{run.target_sequence.length > 80 ? '…' : ''}
                </p>

                {run.error_message && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <strong>Error:</strong> {run.error_message}
                  </div>
                )}

                {run.steps.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Steps</p>
                    {run.steps.map(step => (
                      <div key={step.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <StatusBadge status={step.status} />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-gray-700">{step.step_name.replace('_', ' ')}</span>
                          {step.agent_reasoning && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{step.agent_reasoning}</p>
                          )}
                          {step.error_message && (
                            <p className="text-xs text-red-600 mt-1">{step.error_message}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
