import Link from 'next/link'
import { Logo } from '@/components/ui/logo'

function HeroOrb({ className }: { className?: string }) {
  return (
    <div className={`absolute rounded-full blur-3xl opacity-20 ${className}`} />
  )
}

function FeatureCard({
  icon,
  title,
  description,
  gradient,
  delay,
}: {
  icon: React.ReactNode
  title: string
  description: string
  gradient: string
  delay: string
}) {
  return (
    <div
      className="group relative rounded-2xl border border-border bg-card/50 p-8 transition-all duration-500 hover:border-emerald-500/30 hover:bg-card/80 hover:shadow-lg hover:shadow-emerald-500/5"
      style={{ animationDelay: delay }}
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative">
        <div className={`inline-flex rounded-xl p-3 ${gradient} mb-5`}>
          {icon}
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-3">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

function PipelineStep({ label, index }: { label: string; index: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
        {index}
      </div>
      <span className="text-sm text-slate-300 font-medium">{label}</span>
    </div>
  )
}

function Connector() {
  return (
    <div className="flex items-center justify-center w-8">
      <div className="h-6 w-px bg-gradient-to-b from-emerald-500/40 to-cyan-500/40" />
    </div>
  )
}

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* ─── Background Effects ─── */}
      <div className="absolute inset-0 bg-grid" />
      <HeroOrb className="w-[600px] h-[600px] -top-48 -left-48 bg-emerald-500" />
      <HeroOrb className="w-[500px] h-[500px] top-1/4 -right-32 bg-cyan-500" />
      <HeroOrb className="w-[400px] h-[400px] bottom-0 left-1/3 bg-violet-500 opacity-10" />

      {/* ─── Nav ─── */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5 max-w-7xl mx-auto">
        <Logo size="md" />
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all duration-200"
          >
            Launch App
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-20 lg:pt-32 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — Copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-400">Powered by Modal GPU &amp; Tamarind Bio</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold leading-[1.08] tracking-tight mb-6">
              <span className="text-foreground">The operating</span>
              <br />
              <span className="text-foreground">system for </span>
              <span className="text-gradient">biology</span>
            </h1>

            <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-xl mb-10">
              Orchestrate protein folding, docking simulations, and ADMET screening
              through autonomous AI agent pipelines. From sequence to FDA-grade report
              in minutes.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-base shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 hover:shadow-emerald-400/30 transition-all duration-200"
              >
                Start a Pipeline
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-border text-foreground font-medium text-base hover:bg-secondary transition-all duration-200"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub
              </a>
            </div>
          </div>

          {/* Right — Pipeline visualization */}
          <div className="relative hidden lg:block">
            <div className="relative rounded-2xl border border-border bg-card/80 p-8 backdrop-blur-sm">
              {/* Decorative glow behind card */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 -z-10 blur-sm" />

              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="ml-3 text-xs text-muted-foreground font-mono">pipeline.exec()</span>
              </div>

              <div className="space-y-0">
                <PipelineStep label="Sequence Ingestion & Validation" index={1} />
                <Connector />
                <PipelineStep label="Structure Prediction (AlphaFold 3)" index={2} />
                <Connector />
                <PipelineStep label="Binding Site Detection" index={3} />
                <Connector />
                <PipelineStep label="Molecular Docking (DiffDock)" index={4} />
                <Connector />
                <PipelineStep label="ADMET Screening & Drug-likeness" index={5} />
                <Connector />
                <PipelineStep label="MoE Analysis → Final Report" index={6} />
              </div>

              <div className="mt-6 pt-5 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="font-medium text-emerald-400">Running on Modal A100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating elements */}
            <div className="absolute -top-4 -right-4 rounded-xl border border-border bg-card/90 backdrop-blur-sm px-4 py-3 shadow-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">pLDDT: 92.4</p>
                  <p className="text-[10px] text-muted-foreground">High confidence</p>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-3 -left-3 rounded-xl border border-border bg-card/90 backdrop-blur-sm px-4 py-3 shadow-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">FDA Compliant</p>
                  <p className="text-[10px] text-muted-foreground">Audit trail ready</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pb-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Everything you need for
            <span className="text-gradient-emerald"> computational biology</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From a single protein sequence to a complete analysis report — BioOS handles
            the orchestration so you can focus on science.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>}
            title="Multi-Agent Pipelines"
            description="AlphaFold 3, ESMFold, DiffDock, and ADMET models orchestrated by Claude AI agents working in concert."
            gradient="bg-emerald-500/10"
            delay="0ms"
          />
          <FeatureCard
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
            title="Compliance Ready"
            description="FDA-grade documentation with full audit trails, reproducibility guarantees, and regulatory compliance built in."
            gradient="bg-cyan-500/10"
            delay="100ms"
          />
          <FeatureCard
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>}
            title="Real-time Monitoring"
            description="Watch pipelines execute live with step-by-step agent reasoning, confidence scores, and 3D structure visualization."
            gradient="bg-violet-500/10"
            delay="200ms"
          />
          <FeatureCard
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><path d="M8 21h8M12 17v4" /></svg>}
            title="Modal GPU Compute"
            description="Heavy workloads dispatch to serverless A100 GPUs through Modal. Pay only for compute you use."
            gradient="bg-amber-500/10"
            delay="300ms"
          />
          <FeatureCard
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>}
            title="MoE Analysis"
            description="Three expert AI agents — Statistician, Critic, and Synthesizer — review every result with scientific rigor."
            gradient="bg-pink-500/10"
            delay="400ms"
          />
          <FeatureCard
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>}
            title="Visual Pipeline Builder"
            description="Compose workflows visually with a drag-and-drop interface. Connect models and analyses like building blocks."
            gradient="bg-emerald-500/10"
            delay="500ms"
          />
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pb-24">
        <div className="relative rounded-3xl overflow-hidden border border-emerald-500/20">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-card to-cyan-500/10" />
          <div className="relative px-8 py-16 lg:px-16 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Ready to accelerate your research?
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
              Start running computational biology pipelines in minutes.
              No infrastructure setup required.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-emerald-500 text-white font-semibold text-lg shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 hover:shadow-emerald-400/30 transition-all duration-200"
            >
              Open Dashboard
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8 flex items-center justify-between">
          <Logo size="sm" />
          <p className="text-xs text-muted-foreground">
            Built with Modal, Tamarind Bio, Claude AI &amp; LangGraph
          </p>
        </div>
      </footer>
    </div>
  )
}