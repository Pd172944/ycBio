export type JobStatus =
  | 'pending'
  | 'validating'
  | 'auditing'
  | 'running'
  | 'analyzing'
  | 'complete'
  | 'failed'

export type SequenceFormat = 'raw' | 'fasta'

export interface SubmitJobRequest {
  sequence: string
  format: SequenceFormat
  pipeline_id: string
}

export interface SubmitJobResponse {
  job_id: string
  status: string
  message: string
}

export interface StatisticianReport {
  confidence_score: number
  metrics: Record<string, unknown>
  interpretation: string
}

export interface CriticReport {
  has_concerns: boolean
  concerns: string[]
  recommend_rerun: boolean
  severity: string
}

export interface SynthesizerReport {
  executive_summary: string
  key_findings: string[]
  next_steps: string[]
  caveats: string[]
}

export interface MoEReport {
  overall_confidence: number
  statistician: StatisticianReport
  critic: CriticReport
  synthesizer: SynthesizerReport
}

export interface PerModelScore {
  model: string
  plddt_mean: number
  [key: string]: unknown
}

export interface ModalOutput {
  best_plddt_mean: number
  best_pdb_content?: string | null
  per_model_scores: PerModelScore[]
}

export interface Job {
  job_id: string
  status: JobStatus
  sequence_input: {
    sequence: string
    format: string
  }
  moe_report: MoEReport | null
  modal_output: ModalOutput | null
  error: string | null
  // Local tracking
  submitted_at: string
}

// ---------------------------------------------------------------------------
// Batch analysis types
// ---------------------------------------------------------------------------

export interface MutationVariant {
  label: string
  sequence: string
  job_id: string | null
  status: string
  moe_report: MoEReport | null
}

export interface RankingEntry {
  label: string
  plddt_delta: number | null
  impact: 'stabilizing' | 'neutral' | 'destabilizing'
  notes: string
}

export interface ComparatorReport {
  summary: string
  rankings: RankingEntry[]
  recommendation: string
  caveats: string[]
}

export interface Batch {
  batch_id: string
  wildtype_sequence: string
  variants: MutationVariant[]
  status: string
  comparator_report: ComparatorReport | null
  created_at: string
}

export interface BatchCreateRequest {
  wildtype: string
  mutations: string[]
  pipeline_id: string
}

export interface BatchCreateResponse {
  batch_id: string
  variant_count: number
  status: string
}

