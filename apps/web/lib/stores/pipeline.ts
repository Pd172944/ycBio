import { create } from 'zustand'
import { PipelineRun, PipelineStep, SSEEvent } from '@/types'

interface PipelineStore {
  runs: PipelineRun[]
  currentRun: PipelineRun | null
  loading: boolean
  error: string | null
  
  // Actions
  setRuns: (runs: PipelineRun[]) => void
  setCurrentRun: (run: PipelineRun | null) => void
  updateRunStep: (runId: string, step: PipelineStep) => void
  updateRunStatus: (runId: string, status: any) => void
  handleSSEEvent: (event: SSEEvent) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const usePipelineStore = create<PipelineStore>((set, get) => ({
  runs: [],
  currentRun: null,
  loading: false,
  error: null,

  setRuns: (runs) => set({ runs }),
  
  setCurrentRun: (run) => set({ currentRun: run }),
  
  updateRunStep: (runId, step) =>
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId
          ? {
              ...run,
              steps: run.steps.map((s) => (s.id === step.id ? step : s)),
            }
          : run
      ),
      currentRun:
        state.currentRun?.id === runId
          ? {
              ...state.currentRun,
              steps: state.currentRun.steps.map((s) =>
                s.id === step.id ? step : s
              ),
            }
          : state.currentRun,
    })),

  updateRunStatus: (runId, status) =>
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId ? { ...run, ...status } : run
      ),
      currentRun:
        state.currentRun?.id === runId
          ? { ...state.currentRun, ...status }
          : state.currentRun,
    })),

  handleSSEEvent: (event) => {
    const { event: eventType, data, run_id, step_id } = event

    switch (eventType) {
      case 'step_update':
        if (step_id && data) {
          const step: PipelineStep = {
            id: step_id,
            run_id,
            step_name: data.step_name,
            status: data.status,
            started_at: data.started_at,
            completed_at: data.completed_at,
            agent_reasoning: data.agent_reasoning,
            input_artifact_key: data.input_artifact_key,
            output_artifact_key: data.output_artifact_key,
            metadata: data.metadata || {},
            error_message: data.error_message,
          }
          get().updateRunStep(run_id, step)
        }
        break

      case 'run_completed':
      case 'run_failed':
        get().updateRunStatus(run_id, {
          status: data.status,
          completed_at: data.completed_at,
          error_message: data.error_message,
        })
        break
    }
  },

  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error }),
}))