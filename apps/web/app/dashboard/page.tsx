'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { AIResearchAssistant } from '@/components/ai-research-assistant'
import { WorkflowBuilder } from '@/components/workflow-builder'
import { cn } from '@/lib/utils'

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

const STEP_META: Record<string, { label: string; desc: string; icon: React.ReactNode; color: string }> = {
  folding: {
    label: 'Structure Prediction',
    desc: 'AlphaFold 3 / ESMFold via Modal → Tamarind',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>,
    color: 'emerald',
  },
  binding_site: {
    label: 'Binding Site',
    desc: 'Binding site identification & analysis',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>,
    color: 'cyan',
  },
  docking: {
    label: 'Molecular Docking',
    desc: 'DiffDock / AutoDock Vina simulations',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>,
    color: 'violet',
  },
  admet: {
    label: 'ADMET Screening',
    desc: 'Drug-likeness & ADMET property prediction',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
    color: 'amber',
  },
  literature: {
    label: 'Literature Search',
    desc: 'PubMed / ChEMBL retrieval & analysis',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
    color: 'pink',
  },
  documentation: {
    label: 'FDA Report',
    desc: 'FDA-grade documentation generation',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
    color: 'emerald',
  },
}

const STEP_TOOLS: Record<string, Array<{ id: string; name: string }>> = {
  folding:       [{ id: 'alphafold3', name: 'AlphaFold 3' }, { id: 'esmfold', name: 'ESMFold' }, { id: 'openfold', name: 'OpenFold' }],
  binding_site:  [{ id: 'p2rank', name: 'P2Rank' }, { id: 'fpocket', name: 'FPocket' }, { id: 'sitemap', name: 'SiteMap' }],
  docking:       [{ id: 'diffdock', name: 'DiffDock' }, { id: 'autodock_vina', name: 'AutoDock Vina' }, { id: 'gnina', name: 'Gnina' }],
  admet:         [{ id: 'admetlab', name: 'ADMETlab 2.0' }, { id: 'swissadme', name: 'SwissADME' }, { id: 'pkcsm', name: 'pkCSM' }],
  literature:    [{ id: 'pubmed_ai', name: 'PubMed + AI' }, { id: 'chembl', name: 'ChEMBL' }, { id: 'semantic_scholar', name: 'Semantic Scholar' }],
  documentation: [{ id: 'fda_ind', name: 'FDA IND Report' }, { id: 'scientific', name: 'Scientific Summary' }, { id: 'full_report', name: 'Full Tech Report' }],
}

const EXAMPLE_SEQUENCES = [
  {
    label: 'Insulin',
    value: 'MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKT',
    emoji: '💉',
  },
  {
    label: 'Barnase',
    value: 'MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTL',
    emoji: '🧬',
  },
]

function StatusBadgeStyled({ status }: { status: string }) {
  const variant = status as 'pending' | 'running' | 'completed' | 'failed'
  return (
    <Badge variant={variant} pulse={status === 'running'}>
      {status}
    </Badge>
  )
}

/* ──────────────────────────────────────────────────────
   Login Screen
   ────────────────────────────────────────────────────── */
function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('researcher@bioos.dev')
  const [password, setPassword] = useState('bioos2024')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
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
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid" />
      <div className="absolute w-[500px] h-[500px] -top-32 -left-32 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute w-[400px] h-[400px] -bottom-32 -right-32 bg-cyan-500/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-[420px] mx-4">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your research workspace</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
          <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Demo: <code className="text-emerald-400/70 bg-emerald-500/5 px-1.5 py-0.5 rounded">researcher@bioos.dev</code> / <code className="text-emerald-400/70 bg-emerald-500/5 px-1.5 py-0.5 rounded">bioos2024</code>
        </p>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────
   Sidebar Navigation
   ────────────────────────────────────────────────────── */
