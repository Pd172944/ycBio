import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type PipelineStage = {
  id: string
  name: string
  description: string
  icon: string
  isOptional?: boolean
}

const DEFAULT_STAGES: PipelineStage[] = [
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

interface SortableStageProps {
  stage: PipelineStage
  index: number
  onRemove?: (id: string) => void
}

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

function SortableStage({ stage, index, onRemove }: SortableStageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? 'z-50' : ''}`}
    >
      {/* Stage Card */}
      <div
        className={`
          bg-bg-elevated border border-border-default rounded-lg p-4 transition-all duration-200
          ${isDragging 
            ? 'shadow-2xl shadow-accent-blue/20 border-accent-blue/50 bg-bg-elevated/95 backdrop-blur-sm scale-105' 
            : 'hover:border-border-strong hover:shadow-lg hover:shadow-black/10 group-hover:bg-bg-elevated'
          }
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 rounded text-text-muted hover:text-text-primary transition-colors touch-none"
              aria-label={`Drag ${stage.name} stage`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
              </svg>
            </button>

            {/* Stage Icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-blue/10 text-accent-blue flex items-center justify-center">
              {getIcon(stage.icon)}
            </div>

            {/* Stage Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-text-primary">{stage.name}</h3>
                {stage.isOptional && (
                  <span className="text-xs bg-bg-secondary text-text-muted px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">{stage.description}</p>
            </div>
          </div>

          {/* Remove Button */}
          {stage.isOptional && onRemove && (
            <button
              onClick={() => onRemove(stage.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-red-400 transition-all"
              aria-label={`Remove ${stage.name} stage`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Connection Line */}
      {index < 3 && (
        <div className="flex justify-center py-2">
          <div className="w-0.5 h-6 bg-border-subtle rounded-full" />
        </div>
      )}
    </div>
  )
}

interface PipelineBuilderProps {
  onPipelineChange?: (stages: PipelineStage[]) => void
  className?: string
}

export function PipelineBuilder({ onPipelineChange, className = '' }: PipelineBuilderProps) {
  const [stages, setStages] = useState<PipelineStage[]>(DEFAULT_STAGES)
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = stages.findIndex(stage => stage.id === active.id)
      const newIndex = stages.findIndex(stage => stage.id === over.id)

      const newStages = arrayMove(stages, oldIndex, newIndex)
      setStages(newStages)
      onPipelineChange?.(newStages)
    }
  }

  const handleRemoveStage = (stageId: string) => {
    const newStages = stages.filter(stage => stage.id !== stageId)
    setStages(newStages)
    onPipelineChange?.(newStages)
  }

  const handleAddOptionalStage = () => {
    const newStage: PipelineStage = {
      id: `custom-${Date.now()}`,
      name: 'Custom Stage',
      description: 'Custom processing step',
      icon: 'cog',
      isOptional: true,
    }
    const newStages = [...stages, newStage]
    setStages(newStages)
    onPipelineChange?.(newStages)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-text-primary">Pipeline Configuration</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Drag to reorder • Add optional stages
          </p>
        </div>
        <button
          onClick={handleAddOptionalStage}
          className="text-xs text-accent-blue hover:text-accent-blue-glow transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Stage
        </button>
      </div>

      {/* Pipeline Stages */}
      <div className="bg-bg-secondary/30 rounded-xl p-4 border border-border-subtle">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0">
              {stages.map((stage, index) => (
                <SortableStage
                  key={stage.id}
                  stage={stage}
                  index={index}
                  onRemove={stage.isOptional ? handleRemoveStage : undefined}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Pipeline Summary */}
        <div className="mt-4 pt-4 border-t border-border-subtle">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">
              {stages.length} stage{stages.length !== 1 ? 's' : ''} configured
            </span>
            <span className="font-mono text-text-secondary">
              Pipeline: {stages.map(s => s.name.toLowerCase()).join(' → ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}