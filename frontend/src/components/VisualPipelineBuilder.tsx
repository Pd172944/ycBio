import React, { useState, useRef, useCallback, useMemo } from 'react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
  rectIntersection,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { SequenceFormat } from '../types'

// ─── Types ───────────────────────────────────────────────────────────────────

export type PipelineStage = {
  id: string
  name: string
  description: string
  icon: string
}

export type CanvasStage = PipelineStage & {
  /** Unique ID for this canvas instance (stage.id + timestamp) */
  instanceId: string
  position: { x: number; y: number }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GRID = 20
const STAGE_W = 216
const STAGE_H = 80 // approximate, used for SVG port placement

function snap(v: number): number {
  return Math.round(v / GRID) * GRID
}

const AVAILABLE_STAGES: PipelineStage[] = [
  { id: 'validate', name: 'Validate', description: 'Validate sequence format and structure', icon: 'check-circle' },
  { id: 'audit',    name: 'Audit',    description: 'Check sequence quality and properties',  icon: 'magnifying-glass' },
  { id: 'predict',  name: 'Predict',  description: 'Run structure prediction models',         icon: 'cube' },
  { id: 'analyze',  name: 'Analyze',  description: 'Generate comprehensive analysis report',  icon: 'chart-bar' },
]

// ─── Icons ───────────────────────────────────────────────────────────────────

function StageIcon({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  switch (name) {
    case 'check-circle':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'magnifying-glass':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      )
    case 'cube':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      )
    case 'chart-bar':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      )
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        </svg>
      )
  }
}

// ─── Bezier Connection Arrow ─────────────────────────────────────────────────

function ConnectionArrow({ from, to, step }: { from: CanvasStage; to: CanvasStage; step: number }) {
  const x1 = from.position.x + STAGE_W
  const y1 = from.position.y + STAGE_H / 2
  const x2 = to.position.x
  const y2 = to.position.y + STAGE_H / 2
  const cp = Math.max(48, Math.abs(x2 - x1) * 0.45)
  const d = `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`
  // midpoint for step label
  const mx = (x1 + x2) / 2
  const my = Math.min(y1, y2) - 14

  return (
    <g>
      {/* Glow backing */}
      <path d={d} fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth={10} />
      {/* Main line */}
      <path d={d} fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" opacity={0.75} />
      {/* Arrow head */}
      <polygon
        points={`${x2},${y2} ${x2 - 9},${y2 - 5} ${x2 - 9},${y2 + 5}`}
        fill="#3b82f6"
        opacity={0.75}
      />
      {/* Step label */}
      <rect x={mx - 12} y={my - 9} width={24} height={16} rx={8} fill="#1e293b" />
      <text x={mx} y={my + 4} textAnchor="middle" fill="#60a5fa" fontSize={9} fontWeight={700}>
        {step}→{step + 1}
      </text>
    </g>
  )
}

// ─── Sidebar Stage (draggable) ───────────────────────────────────────────────

interface SidebarStageProps {
  stage: PipelineStage
  placed: boolean
}

