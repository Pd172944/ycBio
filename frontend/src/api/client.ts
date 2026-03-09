import type {
  Batch,
  BatchCreateRequest,
  BatchCreateResponse,
  Job,
  SubmitJobRequest,
  SubmitJobResponse,
} from '../types'

const BASE_URL = 'http://localhost:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  submitJob: (body: SubmitJobRequest): Promise<SubmitJobResponse> =>
    request<SubmitJobResponse>('/jobs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getJob: (jobId: string): Promise<Job> =>
    request<Job>(`/jobs/${jobId}`),

  getPipelineTools: () =>
    request('/pipelines/tools'),

  getPipelineTemplates: () =>
    request('/pipelines/templates'),

  submitBatch: (body: BatchCreateRequest): Promise<BatchCreateResponse> =>
    request<BatchCreateResponse>('/batches', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getBatch: (batchId: string): Promise<Batch> =>
    request<Batch>(`/batches/${batchId}`),
}
