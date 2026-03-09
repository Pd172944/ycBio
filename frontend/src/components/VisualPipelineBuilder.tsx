import React, { useState, useRef, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

export type PipelineStage = {
  id: string
  name: string
  description: string
  icon: string
}

export type CanvasStage = PipelineStage & {
  position: { x: number; y: number }
  connections: string[]
}

const AVAILABLE_STAGES: PipelineStage[] = [
  {
    id: 'validate',
    name: 'Validate',
    description: 'Validate sequence format and structure',
    icon: 'check-circle',
  },
  {
    id: 'audit',
    name: 'Audit',
    description: 'Check sequence quality and properties',
    icon: 'magnifying-glass',
  },
  {
    id: 'predict',
    name: 'Predict',
    description: 'Run structure prediction models',
    icon: 'cube',
  },
  {
    id: 'analyze',
    name: 'Analyze',
    description: 'Generate comprehensive analysis report',
    icon: 'chart-bar',
  },
]

function getIcon(iconName: string) {
  switch (iconName) {
    case 'check-circle':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'magnifying-glass':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      )
    case 'cube':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      )
    case 'chart-bar':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      )
    default:
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L12 12m6.894 5.785l-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864l-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495" />
        </svg>
      )
  }
}

interface DraggableStageProps {
  stage: PipelineStage
}

function DraggableStage({ stage }: DraggableStageProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sidebar-${stage.id}`,
    data: { stage }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-bg-elevated border border-border-default rounded-lg p-3 transition-all duration-200 cursor-grab active:cursor-grabbing
        ${isDragging 
          ? 'opacity-50 shadow-2xl shadow-accent-blue/20 border-accent-blue/50 scale-105' 
          : 'hover:border-border-strong hover:shadow-lg hover:shadow-black/10'
        }
      `}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-blue/10 text-accent-blue flex items-center justify-center">
          {getIcon(stage.icon)}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-text-primary">{stage.name}</h3>
          <p className="text-xs text-text-muted mt-0.5 truncate">{stage.description}</p>
        </div>
      </div>
    </div>
  )
}

interface CanvasStageProps {
  stage: CanvasStage
  onMove: (id: string, position: { x: number; y: number }) => void
  onRemove: (id: string) => void
}

function CanvasStageComponent({ stage, onMove, onRemove }: CanvasStageProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `canvas-${stage.id}`,
    data: { stage, type: 'canvas-stage' }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    left: stage.position.x,
    top: stage.position.y,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        absolute bg-white border-2 border-gray-200 rounded-lg p-4 min-w-[200px] transition-all duration-200 cursor-grab active:cursor-grabbing shadow-md
        ${isDragging 
          ? 'shadow-2xl shadow-blue-500/20 border-blue-500/50 scale-105 z-50' 
          : 'hover:border-gray-300 hover:shadow-lg'
        }
      `}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            {getIcon(stage.icon)}
          </div>
          <h3 className="text-sm font-medium text-gray-900">{stage.name}</h3>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove(stage.id)
          }}
          className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-gray-600">{stage.description}</p>
      
      {/* Connection Points */}
      <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md"></div>
      <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md"></div>
    </div>
  )
}

interface CanvasProps {
  stages: CanvasStage[]
  onStageMove: (id: string, position: { x: number; y: number }) => void
  onStageRemove: (id: string) => void
}

function Canvas({ stages, onStageMove, onStageRemove }: CanvasProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'pipeline-canvas'
  })

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-1 relative overflow-hidden rounded-lg border-2 border-dashed transition-all duration-200 min-h-[600px]
        ${isOver 
          ? 'border-accent-blue bg-accent-blue/5 shadow-inner' 
          : 'border-border-subtle bg-bg-secondary/30'
        }
      `}
      style={{ 
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }}
    >
      {stages.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center">
              <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <p className="text-text-secondary font-medium mb-1">Build Your Pipeline</p>
            <p className="text-sm text-text-muted">Drag stages from the left sidebar to get started</p>
          </div>
        </div>
      ) : (
        <>
          {/* Render stages */}
          {stages.map((stage) => (
            <CanvasStageComponent
              key={stage.id}
              stage={stage}
              onMove={onStageMove}
              onRemove={onStageRemove}
            />
          ))}
          
          {/* Render connection lines */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full" style={{ zIndex: 1 }}>
            {stages.map((stage) =>
              stage.connections.map((targetId) => {
                const targetStage = stages.find(s => s.id === targetId)
                if (!targetStage) return null
                
                return (
                  <line
                    key={`${stage.id}-${targetId}`}
                    x1={stage.position.x + 200}
                    y1={stage.position.y + 50}
                    x2={targetStage.position.x}
                    y2={targetStage.position.y + 50}
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeDasharray="8,4"
                    opacity="0.7"
                  />
                )
              })
            )}
          </svg>
        </>
      )}
    </div>
  )
}

interface VisualPipelineBuilderProps {
  onPipelineChange?: (stages: CanvasStage[]) => void
}

