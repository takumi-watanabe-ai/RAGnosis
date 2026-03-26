/**
 * Database queries - all data access in one place.
 * Handles both vector search (semantic) and SQL queries (structured).
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import type { EnrichedResult } from '../_shared/types.ts'
import { config } from './config.ts'

// Lazy-loaded Supabase AI session for embeddings
let aiSession: any = null

/**
 * Vector search - semantic similarity on ragnosis_docs.
 * Generates embedding for query, then searches vector DB.
 */
export async function vectorSearch(
  supabase: SupabaseClient,
  queryText: string,
  options: {
    top_k?: number
    doc_type?: 'hf_model' | 'github_repo'
    rag_category?: string
  } = {}
): Promise<EnrichedResult[]> {
  const { top_k = 5, doc_type, rag_category } = options

  // Generate embedding for query using Supabase AI or Transformers.js
  const queryEmbedding = await generateEmbedding(queryText)

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: top_k,
    filter_doc_type: doc_type,
    filter_rag_category: rag_category
  })

  if (error) throw error
  if (!data) return []

  // Enrich with SQL details
  return await enrichFromSQL(supabase, data.map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    url: r.url,
    doc_type: r.doc_type,
    rag_category: r.rag_category,
    similarity: r.similarity
  })))
}

/**
 * Generate embedding for query text.
 * Uses Supabase AI with gte-small (matches Python pipeline: Supabase/gte-small).
 * Dimensions: 384 (same as all-MiniLM-L6-v2).
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Initialize AI session on first use (cached for subsequent requests)
    if (!aiSession) {
      console.log(`Initializing Supabase AI session with ${config.embedding.model}...`)
      // @ts-ignore - Supabase.ai is available in edge runtime
      aiSession = new Supabase.ai.Session(config.embedding.model)
      console.log('AI session initialized')
    }

    // Generate embedding with mean pooling and normalization
    const embedding = await aiSession.run(text, {
      mean_pool: true,
      normalize: true
    })

    // Verify dimensions match config
    if (embedding.length !== config.embedding.dimensions) {
      throw new Error(`Expected ${config.embedding.dimensions} dimensions, got ${embedding.length}`)
    }

    return embedding
  } catch (error) {
    console.error('Embedding generation failed:', error)
    throw new Error(`Failed to generate embedding: ${error.message}`)
  }
}

/**
 * SQL queries - structured queries for common patterns.
 */
export async function sqlQuery(
  supabase: SupabaseClient,
  queryType: 'top_models' | 'top_repos' | 'embedding_models' | 'trends' | 'search',
  params: { limit?: number; keyword?: string } = {}
): Promise<EnrichedResult[]> {
  const limit = params.limit || 5

  switch (queryType) {
    case 'top_models':
      return await getTopModels(supabase, limit)
    case 'top_repos':
      return await getTopRepos(supabase, limit)
    case 'embedding_models':
      return await getEmbeddingModels(supabase, limit)
    case 'trends':
      return await getTrends(supabase, limit)
    case 'search':
      return await searchAll(supabase, params.keyword || '', limit)
    default:
      return []
  }
}

// ============================================================================
// SQL Query Implementations
// ============================================================================

async function getTopModels(supabase: SupabaseClient, limit: number): Promise<EnrichedResult[]> {
  const { data } = await supabase
    .from('hf_models')
    .select('*')
    .eq('is_rag_related', true)
    .order('downloads', { ascending: false })
    .limit(limit)

  return transformModels(data || [])
}

async function getTopRepos(supabase: SupabaseClient, limit: number): Promise<EnrichedResult[]> {
  const { data } = await supabase
    .from('github_repos')
    .select('*')
    .eq('is_rag_related', true)
    .order('stars', { ascending: false })
    .limit(limit)

  return transformRepos(data || [])
}

async function getEmbeddingModels(supabase: SupabaseClient, limit: number): Promise<EnrichedResult[]> {
  const { data } = await supabase
    .from('hf_models')
    .select('*')
    .eq('is_rag_related', true)
    .eq('rag_category', 'embedding')
    .order('downloads', { ascending: false })
    .limit(limit)

  return transformModels(data || [])
}

