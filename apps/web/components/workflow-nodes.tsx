'use client'

import { createContext, useContext } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { cn } from '@/lib/utils'

/* ─── Tool Variants per step ───────────────────────────────────── */
export const TOOL_VARIANTS: Record<string, Array<{
  id: string; name: string; desc: string; badge: string; recommended?: boolean
}>> = {
  folding: [
    { id: 'alphafold3', name: 'AlphaFold 3', desc: 'Highest accuracy for novel proteins', badge: 'Recommended', recommended: true },
    { id: 'esmfold', name: 'ESMFold', desc: 'Fast, ideal for large-scale screening', badge: '⚡ Fast' },
    { id: 'openfold', name: 'OpenFold', desc: 'Open-source, fully reproducible', badge: '🔓 Open' },
  ],
  binding_site: [
    { id: 'p2rank', name: 'P2Rank', desc: 'ML-based pocket detection, best recall', badge: 'Recommended', recommended: true },
    { id: 'fpocket', name: 'FPocket', desc: 'Fast geometry-based detection', badge: '⚡ Fast' },
    { id: 'sitemap', name: 'SiteMap', desc: 'Schrödinger high-accuracy tool', badge: '🎯 Accurate' },
  ],
  docking: [
    { id: 'diffdock', name: 'DiffDock', desc: 'Diffusion model, state-of-the-art', badge: 'Recommended', recommended: true },
    { id: 'autodock_vina', name: 'AutoDock Vina', desc: 'Classical, widely validated', badge: '✓ Classic' },
    { id: 'gnina', name: 'Gnina', desc: 'Deep learning scoring function', badge: '🤖 DL' },
  ],
  admet: [
    { id: 'admetlab', name: 'ADMETlab 2.0', desc: 'Most comprehensive ADMET endpoints', badge: 'Recommended', recommended: true },
    { id: 'swissadme', name: 'SwissADME', desc: 'Comprehensive ADME prediction', badge: '📊 Full' },
    { id: 'pkcsm', name: 'pkCSM', desc: 'Graph-based ML prediction', badge: '🤖 ML' },
  ],
  literature: [
    { id: 'pubmed_ai', name: 'PubMed + AI', desc: 'NLP-powered biomedical retrieval', badge: 'Recommended', recommended: true },
    { id: 'chembl', name: 'ChEMBL', desc: 'Drug-like molecule database', badge: '💊 Drugs' },
    { id: 'semantic_scholar', name: 'Semantic Scholar', desc: 'AI-powered paper discovery', badge: '🤖 AI' },
  ],
  documentation: [
    { id: 'fda_ind', name: 'FDA IND Report', desc: 'Regulatory-ready IND format', badge: 'Recommended', recommended: true },
    { id: 'scientific', name: 'Scientific Summary', desc: 'Publication-ready report', badge: '📄 Academic' },
    { id: 'full_report', name: 'Full Tech Report', desc: 'Comprehensive technical document', badge: '📋 Full' },
  ],
}

/* ─── Step colour themes (inline styles to avoid Tailwind purge) ── */
export const STEP_THEME: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  folding:       { color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.35)',  glow: 'rgba(16,185,129,0.18)' },
  binding_site:  { color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.35)',   glow: 'rgba(6,182,212,0.18)'  },
  docking:       { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.35)',  glow: 'rgba(139,92,246,0.18)' },
  admet:         { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.35)',  glow: 'rgba(245,158,11,0.18)' },
  literature:    { color: '#ec4899', bg: 'rgba(236,72,153,0.08)',  border: 'rgba(236,72,153,0.35)',  glow: 'rgba(236,72,153,0.18)' },
  documentation: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.35)', glow: 'rgba(59,130,246,0.18)'  },
}

/* ─── Shared context so nodes can update their own data ────────── */
interface WorkflowContextType {
  handleNodeDataChange: (nodeId: string, data: Record<string, unknown>) => void
}
export const WorkflowContext = createContext<WorkflowContextType>({ handleNodeDataChange: () => {} })

/* ─── Shared types ─────────────────────────────────────────────── */
export interface CustomNodeData {
  label: string
  icon: string
  description: string
  stepType?: string
  status?: 'idle' | 'running' | 'completed' | 'failed'
  selectedTool?: string
  isConnectable?: boolean
}

/* ─── Status indicator ─────────────────────────────────────────── */
function StatusDot({ status }: { status: string }) {
  if (status === 'running') return (
    <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
    </span>
  )
  if (status === 'completed') return (
    <span className="absolute top-3 right-3 w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3.5"><path d="M20 6 9 17l-5-5"/></svg>
    </span>
  )
  if (status === 'failed') return (
    <span className="absolute top-3 right-3 w-5 h-5 bg-red-500/20 rounded-full flex items-center justify-center">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </span>
  )
  return null
}