export function VisualPipelineBuilder({ onPipelineChange }: VisualPipelineBuilderProps) {
  const [canvasStages, setCanvasStages] = useState<CanvasStage[]>([
    {
      ...AVAILABLE_STAGES[0],
      id: `${AVAILABLE_STAGES[0].id}-default`,
      position: { x: 100, y: 100 },
      connections: [`${AVAILABLE_STAGES[1].id}-default`],
    },
    {
      ...AVAILABLE_STAGES[1], 
      id: `${AVAILABLE_STAGES[1].id}-default`,
      position: { x: 400, y: 100 },
      connections: [`${AVAILABLE_STAGES[2].id}-default`],
    },
    {
      ...AVAILABLE_STAGES[2],
      id: `${AVAILABLE_STAGES[2].id}-default`, 
      position: { x: 100, y: 300 },
      connections: [`${AVAILABLE_STAGES[3].id}-default`],
    },
    {
      ...AVAILABLE_STAGES[3],
      id: `${AVAILABLE_STAGES[3].id}-default`,
      position: { x: 400, y: 300 },
      connections: [],
    },
  ])
  const [draggedItem, setDraggedItem] = useState<{ stage: PipelineStage } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    if (typeof active.id === 'string' && active.id.startsWith('sidebar-')) {
      const stage = active.data.current?.stage as PipelineStage
      setDraggedItem({ stage })
    }
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    
    if (over?.id === 'pipeline-canvas' && typeof active.id === 'string' && active.id.startsWith('sidebar-')) {
      const stage = active.data.current?.stage as PipelineStage
      const canvasRect = canvasRef.current?.getBoundingClientRect()
      
      if (canvasRect) {
        // Calculate position relative to canvas based on drop coordinates
        const dropX = (event.activatorEvent as PointerEvent)?.clientX || 0
        const dropY = (event.activatorEvent as PointerEvent)?.clientY || 0
        
        const newStage: CanvasStage = {
          ...stage,
          id: `${stage.id}-${Date.now()}`,
          position: {
            x: Math.max(20, dropX - canvasRect.left - 100),
            y: Math.max(20, dropY - canvasRect.top - 25),
          },
          connections: [],
        }
        
        setCanvasStages(prev => {
          const updated = [...prev, newStage]
          onPipelineChange?.(updated)
          return updated
        })
      }
    }
    
    if (typeof active.id === 'string' && active.id.startsWith('canvas-')) {
      const stageId = active.id.replace('canvas-', '')
      const deltaX = event.delta?.x || 0
      const deltaY = event.delta?.y || 0
      
      setCanvasStages(prev => {
        const updated = prev.map(stage => 
          stage.id === stageId 
            ? { ...stage, position: { 
                x: Math.max(0, stage.position.x + deltaX), 
                y: Math.max(0, stage.position.y + deltaY) 
              }} 
            : stage
        )
        onPipelineChange?.(updated)
        return updated
      })
    }
    
    setDraggedItem(null)
  }, [onPipelineChange])

  const handleStageMove = useCallback((id: string, position: { x: number; y: number }) => {
    setCanvasStages(prev => {
      const updated = prev.map(stage => stage.id === id ? { ...stage, position } : stage)
      onPipelineChange?.(updated)
      return updated
    })
  }, [onPipelineChange])

  const handleStageRemove = useCallback((id: string) => {
    setCanvasStages(prev => {
      const updated = prev.filter(stage => stage.id !== id)
      onPipelineChange?.(updated)
      return updated
    })
  }, [onPipelineChange])

  const handleRunAnalysis = () => {
    // TODO: Implement pipeline execution
    console.log('Running analysis with pipeline:', canvasStages)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex">
        {/* Left Sidebar */}
        <div className="w-[300px] bg-bg-primary border-r border-border-subtle flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border-subtle">
            <h2 className="text-lg font-semibold text-text-primary mb-1">Pipeline Configuration</h2>
            <p className="text-sm text-text-muted">Drag to reorder • Add optional stages</p>
          </div>

          {/* Available Stages */}
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {AVAILABLE_STAGES.map((stage) => (
              <DraggableStage key={stage.id} stage={stage} />
            ))}
          </div>

          {/* Bottom Summary */}
          <div className="p-4 border-t border-border-subtle">
            <div className="text-xs text-text-muted mb-3">
              Pipeline: {canvasStages.length > 0 
                ? canvasStages.map(s => s.name.toLowerCase()).join(' → ')
                : 'validate → audit → predict → analyze'
              }
            </div>
            <button
              onClick={handleRunAnalysis}
              disabled={canvasStages.length === 0}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Analysis
            </button>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 p-6 flex flex-col">
          <div ref={canvasRef} className="flex-1">
            <Canvas 
              stages={canvasStages}
              onStageMove={handleStageMove}
              onStageRemove={handleStageRemove}
            />
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedItem && (
          <div className="bg-bg-elevated border-2 border-accent-blue/50 rounded-lg p-3 shadow-2xl shadow-accent-blue/20 rotate-3 scale-105">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                {getIcon(draggedItem.stage.icon)}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-text-primary">{draggedItem.stage.name}</h3>
                <p className="text-xs text-text-muted mt-0.5">{draggedItem.stage.description}</p>
              </div>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}