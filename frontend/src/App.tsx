import { useState, useEffect, useCallback, useRef } from 'react'
import type { Batch, Job, SequenceFormat } from './types'
import type { PipelineStage } from './components/PipelineBuilder'
import { api } from './api/client'
import { BatchDetail } from './components/BatchDetail'
import { BatchForm } from './components/BatchForm'
import { JobCard } from './components/JobCard'
import { JobDetail } from './components/JobDetail'
import { SubmitJobForm } from './components/SubmitJobForm'
import { VisualPipelineBuilder, type CanvasStage } from './components/VisualPipelineBuilder'

const STORAGE_KEY = 'biosync_jobs'
const BATCH_STORAGE_KEY = 'biosync_batches'
const POLL_INTERVAL_MS = 10_000
const BATCH_POLL_INTERVAL_MS = 15_000
const TERMINAL_STATUSES = new Set(['complete', 'failed'])

function loadJobsFromStorage(): Job[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Job[]) : []
  } catch {
    return []
  }
}

function saveJobsToStorage(jobs: Job[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
  } catch { }
}

function loadBatchesFromStorage(): Batch[] {
  try {
    const raw = localStorage.getItem(BATCH_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Batch[]) : []
  } catch {
    return []
  }
}

function saveBatchesToStorage(batches: Batch[]) {
  try {
    localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(batches))
  } catch { }
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
        </svg>
      </div>
      <div>
        <div className="text-sm font-bold text-text-primary tracking-tight">BioSync</div>
        <div className="text-xs text-text-muted -mt-0.5">Orchestrator</div>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'batch' | 'pipeline'>('jobs')

  // Jobs state
  const [jobs, setJobs] = useState<Job[]>(loadJobsFromStorage)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [currentView] = useState<'jobs' | 'pipeline'>('jobs')
  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Batches state
  const [batches, setBatches] = useState<Batch[]>(loadBatchesFromStorage)
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const batchPollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Persist jobs on change
  useEffect(() => {
    saveJobsToStorage(jobs)
  }, [jobs])

  useEffect(() => {
    saveBatchesToStorage(batches)
  }, [batches])

  const updateJob = useCallback((updated: Job) => {
    setJobs((prev) =>
      prev.map((j) => (j.job_id === updated.job_id ? { ...j, ...updated } : j))
    )
  }, [])

  const stopPolling = useCallback((jobId: string) => {
    const timer = pollingRef.current.get(jobId)
    if (timer) {
      clearInterval(timer)
      pollingRef.current.delete(jobId)
    }
  }, [])

  const startPolling = useCallback(
    (jobId: string) => {
      if (pollingRef.current.has(jobId)) return

      const poll = async () => {
        try {
          const updated = await api.getJob(jobId)
          updateJob(updated)
          if (TERMINAL_STATUSES.has(updated.status)) {
            stopPolling(jobId)
          }
        } catch (err) {
          console.error(`Polling error for ${jobId}:`, err)
        }
      }

      // Poll immediately, then on interval
      poll()
      const timer = setInterval(poll, POLL_INTERVAL_MS)
      pollingRef.current.set(jobId, timer)
    },
    [updateJob, stopPolling]
  )

  // On mount, resume polling for any non-terminal jobs
  useEffect(() => {
    const storedJobs = loadJobsFromStorage()
    for (const job of storedJobs) {
      if (!TERMINAL_STATUSES.has(job.status)) {
        startPolling(job.job_id)
      }
    }
    return () => {
      for (const timer of pollingRef.current.values()) {
        clearInterval(timer)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (sequence: string, format: SequenceFormat, pipeline?: PipelineStage[]) => {
    const pipelineId = pipeline && pipeline.length > 0
      ? pipeline.map(s => s.name.toLowerCase()).join('-')
      : 'default'

    const res = await api.submitJob({ sequence, format, pipeline_id: pipelineId })

    const newJob: Job = {
      job_id: res.job_id,
      status: res.status as Job['status'],
      sequence_input: { sequence, format },
      moe_report: null,
      modal_output: null,
      error: null,
      submitted_at: new Date().toISOString(),
    }

    setJobs((prev) => [newJob, ...prev])
    setSelectedJobId(res.job_id)
    startPolling(res.job_id)
  }

  const selectedJob = jobs.find((j) => j.job_id === selectedJobId) ?? null
  const selectedBatch = batches.find((b) => b.batch_id === selectedBatchId) ?? null
  const activeCount = jobs.filter((j) => !TERMINAL_STATUSES.has(j.status)).length

  // Batch polling
  const updateBatch = useCallback((updated: Batch) => {
    setBatches((prev) =>
      prev.map((b) => (b.batch_id === updated.batch_id ? { ...b, ...updated } : b))
    )
  }, [])

  const stopBatchPolling = useCallback((batchId: string) => {
    const timer = batchPollingRef.current.get(batchId)
    if (timer) { clearInterval(timer); batchPollingRef.current.delete(batchId) }
  }, [])

  const startBatchPolling = useCallback((batchId: string) => {
    if (batchPollingRef.current.has(batchId)) return
    const poll = async () => {
      try {
        const updated = await api.getBatch(batchId)
        updateBatch(updated)
        if (TERMINAL_STATUSES.has(updated.status)) stopBatchPolling(batchId)
      } catch (err) {
        console.error(`Batch polling error for ${batchId}:`, err)
      }
    }
    poll()
    const timer = setInterval(poll, BATCH_POLL_INTERVAL_MS)
    batchPollingRef.current.set(batchId, timer)
  }, [updateBatch, stopBatchPolling])

  // Resume polling non-terminal batches on mount
  useEffect(() => {
    for (const batch of loadBatchesFromStorage()) {
      if (!TERMINAL_STATUSES.has(batch.status)) startBatchPolling(batch.batch_id)
    }
    return () => { for (const timer of batchPollingRef.current.values()) clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBatchSubmit = async (wildtype: string, mutations: string[]) => {
    const res = await api.submitBatch({ wildtype, mutations, pipeline_id: 'default' })
    const newBatch: Batch = {
      batch_id: res.batch_id,
      wildtype_sequence: wildtype,
      variants: [],
      status: res.status,
      comparator_report: null,
      created_at: new Date().toISOString(),
    }
    setBatches((prev) => [newBatch, ...prev])
    setSelectedBatchId(res.batch_id)
    startBatchPolling(res.batch_id)
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Top nav */}
      <header className="flex-shrink-0 border-b border-border-subtle px-6 h-14 flex items-center justify-between sticky top-0 z-10 bg-bg-primary/90 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <Logo />

          {/* View Switcher */}
          <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-1">
            {(['jobs', 'batch', 'pipeline'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${activeTab === tab
                    ? 'bg-accent-blue text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                  }`}
              >
                {tab === 'jobs' ? 'Jobs' : tab === 'batch' ? 'Batch Analysis' : 'Pipeline Builder'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {activeCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 dot-pulse" />
              {activeCount} job{activeCount !== 1 ? 's' : ''} running
            </div>
          )}
          <div className="text-xs text-text-muted font-mono">
            {jobs.length} total job{jobs.length !== 1 ? 's' : ''}
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'pipeline' ? (
          /* Pipeline Builder View */
          <div className="flex-1">
            <VisualPipelineBuilder
              onRunAnalysis={(sequence, format, canvasStages: CanvasStage[]) => {
                const pipeline: PipelineStage[] = canvasStages.map((s) => ({
                  id: s.id,
                  name: s.name,
                  description: s.description,
                  icon: s.icon,
                }))
                handleSubmit(sequence, format, pipeline)
                setActiveTab('jobs')
              }}
            />
          </div>
        ) : activeTab === 'batch' ? (
          /* Batch Analysis View */
          <>
            <aside className="w-[380px] flex-shrink-0 border-r border-border-subtle flex flex-col overflow-hidden">
              <div className="p-4 border-b border-border-subtle flex-shrink-0">
                <BatchForm onSubmit={handleBatchSubmit} />
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 pb-2">
                  <h2 className="section-title">Batches</h2>
                </div>
                {batches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
                    <p className="text-sm text-text-muted">No batches yet</p>
                  </div>
                ) : (
                  <div className="px-4 pb-4 space-y-2">
                    {batches.map((batch) => (
                      <button
                        key={batch.batch_id}
                        onClick={() => setSelectedBatchId(
                          batch.batch_id === selectedBatchId ? null : batch.batch_id
                        )}
                        className={`w-full text-left card p-4 transition-all duration-150 ${batch.batch_id === selectedBatchId ? 'ring-1 ring-accent-blue' : 'hover:bg-bg-elevated'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-xs text-text-muted truncate flex-1">
                            {batch.batch_id.slice(0, 8)}…
                          </span>
                          <span className={`text-xs capitalize px-2 py-0.5 rounded-full ${batch.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400'
                              : batch.status === 'failed' ? 'bg-red-500/10 text-red-400'
                                : 'bg-amber-400/10 text-amber-400'
                            }`}>{batch.status}</span>
                        </div>
                        <p className="font-mono text-xs text-text-secondary truncate">
                          WT: {batch.wildtype_sequence.slice(0, 24)}{batch.wildtype_sequence.length > 24 ? '…' : ''}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          {batch.variants.length} variant{batch.variants.length !== 1 ? 's' : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>
            <main className="flex-1 overflow-hidden">
              {selectedBatch ? (
                <div className="h-full p-6 overflow-y-auto">
                  <BatchDetail
                    batch={selectedBatch}
                    onClose={() => setSelectedBatchId(null)}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-text-muted text-sm">Select a batch to view details</p>
                </div>
              )}
            </main>
          </>
        ) : (
          /* Jobs View */
          <>
            {/* Left panel */}
            <aside className="w-[380px] flex-shrink-0 border-r border-border-subtle flex flex-col overflow-hidden">
              {/* Submit form */}
              <div className="p-4 border-b border-border-subtle flex-shrink-0">
                <SubmitJobForm onSubmit={handleSubmit} />
              </div>

              {/* Job list */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <h2 className="section-title">Jobs</h2>
                    {jobs.length > 0 && (
                      <button
                        onClick={() => {
                          if (window.confirm('Clear all jobs from history?')) {
                            for (const [id] of pollingRef.current) stopPolling(id)
                            setJobs([])
                            setSelectedJobId(null)
                          }
                        }}
                        className="text-xs text-text-muted hover:text-red-400 transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>

                {jobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
                    <p className="text-sm text-text-muted">No jobs yet</p>
                    <p className="text-xs text-text-muted">Submit a sequence above to get started</p>
                  </div>
                ) : (
                  <div className="px-4 pb-4 space-y-2">
                    {jobs.map((job) => (
                      <JobCard
                        key={job.job_id}
                        job={job}
                        isSelected={job.job_id === selectedJobId}
                        onClick={() =>
                          setSelectedJobId(
                            job.job_id === selectedJobId ? null : job.job_id
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </aside>

            {/* Right panel — job detail */}
            <main className="flex-1 overflow-hidden">
              {selectedJob ? (
                <div className="h-full p-6 overflow-y-auto">
                  <JobDetail
                    job={selectedJob}
                    onClose={() => setSelectedJobId(null)}
                  />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-6 text-center px-8">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 flex items-center justify-center">
                    <svg className="w-9 h-9 text-blue-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.5 2.122v0a2.25 2.25 0 001.5-2.122V3.104m0 0c.251.023.501.05.75.082M19.5 14.5l-4.091-4.091A2.25 2.25 0 0114.25 8.82V3.104m0 0A24.301 24.301 0 0119.5 3.186" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-text-secondary mb-2">Select a job to view details</h2>
                    <p className="text-sm text-text-muted max-w-sm leading-relaxed">
                      Submit an amino acid sequence and select a job from the list to view the full analysis.
                    </p>
                  </div>
                </div>
              )}
            </main>
          </>
        )}
      </div>
    </div>
  )
}