/* ─── Pipeline step node ───────────────────────────────────────── */
export function PipelineStepNode({ data, selected, id }: NodeProps<CustomNodeData>) {
  const { label, icon, description, status = 'idle', stepType = 'folding', selectedTool, isConnectable = true } = data
  const { handleNodeDataChange } = useContext(WorkflowContext)

  const theme = STEP_THEME[stepType] || STEP_THEME.folding
  const variants = TOOL_VARIANTS[stepType] || []
  const currentTool = variants.find(v => v.id === selectedTool) || variants[0]

  const borderColor = status === 'running'   ? 'rgba(6,182,212,0.6)'
                    : status === 'completed' ? 'rgba(16,185,129,0.6)'
                    : status === 'failed'    ? 'rgba(239,68,68,0.6)'
                    : selected               ? theme.color + '80'
                    : theme.border

  const boxShadow = selected
    ? `0 0 0 2px ${theme.color}30, 0 8px 24px ${theme.glow}, 0 4px 16px rgba(0,0,0,0.4)`
    : `0 4px 16px rgba(0,0,0,0.25), 0 0 0 1px ${theme.border}`

  return (
    <div
      style={{
        borderColor,
        background: `linear-gradient(135deg, ${theme.bg}, rgba(10,15,30,0.88))`,
        boxShadow,
        minWidth: 252,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      className="relative rounded-2xl border-2 backdrop-blur-md overflow-hidden hover:-translate-y-0.5 cursor-pointer"
    >
      {/* Accent top bar */}
      <div style={{ background: `linear-gradient(90deg, ${theme.color}80, transparent)`, height: 2 }} />

      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        style={{ background: theme.color, borderColor: 'rgba(255,255,255,0.85)', width: 14, height: 14, boxShadow: `0 0 8px ${theme.glow}` }}
        className="!border-2 !rounded-full"
      />

      <StatusDot status={status} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            style={{ background: `linear-gradient(135deg, ${theme.color}25, ${theme.color}10)`, borderColor: `${theme.color}30` }}
            className="w-11 h-11 rounded-xl border flex items-center justify-center text-xl flex-shrink-0 shadow-sm"
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-foreground leading-tight">{label}</h4>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{description}</p>
          </div>
        </div>

        {/* Always-visible compact tool selector */}
        {variants.length > 1 && (
          <div className="mt-3 pt-2.5" style={{ borderTop: `1px solid ${theme.color}18` }}>
            <select
              value={currentTool?.id || ''}
              onChange={e => {
                e.stopPropagation()
                handleNodeDataChange(id, { selectedTool: e.target.value })
              }}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              className="w-full text-[11px] font-semibold rounded-lg px-2.5 py-1.5 appearance-none cursor-pointer focus:outline-none"
              style={{
                background: `${theme.color}10`,
                color: theme.color,
                border: `1px solid ${theme.color}30`,
              }}
            >
              {variants.map(v => (
                <option key={v.id} value={v.id} style={{ background: '#0f172a', color: '#e2e8f0' }}>
                  {v.name}{v.recommended ? ' ★' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        style={{ background: theme.color, borderColor: 'rgba(255,255,255,0.85)', width: 14, height: 14, boxShadow: `0 0 8px ${theme.glow}` }}
        className="!border-2 !rounded-full"
      />
    </div>
  )
}

/* ─── Input (START) node ───────────────────────────────────────── */
export function InputNode({ data, selected }: NodeProps<CustomNodeData>) {
  const { label, icon, description, isConnectable = true } = data
  return (
    <div
      style={{
        borderColor: selected ? 'rgba(16,185,129,0.75)' : 'rgba(16,185,129,0.38)',
        background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.04))',
        boxShadow: selected
          ? '0 0 0 2px rgba(16,185,129,0.25), 0 8px 24px rgba(16,185,129,0.18)'
          : '0 4px 16px rgba(0,0,0,0.25)',
        minWidth: 230,
      }}
      className="relative rounded-2xl border-2 backdrop-blur-md overflow-hidden hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
    >
      <div style={{ background: 'linear-gradient(90deg, #10b981, transparent)', height: 2 }} />
      {/* START badge */}
      <div className="absolute -top-2 -left-2 w-5 h-5 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/30 flex items-center justify-center">
        <div className="w-2 h-2 bg-white rounded-full" />
      </div>
      <div className="p-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-xl flex-shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h4 className="text-sm font-bold text-emerald-400">{label}</h4>
              <span className="text-[10px] bg-emerald-500/12 text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">START</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        style={{ background: '#10b981', borderColor: 'rgba(255,255,255,0.85)', width: 14, height: 14, boxShadow: '0 0 8px rgba(16,185,129,0.4)' }}
        className="!border-2 !rounded-full"
      />
    </div>
  )
}

/* ─── Output (END) node ────────────────────────────────────────── */
export function OutputNode({ data, selected }: NodeProps<CustomNodeData>) {
  const { label, icon, description, isConnectable = true } = data
  return (
    <div
      style={{
        borderColor: selected ? 'rgba(139,92,246,0.75)' : 'rgba(139,92,246,0.38)',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(109,40,217,0.04))',
        boxShadow: selected
          ? '0 0 0 2px rgba(139,92,246,0.25), 0 8px 24px rgba(139,92,246,0.18)'
          : '0 4px 16px rgba(0,0,0,0.25)',
        minWidth: 230,
      }}
      className="relative rounded-2xl border-2 backdrop-blur-md overflow-hidden hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
    >
      <div style={{ background: 'linear-gradient(90deg, #8b5cf6, transparent)', height: 2 }} />
      {/* END badge */}
      <div className="absolute -top-2 -right-2 w-5 h-5 bg-violet-500 rounded-full shadow-lg shadow-violet-500/30 flex items-center justify-center">
        <div className="w-2 h-2 bg-white rounded-full" />
      </div>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        style={{ background: '#8b5cf6', borderColor: 'rgba(255,255,255,0.85)', width: 14, height: 14, boxShadow: '0 0 8px rgba(139,92,246,0.4)' }}
        className="!border-2 !rounded-full"
      />
      <div className="p-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-xl flex-shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h4 className="text-sm font-bold text-violet-400">{label}</h4>
              <span className="text-[10px] bg-violet-500/12 text-violet-400 px-2 py-0.5 rounded-full font-bold border border-violet-500/20">END</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export const nodeTypes = {
  pipelineStep: PipelineStepNode,
  input: InputNode,
  output: OutputNode,
}