function Sidebar({
  activeTab,
  setActiveTab,
  runsCount,
  onOpenAI,
}: {
  activeTab: string
  setActiveTab: (tab: 'submit' | 'workflow' | 'runs') => void
  runsCount: number
  onOpenAI: () => void
}) {
  const navItems = [
    {
      id: 'workflow' as const,
      label: 'Visual Builder',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>,
    },
    {
      id: 'submit' as const,
      label: 'Form Builder',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>,
    },
    {
      id: 'runs' as const,
      label: 'Pipeline Runs',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
      badge: runsCount > 0 ? runsCount : undefined,
    },
  ]

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card/30 min-h-screen">
      <div className="p-5 border-b border-border">
        <Logo size="md" />
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === item.id
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            {item.icon}
            {item.label}
            {item.badge && (
              <span className="ml-auto text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 rounded-full px-2 py-0.5 border border-emerald-500/20">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-border space-y-3">
        {/* AI Assistant Button */}
        <Button
          onClick={onOpenAI}
          variant="glow"
          size="sm"
          className="w-full justify-start gap-3"
        >
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500/20 to-emerald-500/20 border border-violet-500/30 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          AI Assistant
          <div className="ml-auto">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
            </span>
          </div>
        </Button>

        <div className="rounded-lg bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border border-emerald-500/10 p-3">
          <p className="text-xs font-medium text-foreground mb-1">Compute Credits</p>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-lg font-bold text-emerald-400">$530</span>
            <span className="text-xs text-muted-foreground">remaining</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full w-4/5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" />
          </div>
        </div>
      </div>
    </aside>
  )
}

/* ──────────────────────────────────────────────────────
   Top Header Bar
   ────────────────────────────────────────────────────── */
function TopBar({
  apiHealth,
  onSignOut,
  activeTab,
  setActiveTab,
}: {
  apiHealth: 'checking' | 'ok' | 'error'
  onSignOut: () => void
  activeTab: string
  setActiveTab: (tab: 'submit' | 'workflow' | 'runs') => void
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b border-border bg-background/80 backdrop-blur-xl">
      {/* Mobile nav */}
      <div className="flex lg:hidden items-center gap-2">
        <Logo size="sm" />
      </div>

      {/* Mobile tabs */}
      <div className="flex lg:hidden items-center gap-1 bg-secondary/50 rounded-lg p-1">
        {(['workflow', 'submit', 'runs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
              activeTab === tab
                ? "bg-emerald-500/10 text-emerald-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === 'workflow' ? 'Visual' : tab === 'submit' ? 'Form' : 'Runs'}
          </button>
        ))}
      </div>

      {/* Page title - desktop */}
      <div className="hidden lg:block">
        <h1 className="text-lg font-semibold text-foreground">
          {activeTab === 'workflow' ? 'Visual Builder' : activeTab === 'submit' ? 'Form Builder' : 'Pipeline Runs'}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {apiHealth === 'ok' && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              apiHealth === 'ok' ? 'bg-emerald-500' : apiHealth === 'error' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'
            )} />
          </span>
          <span className={cn(
            "text-xs font-medium",
            apiHealth === 'ok' ? 'text-emerald-400' : apiHealth === 'error' ? 'text-red-400' : 'text-amber-400'
          )}>
            {apiHealth === 'ok' ? 'API Online' : apiHealth === 'error' ? 'API Offline' : 'Checking…'}
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        <button
          onClick={onSignOut}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}

/* ──────────────────────────────────────────────────────
   Pipeline Submit Form
   ────────────────────────────────────────────────────── */
function SubmitView({
  sequence,
  setSequence,
  runName,
  setRunName,
  enabledSteps,
  setEnabledSteps,
  stepTools,
  setStepTools,
  submitting,
  error,
  apiHealth,
  onSubmit,
}: {
  sequence: string
  setSequence: (s: string) => void
  runName: string
  setRunName: (s: string) => void
  enabledSteps: Record<string, boolean>
  setEnabledSteps: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  stepTools: Record<string, string>
  setStepTools: React.Dispatch<React.SetStateAction<Record<string, string>>>
  submitting: boolean
  error: string | null
  apiHealth: string
  onSubmit: () => void
}) {
  const enabledCount = Object.values(enabledSteps).filter(Boolean).length

  return (
    <div className="grid lg:grid-cols-5 gap-6 animate-fade-in">
      {/* Main form */}
      <div className="lg:col-span-3 space-y-6">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-secondary/20 pb-4">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>
              </div>
              Submit Pipeline Run
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            {/* Quick fill */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Quick fill sequence</p>
              <div className="flex gap-2">
                {EXAMPLE_SEQUENCES.map(ex => (
                  <button
                    key={ex.label}
                    onClick={() => setSequence(ex.value)}
                    className="group flex items-center gap-2 text-xs px-3.5 py-2 rounded-lg bg-secondary/50 border border-border text-muted-foreground hover:text-foreground hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-200"
                  >
                    <span>{ex.emoji}</span>
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Run name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Run name</label>
              <Input
                value={runName}
                onChange={e => setRunName(e.target.value)}
                placeholder="My Pipeline Run"
              />
            </div>

            {/* Sequence */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Sequence <span className="text-red-400">*</span>
                </label>
                {sequence.length > 0 && (
                  <span className="text-xs text-muted-foreground">{sequence.length} residues</span>
                )}
              </div>
              <Textarea
                value={sequence}
                onChange={e => setSequence(e.target.value)}
                rows={5}
                placeholder="Paste amino acid sequence (standard 20 amino acids)…"
                className="font-mono text-xs"
              />
            </div>

            {/* Pipeline steps */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Pipeline steps</p>
                <span className="text-xs text-muted-foreground">
                  {enabledCount} of {STEP_NAMES.length} enabled
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STEP_NAMES.map(step => {
                  const meta = STEP_META[step]
                  const enabled = enabledSteps[step] ?? false
                  const tools = STEP_TOOLS[step] ?? []
                  const selectedTool = stepTools[step] ?? tools[0]?.id ?? ''
                  return (
                    <div
                      key={step}
                      className={cn(
                        "rounded-lg border transition-all duration-200",
                        enabled
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-border bg-secondary/20"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setEnabledSteps(prev => ({ ...prev, [step]: !prev[step] }))}
                        className="flex items-center gap-3 p-3 w-full text-left"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                          enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground"
                        )}>
                          {meta.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            "text-sm font-medium",
                            enabled ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {meta.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">{meta.desc}</p>
                        </div>
                        <div className={cn(
                          "ml-auto w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all",
                          enabled
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-border"
                        )}>
                          {enabled && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          )}
                        </div>
                      </button>
                      {enabled && tools.length > 1 && (
                        <div className="px-3 pb-2.5">
                          <select
                            value={selectedTool}
                            onChange={e => setStepTools(prev => ({ ...prev, [step]: e.target.value }))}
                            className="w-full text-[11px] font-medium rounded-md px-2 py-1.5 bg-emerald-500/8 border border-emerald-500/20 text-emerald-300 focus:outline-none focus:border-emerald-500/40 cursor-pointer"
                          >
                            {tools.map(t => (
                              <option key={t.id} value={t.id} style={{ background: '#0f172a', color: '#e2e8f0' }}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                {error}
              </div>
            )}

            <Button
              onClick={onSubmit}
              disabled={submitting || !sequence.trim() || apiHealth !== 'ok'}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting pipeline…
                </>
              ) : (
                <>
                  Run Pipeline
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right sidebar — pipeline overview */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-secondary/20 pb-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
              Pipeline Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="space-y-3">
              {STEP_NAMES.map((step, i) => {
                const meta = STEP_META[step]
                const enabled = enabledSteps[step] ?? false
                return (
                  <div key={step} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors border",
                        enabled
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-secondary text-muted-foreground border-border"
                      )}>
                        {i + 1}
                      </div>
                      {i < STEP_NAMES.length - 1 && (
                        <div className={cn(
                          "w-px h-6 mt-1 transition-colors",
                          enabled ? "bg-emerald-500/20" : "bg-border"
                        )} />
                      )}
                    </div>
                    <div className="pb-2">
                      <p className={cn(
                        "text-sm font-medium transition-colors",
                        enabled ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {meta.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{meta.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border-emerald-500/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Pro tip</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enable <span className="text-emerald-400 font-medium">Structure Prediction</span> +{' '}
                  <span className="text-emerald-400 font-medium">Docking</span> +{' '}
                  <span className="text-emerald-400 font-medium">ADMET</span> for a
                  complete drug discovery pipeline.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────
   Runs List View
   ────────────────────────────────────────────────────── */
function RunsView({
  runs,
  onGoToSubmit,
  onAnalyzeWithAI,
}: {
  runs: PipelineRun[]
  onGoToSubmit: () => void
  onAnalyzeWithAI: (runId: string) => void
}) {
  if (runs.length === 0) {
    return (
      <div className="animate-fade-in">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No pipeline runs yet</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Submit your first pipeline to see results here.
              Start with a sample sequence to explore the platform.
            </p>
            <Button onClick={onGoToSubmit} variant="glow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>
              Create Pipeline
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        {[
          { label: 'Total', value: runs.length, color: 'text-foreground' },
          { label: 'Running', value: runs.filter(r => r.status === 'running').length, color: 'text-cyan-400' },
          { label: 'Completed', value: runs.filter(r => r.status === 'completed').length, color: 'text-emerald-400' },
          { label: 'Failed', value: runs.filter(r => r.status === 'failed').length, color: 'text-red-400' },
        ].map(stat => (
          <Card key={stat.label} className="bg-card/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Runs */}
      {runs.map((run, i) => (
        <Card
          key={run.id}
          className="overflow-hidden hover:border-emerald-500/20 transition-all duration-300"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <CardContent className="p-5 space-y-4">
            {/* Run header */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="font-semibold text-foreground">{run.name}</span>
                  <StatusBadgeStyled status={run.status} />
                </div>
                <p className="text-xs text-muted-foreground font-mono">{run.id}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onAnalyzeWithAI(run.id)}
                  className="text-muted-foreground hover:text-violet-400 w-8 h-8"
                  title="Analyze with AI Assistant"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </Button>
                <span className="text-xs text-muted-foreground">
                  {new Date(run.created_at).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Sequence preview */}
            <div className="rounded-lg bg-secondary/30 border border-border px-3.5 py-2.5">
              <p className="text-[11px] text-muted-foreground font-mono truncate">
                {run.target_sequence.slice(0, 90)}{run.target_sequence.length > 90 ? '…' : ''}
              </p>
            </div>

            {/* Error */}
            {run.error_message && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                {run.error_message}
              </div>
            )}

            {/* Steps */}
            {run.steps.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Steps</p>
                <div className="grid gap-2">
                  {run.steps.map(step => {
                    const meta = STEP_META[step.step_name] || { label: step.step_name, icon: null }
                    return (
                      <div
                        key={step.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-secondary/20 border border-border/50"
                      >
                        <StatusBadgeStyled status={step.status} />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-foreground">
                            {meta.label || step.step_name.replace('_', ' ')}
                          </span>
                          {step.agent_reasoning && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                              {step.agent_reasoning}
                            </p>
                          )}
                          {step.error_message && (
                            <p className="text-xs text-red-400 mt-1">{step.error_message}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────────────────
   Main Dashboard
   ────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null)
  const [sequence, setSequence] = useState('')
  const [runName, setRunName] = useState('My Pipeline Run')
  const [enabledSteps, setEnabledSteps] = useState<Record<string, boolean>>({
    folding: true, binding_site: false, docking: true, admet: true, literature: false, documentation: false,
  })
  const [stepTools, setStepTools] = useState<Record<string, string>>({
    folding: 'alphafold3', binding_site: 'p2rank', docking: 'diffdock',
    admet: 'admetlab', literature: 'pubmed_ai', documentation: 'fda_ind',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runs, setRuns] = useState<PipelineRun[]>([])
  const [activeTab, setActiveTab] = useState<'workflow' | 'submit' | 'runs'>('workflow')
  const [apiHealth, setApiHealth] = useState<'checking' | 'ok' | 'error'>('checking')
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(undefined)

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

  async function submitRun(pipeline_config?: any) {
    if (!sequence.trim() || !token) return
    setError(null)
    setSubmitting(true)
    try {
      const config = pipeline_config || STEP_NAMES.map(name => ({
        step_name: name, enabled: enabledSteps[name] ?? false,
        params: { tool: stepTools[name] ?? '' },
      }))
      const res = await fetch(`${API}/api/pipelines`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: runName, target_sequence: sequence.trim(), pipeline_config: config }),
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

  if (!token) return <LoginScreen onLogin={setToken} />

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        runsCount={runs.length}
        onOpenAI={() => setShowAIAssistant(true)}
      />

      <div className="flex-1 flex flex-col min-h-screen">
        <TopBar
          apiHealth={apiHealth}
          onSignOut={() => setToken(null)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <main className={cn(
          "flex-1",
          activeTab === 'workflow' ? "" : "p-6 lg:p-8 max-w-6xl w-full mx-auto"
        )}>
          {activeTab === 'workflow' && (
            <div className="h-screen flex flex-col">
              {/* Sequence Input Panel */}
              <div className="border-b border-border bg-card/50 p-4">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Run name</label>
                    <Input
                      value={runName}
                      onChange={e => setRunName(e.target.value)}
                      placeholder="My Pipeline Run"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">
                        Sequence <span className="text-red-400">*</span>
                      </label>
                      {sequence.length > 0 && (
                        <span className="text-xs text-muted-foreground">{sequence.length} residues</span>
                      )}
                    </div>
                    <Textarea
                      value={sequence}
                      onChange={e => setSequence(e.target.value)}
                      rows={3}
                      placeholder="Paste amino acid sequence..."
                      className="font-mono text-xs bg-background resize-none"
                    />
                  </div>
                </div>
                <div className="max-w-6xl mx-auto mt-4">
                  <div className="flex items-center gap-2">
                    {EXAMPLE_SEQUENCES.map(ex => (
                      <button
                        key={ex.label}
                        onClick={() => setSequence(ex.value)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-muted-foreground hover:text-foreground hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-200"
                      >
                        <span className="mr-1">{ex.emoji}</span>
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Workflow Builder */}
              <div className="flex-1">
                <WorkflowBuilder
                  onSubmitPipeline={submitRun}
                  sequence={sequence}
                  runName={runName}
                  token={token || undefined}
                />
              </div>
            </div>
          )}
          {activeTab === 'submit' && (
            <SubmitView
              sequence={sequence}
              setSequence={setSequence}
              runName={runName}
              setRunName={setRunName}
              enabledSteps={enabledSteps}
              setEnabledSteps={setEnabledSteps}
              stepTools={stepTools}
              setStepTools={setStepTools}
              submitting={submitting}
              error={error}
              apiHealth={apiHealth}
              onSubmit={() => submitRun()}
            />
          )}
          {activeTab === 'runs' && (
            <RunsView 
              runs={runs} 
              onGoToSubmit={() => setActiveTab('workflow')}
              onAnalyzeWithAI={(runId) => {
                setSelectedRunId(runId)
                setShowAIAssistant(true)
              }}
            />
          )}
        </main>
      </div>

      {/* AI Research Assistant */}
      {showAIAssistant && token && (
        <AIResearchAssistant
          token={token}
          currentRunId={selectedRunId}
          onClose={() => setShowAIAssistant(false)}
        />
      )}
    </div>
  )
}
