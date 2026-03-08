const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

class ApiClient {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  setToken(token: string) {
    this.token = token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API Error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request<any>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async getCurrentUser() {
    return this.request<any>('/api/auth/me')
  }

  // Pipeline endpoints
  async createPipelineRun(data: any) {
    return this.request<any>('/api/pipelines', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getPipelineRuns(page = 1, perPage = 10) {
    return this.request<any>(`/api/pipelines?page=${page}&per_page=${perPage}`)
  }

  async getPipelineRun(runId: string) {
    return this.request<any>(`/api/pipelines/${runId}`)
  }

  async getRunStatus(runId: string) {
    return this.request<any>(`/api/runs/${runId}/status`)
  }

  // SSE for live updates
  createEventSource(runId: string): EventSource {
    const url = `${this.baseURL}/api/runs/${runId}/stream`
    return new EventSource(url)
  }

  // Reports
  async getReport(runId: string) {
    return this.request<any>(`/api/reports/${runId}`)
  }

  getReportDownloadUrl(runId: string): string {
    return `${this.baseURL}/api/reports/${runId}/download`
  }

  // Artifacts
  getArtifactUrl(runId: string, filename: string): string {
    return `${this.baseURL}/api/artifacts/${runId}/${filename}`
  }
}

export const apiClient = new ApiClient(API_BASE_URL)