async function getTrends(supabase: SupabaseClient, limit: number): Promise<any[]> {
  const { data } = await supabase
    .from('google_trends')
    .select('*')
    .order('current_interest', { ascending: false })
    .limit(limit)

  return (data || []).map(t => ({
    id: t.id,
    name: t.keyword,
    description: `Search interest: ${t.current_interest}%`,
    url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(t.keyword)}`,
    doc_type: 'trend',
    rag_category: 'trend',
    similarity: 1.0
  }))
}

async function searchAll(supabase: SupabaseClient, keyword: string, limit: number): Promise<EnrichedResult[]> {
  const k = keyword.toLowerCase()

  // Search models
  const { data: models } = await supabase
    .from('hf_models')
    .select('*')
    .eq('is_rag_related', true)
    .or(`model_name.ilike.%${k}%,description.ilike.%${k}%,author.ilike.%${k}%`)
    .limit(Math.ceil(limit / 2))

  // Search repos
  const { data: repos } = await supabase
    .from('github_repos')
    .select('*')
    .eq('is_rag_related', true)
    .or(`repo_name.ilike.%${k}%,description.ilike.%${k}%,owner.ilike.%${k}%`)
    .limit(Math.ceil(limit / 2))

  return [
    ...transformModels(models || []),
    ...transformRepos(repos || [])
  ].slice(0, limit)
}

// ============================================================================
// Enrichment & Transformation
// ============================================================================

async function enrichFromSQL(supabase: SupabaseClient, vectorResults: any[]): Promise<EnrichedResult[]> {
  const modelIds = vectorResults.filter(r => r.doc_type === 'hf_model').map(r => r.id)
  const repoIds = vectorResults.filter(r => r.doc_type === 'github_repo').map(r => r.id)

  const modelDetails = new Map()
  const repoDetails = new Map()

  if (modelIds.length > 0) {
    const { data } = await supabase
      .from('hf_models')
      .select('*')
      .in('id', modelIds)
      .order('snapshot_date', { ascending: false })

    if (data) {
      for (const m of data) {
        if (!modelDetails.has(m.id)) modelDetails.set(m.id, m)
      }
    }
  }

  if (repoIds.length > 0) {
    const { data } = await supabase
      .from('github_repos')
      .select('*')
      .in('id', repoIds)
      .order('snapshot_date', { ascending: false })

    if (data) {
      for (const r of data) {
        if (!repoDetails.has(r.id)) repoDetails.set(r.id, r)
      }
    }
  }

  return vectorResults.map(vr => {
    const enriched = { ...vr }
    const details = vr.doc_type === 'hf_model' ? modelDetails.get(vr.id) : repoDetails.get(vr.id)

    if (details) {
      if (vr.doc_type === 'hf_model') {
        enriched.downloads = details.downloads
        enriched.likes = details.likes
        enriched.author = details.author
        enriched.task = details.task
      } else {
        enriched.stars = details.stars
        enriched.forks = details.forks
        enriched.owner = details.owner
        enriched.language = details.language
      }
      enriched.ranking_position = details.ranking_position
    }

    return enriched
  })
}

function transformModels(models: any[]): EnrichedResult[] {
  return models.map(m => ({
    id: m.id,
    name: m.model_name,
    description: m.description || '',
    url: m.url,
    doc_type: 'hf_model',
    rag_category: m.rag_category,
    similarity: 1.0,
    downloads: m.downloads,
    likes: m.likes,
    ranking_position: m.ranking_position,
    author: m.author,
    task: m.task
  }))
}

function transformRepos(repos: any[]): EnrichedResult[] {
  return repos.map(r => ({
    id: r.id,
    name: r.repo_name,
    description: r.description || '',
    url: r.url,
    doc_type: 'github_repo',
    rag_category: r.rag_category,
    similarity: 1.0,
    stars: r.stars,
    forks: r.forks,
    ranking_position: r.ranking_position,
    owner: r.owner,
    language: r.language
  }))
}
