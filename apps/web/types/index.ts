export interface User {
  id: string
  email: string
  org_id?: string
  role: 'researcher' | 'admin'
  created_at: string
}

export interface PipelineConfigStep {
  step_name: StepName
  enabled: boolean
  params: Record<string, any>
}

export interface PipelineRun {
  id: string
  user_id: string
  name: string
  status: PipelineStatus
  target_sequence: string
  pipeline_config: PipelineConfigStep[]
  created_at: string
  completed_at?: string
  error_message?: string
  run_key?: string
  steps: PipelineStep[]
}

export interface PipelineStep {
  id: string
  run_id: string
  step_name: StepName
  status: StepStatus
  started_at?: string
  completed_at?: string
  agent_reasoning?: string
  input_artifact_key?: string
  output_artifact_key?: string
  metadata: Record<string, any>
  error_message?: string
}

export interface Molecule {
  id: string
  run_id: string
  mol_type: string
  name: string
  smiles?: string
  inchi_key?: string
  pdb_path?: string
  properties: Record<string, any>
}

export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed'
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed'

export type StepName = 
  | 'ingestion'
  | 'folding' 
  | 'binding_site'
  | 'docking'
  | 'admet'
  | 'literature'
  | 'documentation'

export interface SSEEvent {
  event: string
  data: Record<string, any>
  run_id: string
  step_id?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}