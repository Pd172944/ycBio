'use client'

import { useCallback, useState, useMemo, useRef, useEffect } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { cn } from '@/lib/utils'
import { nodeTypes, WorkflowContext, TOOL_VARIANTS, STEP_THEME } from './workflow-nodes'
import { Button } from '@/components/ui/button'

/* ─── Step metadata ────────────────────────────────────────────── */
const STEP_META: Record<string, { label: string; desc: string; icon: string; detail: string }> = {
  folding:       { label: 'Structure Prediction', desc: 'AlphaFold 3 / ESMFold via Modal → Tamarind', icon: '🧬', detail: 'Predicts 3D protein structure from sequence using deep learning.' },
  binding_site:  { label: 'Binding Site',         desc: 'Pocket detection & druggability analysis',  icon: '🔍', detail: 'Identifies and scores druggable pockets on the predicted structure.' },
  docking:       { label: 'Molecular Docking',    desc: 'DiffDock / AutoDock Vina simulations',      icon: '🔬', detail: 'Simulates small-molecule binding to identified pockets.' },
  admet:         { label: 'ADMET Screening',      desc: 'Drug-likeness & ADMET property prediction', icon: '💊', detail: 'Predicts absorption, distribution, metabolism, excretion & toxicity.' },
  literature:    { label: 'Literature Search',    desc: 'PubMed / ChEMBL retrieval & analysis',      icon: '📚', detail: 'Retrieves and summarises relevant papers and known compounds.' },
  documentation: { label: 'FDA Report',           desc: 'FDA-grade documentation generation',        icon: '📄', detail: 'Generates IND-ready regulatory documentation from pipeline results.' },
}

/* ─── Pipeline templates ───────────────────────────────────────── */
const TEMPLATES = [
  { id: 'drug_discovery', label: 'Drug Discovery', icon: '💊', color: '#10b981', steps: ['folding','binding_site','docking','admet','literature','documentation'] },
  { id: 'protein_analysis', label: 'Protein Analysis', icon: '🧬', color: '#06b6d4', steps: ['folding','binding_site','literature'] },
  { id: 'quick_screen', label: 'Quick Screen', icon: '⚡', color: '#f59e0b', steps: ['folding','docking','admet'] },
]

/* ─── Initial nodes ────────────────────────────────────────────── */
const initialNodes: Node[] = [
  { id: 'start', type: 'input',  position: { x: 60,  y: 220 }, data: { label: 'Protein Sequence Input', icon: '🧬', description: 'Your amino acid sequence enters here', isConnectable: true } },
  { id: 'output',type: 'output', position: { x: 860, y: 220 }, data: { label: 'Analysis Report',        icon: '📊', description: 'Final FDA-grade analysis report',         isConnectable: true } },
]
const initialEdges: Edge[] = []

const defaultEdgeOptions = {
  animated: true,
  style: { strokeWidth: 2.5, stroke: '#10b981' },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981', width: 18, height: 18 },
}

/* ─── AI Guide Panel ───────────────────────────────────────────── */
interface AIGuideMessage { role: 'user' | 'assistant'; content: string }