function SidebarStage({ stage, placed }: SidebarStageProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sidebar-${stage.id}`,
    data: { stage },
    disabled: placed,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform) }}
      className={[
        'border rounded-xl p-3 transition-all duration-150 select-none',
        placed
          ? 'opacity-40 cursor-not-allowed border-border-subtle bg-bg-secondary'
          : isDragging
          ? 'opacity-40 cursor-grabbing border-accent-blue/50 bg-bg-elevated scale-105 shadow-2xl shadow-accent-blue/20'
          : 'cursor-grab border-border-default bg-bg-elevated hover:border-accent-blue/40 hover:shadow-md hover:shadow-black/15 active:scale-95',
      ].join(' ')}
      {...(placed ? {} : { ...attributes, ...listeners })}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${placed ? 'bg-bg-secondary text-text-muted' : 'bg-accent-blue/10 text-accent-blue'}`}>
          <StageIcon name={stage.icon} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{stage.name}</span>
            {placed && (
              <span className="text-[10px] text-text-muted bg-bg-secondary border border-border-subtle px-1.5 py-0.5 rounded-full">
                placed
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5 leading-tight">{stage.description}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Canvas Stage Card ───────────────────────────────────────────────────────

interface CanvasStageCardProps {
  stage: CanvasStage
  stepNumber: number
  onRemove: (instanceId: string) => void
}

function CanvasStageCard({ stage, stepNumber, onRemove }: CanvasStageCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `canvas-${stage.instanceId}`,
    data: { stage, sourceType: 'canvas' },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        left: stage.position.x,
        top: stage.position.y,
        width: STAGE_W,
        transform: CSS.Transform.toString(transform),
        zIndex: isDragging ? 50 : 2,
      }}
    >
      {/* Step badge */}
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-accent-blue text-white text-[10px] font-bold rounded-full shadow-lg shadow-accent-blue/30 whitespace-nowrap z-10">
        Step {stepNumber}
      </div>

      <div
        className={[
          'rounded-xl border-2 bg-bg-elevated p-3.5 transition-shadow duration-150',
          isDragging
            ? 'border-accent-blue/70 shadow-2xl shadow-accent-blue/25'
            : 'border-border-default shadow-lg shadow-black/15 hover:border-accent-blue/40 hover:shadow-xl hover:shadow-black/20',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-2">
          {/* Drag handle area */}
          <div
            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <div className="w-8 h-8 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center flex-shrink-0">
              <StageIcon name={stage.icon} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary leading-tight">{stage.name}</p>
              <p className="text-[11px] text-text-muted mt-0.5 leading-tight">{stage.description}</p>
            </div>
          </div>

          {/* Remove button — stops pointer events so drag doesn't start */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(stage.instanceId)}
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors mt-0.5"
            aria-label={`Remove ${stage.name}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Output port */}
      <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-accent-blue border-2 border-bg-primary shadow-md shadow-accent-blue/40" style={{ zIndex: 3 }} />
      {/* Input port */}
      <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-bg-elevated border-2 border-accent-blue shadow-md" style={{ zIndex: 3 }} />
    </div>
  )
}

// ─── Canvas ──────────────────────────────────────────────────────────────────

interface CanvasAreaProps {
  stages: CanvasStage[]
  orderedStages: CanvasStage[]
  onRemove: (instanceId: string) => void
  canvasRef: React.RefObject<HTMLDivElement>
}

function CanvasArea({ stages, orderedStages, onRemove, canvasRef }: CanvasAreaProps) {
  const { isOver, setNodeRef } = useDroppable({ id: 'pipeline-canvas' })

  // Merge the external ref and the droppable ref onto the same element
  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node)
      ;(canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node
    },
    [setNodeRef, canvasRef]
  )

  return (
    <div
      ref={mergedRef}
      className={[
        'relative rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden',
        isOver
          ? 'border-accent-blue bg-accent-blue/5 shadow-inner shadow-accent-blue/10'
          : 'border-border-subtle bg-bg-secondary/20',
      ].join(' ')}
      style={{
        minHeight: 520,
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`,
        backgroundSize: `${GRID}px ${GRID}px`,
      }}
    >
      {stages.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-bg-elevated border border-border-subtle flex items-center justify-center">
              <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <p className="text-text-secondary font-semibold text-sm mb-1">Build Your Pipeline</p>
            <p className="text-xs text-text-muted leading-relaxed">
              Drag stages from the left panel<br />and arrange them left-to-right
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* SVG layer for bezier connections */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 1 }}
          >
            {orderedStages.map((stage, i) => {
              const next = orderedStages[i + 1]
              if (!next) return null
              return (
                <ConnectionArrow
                  key={`${stage.instanceId}-${next.instanceId}`}
                  from={stage}
                  to={next}
                  step={i + 1}
                />
              )
            })}
          </svg>

          {/* Stage nodes */}
          {stages.map((stage) => {
            const stepNumber = orderedStages.findIndex((s) => s.instanceId === stage.instanceId) + 1
            return (
              <CanvasStageCard
                key={stage.instanceId}
                stage={stage}
                stepNumber={stepNumber}
                onRemove={onRemove}
              />
            )
          })}
        </>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface VisualPipelineBuilderProps {
  onRunAnalysis?: (sequence: string, format: SequenceFormat, stages: CanvasStage[]) => void
  onPipelineChange?: (stages: CanvasStage[]) => void
}

export function VisualPipelineBuilder({ onRunAnalysis, onPipelineChange }: VisualPipelineBuilderProps) {
  const [canvasStages, setCanvasStages] = useState<CanvasStage[]>(() => [
    { ...AVAILABLE_STAGES[0], instanceId: 'validate-default', position: { x: 60,  y: 120 } },
    { ...AVAILABLE_STAGES[1], instanceId: 'audit-default',    position: { x: 340, y: 120 } },
    { ...AVAILABLE_STAGES[2], instanceId: 'predict-default',  position: { x: 620, y: 120 } },
    { ...AVAILABLE_STAGES[3], instanceId: 'analyze-default',  position: { x: 900, y: 120 } },
  ])

  const [activeStage, setActiveStage] = useState<PipelineStage | null>(null)
  const [sequence, setSequence] = useState('')
  const [format, setFormat] = useState<SequenceFormat>('raw')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canvasRef = useRef<HTMLDivElement>(null)

  // Pipeline order: stages sorted left-to-right by x position
  const orderedStages = useMemo(
    () => [...canvasStages].sort((a, b) => a.position.x - b.position.x),
    [canvasStages]
  )

  // Which stage types are already on the canvas
  const placedIds = useMemo(
    () => new Set(canvasStages.map((s) => s.id)),
    [canvasStages]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id)
    if (id.startsWith('sidebar-')) {
      setActiveStage(event.active.data.current?.stage as PipelineStage)
    }
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over, delta } = event
      const activeId = String(active.id)
      setActiveStage(null)

      // ── Sidebar stage dropped onto canvas ──
      if (over?.id === 'pipeline-canvas' && activeId.startsWith('sidebar-')) {
        const stage = active.data.current?.stage as PipelineStage
        const canvasEl = canvasRef.current
        if (!canvasEl) return

        const rect = canvasEl.getBoundingClientRect()
        const activator = event.activatorEvent as PointerEvent

        // activatorEvent = where drag STARTED; add delta to get drop position
        const rawX = activator.clientX + delta.x - rect.left - STAGE_W / 2
        const rawY = activator.clientY + delta.y - rect.top - STAGE_H / 2

        const newStage: CanvasStage = {
          ...stage,
          instanceId: `${stage.id}-${Date.now()}`,
          position: {
            x: Math.max(0, snap(rawX)),
            y: Math.max(0, snap(rawY)),
          },
        }

        setCanvasStages((prev) => {
          const updated = [...prev, newStage]
          onPipelineChange?.(updated)
          return updated
        })
        return
      }

      // ── Canvas stage repositioned ──
      if (activeId.startsWith('canvas-')) {
        const instanceId = activeId.slice('canvas-'.length)
        setCanvasStages((prev) => {
          const updated = prev.map((s) =>
            s.instanceId === instanceId
              ? {
                  ...s,
                  position: {
                    x: Math.max(0, snap(s.position.x + delta.x)),
                    y: Math.max(0, snap(s.position.y + delta.y)),
                  },
                }
              : s
          )
          onPipelineChange?.(updated)
          return updated
        })
      }
    },
    [onPipelineChange]
  )

  const handleRemove = useCallback(
    (instanceId: string) => {
      setCanvasStages((prev) => {
        const updated = prev.filter((s) => s.instanceId !== instanceId)
        onPipelineChange?.(updated)
        return updated
      })
    },
    [onPipelineChange]
  )

  const handleClearCanvas = useCallback(() => {
    setCanvasStages([])
    onPipelineChange?.([])
  }, [onPipelineChange])

  const handleRunAnalysis = async () => {
    if (canvasStages.length === 0) {
      setSubmitError('Add at least one stage to your pipeline.')
      return
    }
    if (!sequence.trim()) {
      setSubmitError('Enter a protein sequence before running.')
      return
    }
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await onRunAnalysis?.(sequence.trim(), format, orderedStages)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const pipelineSummary = orderedStages.map((s) => s.name).join(' → ') || 'empty'

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex">
        {/* ── Left Sidebar ── */}
        <div className="w-[280px] flex-shrink-0 border-r border-border-subtle flex flex-col bg-bg-primary">
          {/* Header */}
          <div className="p-4 border-b border-border-subtle">
            <h2 className="text-base font-semibold text-text-primary">Pipeline Builder</h2>
            <p className="text-xs text-text-muted mt-0.5">Drag stages onto the canvas</p>
          </div>

          {/* Available Stages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
              Available Stages
            </p>
            {AVAILABLE_STAGES.map((stage) => (
              <SidebarStage
                key={stage.id}
                stage={stage}
                placed={placedIds.has(stage.id)}
              />
            ))}

            {/* Divider */}
            <div className="pt-4 border-t border-border-subtle">
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                Sequence Input
              </p>

              {/* Format toggle */}
              <div className="flex gap-1.5 mb-3">
                {(['raw', 'fasta'] as SequenceFormat[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      format === f
                        ? 'bg-accent-blue text-white'
                        : 'bg-bg-secondary text-text-muted hover:text-text-primary border border-border-default'
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Sequence textarea */}
              <textarea
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
                placeholder={
                  format === 'fasta'
                    ? '>protein_name\nMKTIIALSYIFCLVFA...'
                    : 'MKTIIALSYIFCLVFA...'
                }
                rows={5}
                className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent-blue/50 leading-relaxed"
                spellCheck={false}
              />

              {submitError && (
                <p className="text-xs text-red-400 mt-2 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                  </svg>
                  {submitError}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border-subtle space-y-3">
            {/* Pipeline summary */}
            <div className="bg-bg-secondary rounded-lg px-3 py-2">
              <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider mb-1">
                Pipeline Order
              </p>
              <p className="text-xs text-text-secondary font-mono leading-relaxed break-words">
                {pipelineSummary}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {canvasStages.length > 0 && (
                <button
                  onClick={handleClearCanvas}
                  className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium text-text-muted hover:text-red-400 hover:bg-red-400/10 border border-border-default transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={handleRunAnalysis}
                disabled={isSubmitting || canvasStages.length === 0}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  canvasStages.length === 0
                    ? 'bg-bg-secondary text-text-muted cursor-not-allowed border border-border-subtle'
                    : 'bg-accent-blue text-white hover:brightness-110 shadow-lg shadow-accent-blue/25 active:scale-95'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Run Analysis
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Canvas Area ── */}
        <div className="flex-1 p-5 flex flex-col gap-3 overflow-hidden">
          {/* Canvas header */}
          <div className="flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">Canvas</span>
              {canvasStages.length > 0 && (
                <span className="text-xs text-text-muted bg-bg-secondary border border-border-subtle px-2 py-0.5 rounded-full">
                  {canvasStages.length} stage{canvasStages.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted">
              Arrange left-to-right to set execution order
            </p>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto">
            <CanvasArea
              stages={canvasStages}
              orderedStages={orderedStages}
              onRemove={handleRemove}
              canvasRef={canvasRef}
            />
          </div>
        </div>
      </div>

      {/* Drag overlay — shows what you're dragging */}
      <DragOverlay dropAnimation={null}>
        {activeStage && (
          <div
            className="rounded-xl border-2 border-accent-blue/60 bg-bg-elevated p-3.5 shadow-2xl shadow-accent-blue/30 rotate-2 scale-105 opacity-90"
            style={{ width: STAGE_W }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center flex-shrink-0">
                <StageIcon name={activeStage.icon} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{activeStage.name}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{activeStage.description}</p>
              </div>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
