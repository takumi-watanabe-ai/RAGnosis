// Shared types for RAGnosis edge functions

export interface VectorResult {
  id: string
  name: string
  description: string
  url: string
  doc_type: 'hf_model' | 'github_repo'
  rag_category: string
  similarity: number
}

export interface EnrichedResult extends VectorResult {
  // From hf_models or github_repos
  downloads?: number
  likes?: number
  stars?: number
  forks?: number
  ranking_position?: number
  tags?: string[]
  topics?: string[]
  language?: string
  author?: string
  owner?: string
  task?: string
}

export interface QueryRequest {
  query: string
  top_k?: number
  filter_doc_type?: 'hf_model' | 'github_repo'
  filter_rag_category?: string
}

export interface QueryResponse {
  answer: string
  sources: EnrichedResult[]
  confidence: 'high' | 'medium' | 'low'
  count: number
}