function WorkflowAIGuide({
  nodes, sequence, token, onAddStep,
}: {
  nodes: Node[]
  sequence: string
  token?: string
  onAddStep: (stepType: string) => void
}) {
  const [messages, setMessages] = useState<AIGuideMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const stepNodes = nodes.filter(n => n.type === 'pipelineStep')
  const addedSteps = new Set(stepNodes.map(n => n.data.stepType as string))

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Context-aware next-step suggestion
  const suggestion = useMemo(() => {
    if (addedSteps.size === 0)
      return { step: 'folding', title: 'Start with Structure Prediction', body: 'AlphaFold 3 predicts your protein\'s 3D shape — the foundation of every analysis. Drag or click "+ Add" to get started.', icon: '🧬' }
    if (addedSteps.has('folding') && !addedSteps.has('binding_site'))
      return { step: 'binding_site', title: 'Add Binding Site Analysis', body: 'Your structure is predicted — now identify druggable pockets before you start docking.', icon: '🔍' }
    if (addedSteps.has('binding_site') && !addedSteps.has('docking'))
      return { step: 'docking', title: 'Add Molecular Docking', body: 'Binding sites found. Simulate how small molecules bind using DiffDock\'s diffusion model.', icon: '🔬' }
    if (addedSteps.has('docking') && !addedSteps.has('admet'))
      return { step: 'admet', title: 'Screen Drug-likeness (ADMET)', body: 'Filter your docked hits by ADMET properties before investing in wet-lab validation.', icon: '💊' }
    if (addedSteps.has('admet') && !addedSteps.has('literature'))
      return { step: 'literature', title: 'Search the Literature', body: 'Find published compounds with similar scaffolds and validate against known targets.', icon: '📚' }
    if (addedSteps.has('literature') && !addedSteps.has('documentation'))
      return { step: 'documentation', title: 'Generate FDA Report', body: 'Compile all findings into an IND-ready document suitable for regulatory submission.', icon: '📄' }
    return null
  }, [addedSteps])

  // Pipeline health checklist
  const healthItems = [
    { step: 'folding',       label: 'Structure Prediction', required: true  },
    { step: 'binding_site',  label: 'Binding Site',         required: false },
    { step: 'docking',       label: 'Molecular Docking',    required: false },
    { step: 'admet',         label: 'ADMET Screening',      required: false },
    { step: 'literature',    label: 'Literature Search',    required: false },
    { step: 'documentation', label: 'FDA Report',           required: false },
  ]

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return
    const userMsg: AIGuideMessage = { role: 'user', content: input }
    const assistantMsg: AIGuideMessage = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setIsLoading(true)

    const contextParts = [
      sequence ? `Protein sequence (${sequence.length} residues): ${sequence.slice(0, 60)}...` : '',
      addedSteps.size > 0 ? `Current pipeline steps: ${Array.from(addedSteps).join(', ')}` : 'No steps added yet',
    ].filter(Boolean).join('\n')

    try {
      const resp = await fetch('http://localhost:8000/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: input, context: { pipeline_context: contextParts }, history: messages.slice(-6) }),
      })

      if (!resp.body) throw new Error('No stream')
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const d = JSON.parse(line.slice(6))
            if (d.done) {
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: m.content || '...' } : m))
            } else if (d.content) {
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: m.content + d.content } : m))
            } else if (d.error) {
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: `Error: ${d.error}` } : m))
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages(prev => prev.map((m, i) => i === prev.length - 1
        ? { ...m, content: `Couldn't reach AI endpoint. Add steps from the palette on the left, or ask me anything about your pipeline!` }
        : m))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-80 flex flex-col border-l border-border bg-gradient-to-b from-card/60 to-card/40 backdrop-blur-sm">
      {/* Guide header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-violet-500/8 to-emerald-500/5 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-0.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-emerald-500/15 border border-violet-500/25 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">AI Pipeline Guide</p>
            <div className="flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] text-muted-foreground">Claude AI • Live</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Smart suggestion card */}
        {suggestion && (
          <div className="p-4 border-b border-border">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Next Suggested Step</p>
            <div
              className="rounded-xl p-3.5 border"
              style={{
                background: `${STEP_THEME[suggestion.step]?.color}08`,
                borderColor: `${STEP_THEME[suggestion.step]?.color}25`,
              }}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-xl leading-none mt-0.5">{suggestion.icon}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{suggestion.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{suggestion.body}</p>
                  <button
                    onClick={() => onAddStep(suggestion.step)}
                    className="mt-2.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
                    style={{ color: STEP_THEME[suggestion.step]?.color, borderColor: `${STEP_THEME[suggestion.step]?.color}40`, background: `${STEP_THEME[suggestion.step]?.color}10` }}
                  >
                    + Add to Pipeline
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline health checklist */}
        <div className="p-4 border-b border-border">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Pipeline Status</p>
          <div className="space-y-1.5">
            {healthItems.map(item => {
              const added = addedSteps.has(item.step)
              const theme = STEP_THEME[item.step]
              return (
                <div key={item.step} className="flex items-center gap-2.5">
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                    style={added
                      ? { background: theme.color + '20', borderColor: theme.color + '50', border: '1px solid' }
                      : { border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {added && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" strokeWidth="3.5" style={{ stroke: theme.color }}>
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                    )}
                  </div>
                  <span className={cn('text-xs transition-colors', added ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                    {item.label}
                  </span>
                  {item.required && !added && (
                    <span className="ml-auto text-[9px] text-amber-400 font-bold">required</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Chat messages */}
        {messages.length > 0 && (
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Chat</p>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-foreground'
                      : 'bg-secondary/60 border border-border text-foreground',
                  )}
                >
                  {msg.content || (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <span className="w-1 h-1 bg-current rounded-full animate-pulse" />
                      <span className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Empty guide state */}
        {messages.length === 0 && !suggestion && (
          <div className="p-4">
            <div className="rounded-xl bg-gradient-to-br from-violet-500/5 to-emerald-500/5 border border-white/5 p-4 text-center">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-sm font-bold text-foreground mb-1">Pipeline Complete!</p>
              <p className="text-xs text-muted-foreground leading-relaxed">All recommended steps are added. Connect them and run your pipeline, or ask me anything below.</p>
            </div>
          </div>
        )}
      </div>

      {/* Chat input */}
      <div className="p-3 border-t border-border flex-shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Ask about tools, parameters…"
            disabled={isLoading}
            className="flex-1 text-xs bg-secondary/50 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/50 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center hover:bg-violet-500/25 disabled:opacity-40 transition-all flex-shrink-0"
          >
            {isLoading
              ? <svg className="animate-spin w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Props ────────────────────────────────────────────────────── */
interface WorkflowBuilderProps {
  onSubmitPipeline?: (config: unknown) => void
  sequence?: string
  runName?: string
  token?: string
}

/* ─── Public wrapper (provides ReactFlowProvider) ──────────────── */
export function WorkflowBuilder(props: WorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner {...props} />
    </ReactFlowProvider>
  )
}

/* ─── Inner builder ────────────────────────────────────────────── */
function WorkflowBuilderInner({ onSubmitPipeline, sequence = '', runName = '', token }: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [showGuide, setShowGuide] = useState(true)
  const [showMiniMap, setShowMiniMap] = useState(false)
  const [hoveredStep, setHoveredStep] = useState<string | null>(null)
  const [draggedStep, setDraggedStep] = useState<string | null>(null)
  const reactFlow = useReactFlow()

  /* Context callback so nodes can update their own data */
  const handleNodeDataChange = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
  }, [setNodes])

  /* Connection handler */
  const onConnect = useCallback((params: Connection | Edge) => {
    setEdges(eds => addEdge({
      ...params,
      ...defaultEdgeOptions,
      id: `${params.source}-${params.target}`,
      type: 'smoothstep',
    }, eds))
  }, [setEdges])

  /* Drag-and-drop */
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/reactflow')
    if (!type) return
    const bounds = e.currentTarget.getBoundingClientRect()
    const position = reactFlow.project({ x: e.clientX - bounds.left, y: e.clientY - bounds.top })
    addStepNode(type, position)
  }, [reactFlow]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Add a step node at given position (or auto-position) */
  const addStepNode = useCallback((stepType: string, position?: { x: number; y: number }) => {
    const meta = STEP_META[stepType]
    if (!meta) return
    const existingSteps = nodes.filter(n => n.type === 'pipelineStep')
    const pos = position || {
      x: 360 + existingSteps.length * 60,
      y: 200 + (existingSteps.length % 2 === 0 ? 0 : 80),
    }
    const defaultTool = TOOL_VARIANTS[stepType]?.[0]?.id
    setNodes(nds => [...nds, {
      id: `${stepType}-${Date.now()}`,
      type: 'pipelineStep',
      position: pos,
      data: { label: meta.label, icon: meta.icon, description: meta.desc, stepType, status: 'idle', selectedTool: defaultTool, isConnectable: true },
    }])
  }, [nodes, setNodes])

  /* Load a template */
  const loadTemplate = useCallback((templateId: string) => {
    const tpl = TEMPLATES.find(t => t.id === templateId)
    if (!tpl) return
    const spacing = 260
    const startX = 350
    const centerY = 220

    const stepNodes: Node[] = tpl.steps.map((stepType, i) => ({
      id: `${stepType}-${Date.now() + i}`,
      type: 'pipelineStep',
      position: { x: startX + i * spacing, y: centerY + (i % 2 === 0 ? 0 : 60) },
      data: {
        label: STEP_META[stepType].label,
        icon: STEP_META[stepType].icon,
        description: STEP_META[stepType].desc,
        stepType,
        status: 'idle',
        selectedTool: TOOL_VARIANTS[stepType]?.[0]?.id,
        isConnectable: true,
      },
    }))

    const ioNodes = [
      { id: 'start',  type: 'input',  position: { x: 60,  y: centerY + 30 }, data: { label: 'Protein Sequence Input', icon: '🧬', description: 'Your amino acid sequence enters here', isConnectable: true } },
      { id: 'output', type: 'output', position: { x: startX + tpl.steps.length * spacing, y: centerY + 30 }, data: { label: 'Analysis Report', icon: '📊', description: 'Final FDA-grade analysis report', isConnectable: true } },
    ]

    const allNodes = [...ioNodes, ...stepNodes]

    const newEdges: Edge[] = []
    const chain = ['start', ...stepNodes.map(n => n.id), 'output']
    for (let i = 0; i < chain.length - 1; i++) {
      newEdges.push({
        id: `e-${chain[i]}-${chain[i + 1]}`,
        source: chain[i],
        target: chain[i + 1],
        ...defaultEdgeOptions,
        type: 'smoothstep',
      })
    }

    setNodes(allNodes)
    setEdges(newEdges)
    setTimeout(() => reactFlow.fitView({ padding: 0.15 }), 50)
  }, [setNodes, setEdges, reactFlow])

  /* Auto-layout */
  const autoLayout = useCallback(() => {
    const stepNodes = nodes.filter(n => n.type === 'pipelineStep')
    const spacing = 270
    const startX = 360
    const centerY = 220
    setNodes(nds => nds.map(n => {
      if (n.type === 'pipelineStep') {
        const idx = stepNodes.findIndex(s => s.id === n.id)
        return { ...n, position: { x: startX + idx * spacing, y: centerY + (idx % 2 === 0 ? 0 : 70) } }
      }
      if (n.type === 'output') return { ...n, position: { x: startX + stepNodes.length * spacing, y: centerY + 35 } }
      return n
    }))
  }, [nodes, setNodes])

  /* Pipeline config for submission */
  const generateConfig = useCallback(() => {
    const stepNodes = nodes.filter(n => n.type === 'pipelineStep')
    return (['folding','binding_site','docking','admet','literature','documentation'] as const).map(name => {
      const node = stepNodes.find(n => n.data.stepType === name)
      return { step_name: name, enabled: !!node, params: { tool: node?.data.selectedTool || TOOL_VARIANTS[name]?.[0]?.id } }
    })
  }, [nodes])

  const canSubmit = useMemo(() => {
    const hasSteps = nodes.some(n => n.type === 'pipelineStep')
    const hasPath = edges.some(e => e.source === 'start') && edges.some(e => e.target === 'output')
    return hasSteps && hasPath && sequence.trim().length > 0
  }, [nodes, edges, sequence])

  return (
    <WorkflowContext.Provider value={{ handleNodeDataChange }}>
      <div className="flex h-full bg-background" style={{ minHeight: 0 }}>
        {/* ── LEFT: Component Palette ── */}
        <div className="w-72 flex flex-col border-r border-border bg-gradient-to-b from-card/50 to-card/30 flex-shrink-0 overflow-hidden">
          {/* Palette header */}
          <div className="px-5 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Pipeline Tools</h3>
                <p className="text-[10px] text-muted-foreground">Drag or click + to add</p>
              </div>
            </div>
          </div>

          {/* Templates */}
          <div className="px-4 py-3 border-b border-border flex-shrink-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Quick Templates</p>
            <div className="space-y-1.5">
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => loadTemplate(tpl.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-transparent hover:border-white/10 hover:bg-white/[0.04] text-left transition-all duration-150 group"
                >
                  <span className="text-base leading-none">{tpl.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground group-hover:text-white">{tpl.label}</p>
                    <p className="text-[10px] text-muted-foreground">{tpl.steps.length} steps</p>
                  </div>
                  <div
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: tpl.color, background: tpl.color + '18' }}
                  >
                    Load
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Draggable step cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {Object.entries(STEP_META).map(([key, meta]) => {
              const theme = STEP_THEME[key]
              const isHovered = hoveredStep === key
              const isDragged = draggedStep === key

              return (
                <div
                  key={key}
                  className={cn('relative rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing select-none', isDragged && 'opacity-50 scale-95')}
                  style={{
                    borderColor: isHovered ? theme.color + '50' : 'rgba(255,255,255,0.06)',
                    background: isHovered ? `linear-gradient(135deg, ${theme.bg}, rgba(10,15,30,0.5))` : 'rgba(255,255,255,0.02)',
                    transform: isHovered ? 'translateY(-1px)' : undefined,
                    boxShadow: isHovered ? `0 8px 24px ${theme.glow}` : undefined,
                  }}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('application/reactflow', key)
                    e.dataTransfer.effectAllowed = 'move'
                    setDraggedStep(key)
                  }}
                  onDragEnd={() => setDraggedStep(null)}
                  onMouseEnter={() => setHoveredStep(key)}
                  onMouseLeave={() => setHoveredStep(null)}
                >
                  <div className="flex items-center gap-3 p-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${theme.color}22, ${theme.color}0a)`, border: `1px solid ${theme.color}28` }}
                    >
                      {meta.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground leading-tight">{meta.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-1">{meta.desc}</p>
                    </div>
                    {/* Click-to-add button */}
                    <button
                      onClick={e => { e.stopPropagation(); addStepNode(key) }}
                      className="w-6 h-6 rounded-md flex items-center justify-center transition-all flex-shrink-0 opacity-60 hover:opacity-100"
                      style={{ border: `1px solid ${theme.color}40`, color: theme.color, background: `${theme.color}10` }}
                      title={`Add ${meta.label}`}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                    </button>
                  </div>

                  {/* Expanded detail on hover */}
                  {isHovered && (
                    <div className="px-3 pb-3">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{meta.detail}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {TOOL_VARIANTS[key]?.map(v => (
                          <span
                            key={v.id}
                            className="text-[9px] font-medium px-1.5 py-0.5 rounded-md"
                            style={{ color: theme.color, background: theme.color + '15' }}
                          >
                            {v.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Palette tip */}
          <div className="p-3 border-t border-border flex-shrink-0">
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <span className="text-emerald-400 font-semibold">Tip:</span> Click a node on the canvas, then pick a specific tool (e.g. AlphaFold 3 vs ESMFold).
              </p>
            </div>
          </div>
        </div>

        {/* ── CENTER: Canvas ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Canvas header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/40 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm font-bold text-foreground">Workflow Canvas</p>
                <p className="text-xs text-muted-foreground">{nodes.filter(n => n.type === 'pipelineStep').length} steps · {edges.length} connections</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!canSubmit && nodes.some(n => n.type === 'pipelineStep') && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  {!sequence.trim() ? 'Add sequence above' : 'Connect nodes to run'}
                </p>
              )}
              <button
                onClick={() => setShowGuide(g => !g)}
                className={cn(
                  'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
                  showGuide
                    ? 'bg-violet-500/12 border-violet-500/30 text-violet-400'
                    : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground',
                )}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                AI Guide
              </button>
              {onSubmitPipeline && (
                <Button
                  onClick={() => onSubmitPipeline(generateConfig())}
                  disabled={!canSubmit}
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  Run Pipeline
                </Button>
              )}
            </div>
          </div>

          {/* ReactFlow canvas */}
          <div className="flex-1 relative" style={{ minHeight: 0 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              connectionMode={ConnectionMode.Loose}
              className="bg-background"
              fitView
              defaultEdgeOptions={defaultEdgeOptions}
              deleteKeyCode={['Delete', 'Backspace']}
              panOnScroll
              selectionOnDrag
              panOnDrag={[1, 2]}
              zoomOnScroll
            >
              <Controls className="!bg-card/80 !border-border !shadow-lg !rounded-xl backdrop-blur-sm" showInteractive={false} />
              <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} color="#10b981" className="opacity-[0.12]" />
              {showMiniMap && (
                <MiniMap
                  className="!bg-card/80 !border-border !shadow-lg !rounded-xl backdrop-blur-sm overflow-hidden"
                  zoomable pannable
                  nodeColor={n => n.type === 'input' ? '#10b981' : n.type === 'output' ? '#8b5cf6' : (STEP_THEME[n.data?.stepType]?.color || '#06b6d4')}
                />
              )}
            </ReactFlow>

            {/* Empty canvas hint */}
            {nodes.filter(n => n.type === 'pipelineStep').length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/40 border border-border flex items-center justify-center mx-auto mb-4 text-3xl">
                    🧬
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">Drop tools onto the canvas</p>
                  <p className="text-xs text-muted-foreground">Drag from the left panel, or use a template</p>
                </div>
              </div>
            )}

            {/* Floating action bar */}
            <div className="absolute bottom-5 right-5 flex flex-col gap-2">
              {[
                { label: 'Auto Layout', icon: <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>, action: autoLayout },
                { label: 'Toggle Minimap', icon: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>, action: () => setShowMiniMap(m => !m) },
                { label: 'Fit View', icon: <><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></>, action: () => reactFlow.fitView({ padding: 0.15 }) },
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={btn.action}
                  title={btn.label}
                  className="w-9 h-9 rounded-xl bg-card/90 border border-border hover:bg-card shadow-lg backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{btn.icon}</svg>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: AI Guide Panel ── */}
        {showGuide && (
          <WorkflowAIGuide
            nodes={nodes}
            sequence={sequence}
            token={token}
            onAddStep={addStepNode}
          />
        )}
      </div>
    </WorkflowContext.Provider>
  )
}
