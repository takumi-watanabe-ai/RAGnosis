/**
 * Database queries - simplified and clean
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { config } from './config.ts'

let aiSession: any = null

// ============================================================================
// Keyword-Based Reranking (BM25-like scoring)
// ============================================================================

function rerankResults(query: string, results: any[]): any[] {
  if (results.length === 0) return results
  if (results.length <= 3) return results

  // Extract query terms (lowercase, remove common words)
  const stopWords = new Set(['what', 'how', 'why', 'when', 'where', 'which', 'who', 'is', 'are', 'the', 'a', 'an', 'for', 'to', 'in', 'on', 'at', 'do', 'does'])
  const queryTerms = query.toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 2 && !stopWords.has(term))

  // Score each result
  const scored = results.map(result => {
    const text = `${result.name} ${result.description || ''}`.toLowerCase()

    // Count term matches and track missing terms
    let termScore = 0
    let matchedTerms = 0

    queryTerms.forEach(term => {
      // Escape special regex characters
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`\\b${escapedTerm}\\w*\\b`, 'gi')
      const matches = text.match(regex)
      if (matches) {
        matchedTerms++
        termScore += matches.length
        // HUGE bonus for matching query terms in the title/name
        // This ensures "Supabase/gte-small" ranks higher than blog articles
        if (result.name.toLowerCase().includes(term)) {
          termScore += 10 // Increased from 5 to 10
        }
      }
    })

    const missingTerms = queryTerms.length - matchedTerms

    // Completeness ratio (0-1)
    const completenessRatio = matchedTerms / Math.max(queryTerms.length, 1)

    // Normalize term score
    const normalizedTermScore = Math.min(termScore / (queryTerms.length * 6), 1.0)

    // STRICT: Results must match ALL terms, or score drops dramatically
    // If missing ANY term, multiply final score by completeness ratio squared
    const completenessMultiplier = completenessRatio * completenessRatio // Squared penalty

    // Calculate base score
    const baseScore = (result.similarity * 0.4) + (normalizedTermScore * 0.6)

    // Apply completeness multiplier (missing terms cause exponential drop)
    const rerank_score = baseScore * completenessMultiplier

    return { ...result, rerank_score, term_matches: termScore, missing: missingTerms }
  })

  return scored
    .sort((a, b) => b.rerank_score - a.rerank_score)
    .slice(0, 5)
}

// ============================================================================
// Embedding Generation
// ============================================================================

async function generateEmbedding(text: string): Promise<number[]> {
  const timeoutMs = 15000 // 15 second timeout for embedding generation

  const embedPromise = (async () => {
    try {
      if (!aiSession) {
        console.log(`🤖 Initializing AI session with model: ${config.embedding.model}`)
        // @ts-ignore
        aiSession = new Supabase.ai.Session(config.embedding.model)
        console.log(`✅ AI session initialized`)
      }
      console.log(`🔢 Generating embedding for: "${text.substring(0, 50)}..."`)
      const embedding = await aiSession.run(text, { mean_pool: true, normalize: true })
      console.log(`✅ Embedding generated: ${embedding.length} dimensions`)
      if (embedding.length !== config.embedding.dimensions) {
        throw new Error(`Expected ${config.embedding.dimensions} dimensions, got ${embedding.length}`)
      }
      return embedding
    } catch (error) {
      console.error(`❌ Embedding generation failed:`, error)
      throw error
    }
  })()

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Embedding generation timed out after ${timeoutMs}ms. Model may need to download.`)), timeoutMs)
  })

  return await Promise.race([embedPromise, timeoutPromise])
}

// ============================================================================
// Unified Smart Search (with entity-based search)
// ============================================================================

export interface SearchEntities {
  frameworks?: string[]
  vector_dbs?: string[]
  models?: string[]
  companies?: string[]
  concepts?: string[]
}

export async function smartSearch(
  supabase: SupabaseClient,
  query: string,
  top_k: number = 5,
  preferredSource?: string,
  entities?: SearchEntities
): Promise<any[]> {

  // AGENTIC ROUTING: Choose strategy based on query intent
  console.log(`🎯 Routing strategy: ${preferredSource}`)

  // For market intelligence (top/best/popular), use SQL-first approach
  if (preferredSource === 'sql_models' || preferredSource === 'sql_repos') {
    return await sqlFirstSearch(supabase, query, top_k, preferredSource, entities)
  }

  // For semantic queries (how-to, concepts, troubleshooting), use vector-first
  return await vectorFirstSearch(supabase, query, top_k)
}

// SQL-First: Rank by metrics (downloads, stars, etc.)
async function sqlFirstSearch(
  supabase: SupabaseClient,
  query: string,
  top_k: number,
  source: string,
  entities?: SearchEntities
): Promise<any[]> {
  console.log(`📊 SQL-first search for ${source}`)

  if (source === 'sql_models') {
    // Build query dynamically based on extracted entities
    let dbQuery = supabase.from('hf_models').select('*')

    // Use concepts from entities to filter by category
    if (entities?.concepts && entities.concepts.length > 0) {
      const categoryMap: Record<string, string> = {
        'embedding': 'embedding',
        'embeddings': 'embedding',
        'rerank': 'reranking',
        'reranking': 'reranking',
        'reranker': 'reranking'
      }

      for (const concept of entities.concepts) {
        const category = categoryMap[concept.toLowerCase()]
        if (category) {
          dbQuery = dbQuery.eq('rag_category', category)
          console.log(`🎯 Filtering by category='${category}' from concept='${concept}'`)
          break
        }
      }
    }

    // Filter by company/author if specified
    if (entities?.companies && entities.companies.length > 0) {
      dbQuery = dbQuery.in('author', entities.companies)
      console.log(`🎯 Filtering by authors: ${entities.companies.join(', ')}`)
    }

    const { data, error } = await dbQuery
      .order('snapshot_date', { ascending: false })
      .order('downloads', { ascending: false })
      .limit(top_k * 4)  // Get more to deduplicate

    if (error) {
      console.error(`❌ SQL models search failed:`, error)
      return []
    }

    // Deduplicate by model_name, keep latest snapshot
    const seen = new Map()
    const deduped = (data || []).filter(m => {
      if (seen.has(m.model_name)) return false
      seen.set(m.model_name, true)
      return true
    })

    return deduped.slice(0, top_k).map(m => ({
      id: m.id,
      name: m.model_name,
      description: m.description,
      url: m.url,
      doc_type: 'hf_model',
      similarity: 1.0,
      rerank_score: 1.0,
      downloads: m.downloads,
      likes: m.likes,
      ranking_position: m.ranking_position,
      author: m.author,
      rag_category: m.rag_category
    })).slice(0, top_k)
  }

  if (source === 'sql_repos') {
    // Build query dynamically based on extracted entities
    let dbQuery = supabase.from('github_repos').select('*')

    // Use frameworks/vector_dbs from entities
    if (entities?.frameworks && entities.frameworks.length > 0) {
      dbQuery = dbQuery.eq('rag_category', 'rag_framework')
      console.log(`🎯 Filtering for rag_category='rag_framework'`)
    } else if (entities?.vector_dbs && entities.vector_dbs.length > 0) {
      dbQuery = dbQuery.eq('rag_category', 'vector_database')
      console.log(`🎯 Filtering for rag_category='vector_database'`)
    }

    // Filter by company/owner if specified
    if (entities?.companies && entities.companies.length > 0) {
      dbQuery = dbQuery.in('owner', entities.companies)
      console.log(`🎯 Filtering by owners: ${entities.companies.join(', ')}`)
    }

    const { data, error } = await dbQuery
      .order('snapshot_date', { ascending: false })
      .order('stars', { ascending: false })
      .limit(top_k * 4)  // Get more to deduplicate

    if (error) {
      console.error(`❌ SQL repos search failed:`, error)
      return []
    }

    // Deduplicate by repo_name, keep latest snapshot
    const seen = new Map()
    const deduped = (data || []).filter(r => {
      if (seen.has(r.repo_name)) return false
      seen.set(r.repo_name, true)
      return true
    })

    return deduped.slice(0, top_k).map(r => ({
      id: r.id,
      name: r.repo_name,
      description: r.description,
      url: r.url,
      doc_type: 'github_repo',
      similarity: 1.0,
      rerank_score: 1.0,
      stars: r.stars,
      forks: r.forks,
      owner: r.owner,
      rag_category: r.rag_category
    })).slice(0, top_k)
  }

  return []
}

// Vector-First: Semantic similarity
async function vectorFirstSearch(
  supabase: SupabaseClient,
  query: string,
  top_k: number
): Promise<any[]> {
  console.log(`🔍 Vector-first search`)

  const embedding = await generateEmbedding(query)

  const { data, error } = await supabase.rpc('vector_search_all_docs', {
    query_embedding: embedding,
    match_limit: top_k * 2
  })

  if (error) {
    console.error(`❌ Vector search failed:`, error)
    return []
  }

  let results = data || []

  // Deduplicate by URL (keep highest similarity)
  const urlMap = new Map<string, any>()
  results.forEach(r => {
    if (!urlMap.has(r.url) || r.similarity > urlMap.get(r.url).similarity) {
      urlMap.set(r.url, r)
    }
  })
  results = Array.from(urlMap.values()).sort((a, b) => b.similarity - a.similarity)

  // Rerank with keyword matching for better relevance
  results = rerankResults(query, results)

  // Enrich repos/models with SQL metadata
  const repoNames = results.filter(r => r.doc_type === 'github_repo').map(r => r.name)
  const modelNames = results.filter(r => r.doc_type === 'hf_model').map(r => r.name)

  if (repoNames.length > 0 || modelNames.length > 0) {
    console.log(`🔧 Enriching ${modelNames.length} models, ${repoNames.length} repos`)

    const [models, repos] = await Promise.all([
      modelNames.length > 0 ? searchModels(supabase, modelNames.join(' '), modelNames.length) : [],
      repoNames.length > 0 ? searchRepos(supabase, repoNames.join(' '), repoNames.length) : []
    ])

    const enriched = results.map(r => {
      const match = [...models, ...repos].find(e => e.name === r.name)
      return match ? { ...r, ...match, similarity: r.similarity } : r
    }).slice(0, top_k)

    return enriched
  }

  return results.slice(0, top_k)
}

// ============================================================================
// Individual Search Functions
// ============================================================================

async function searchModels(supabase: SupabaseClient, query: string, limit: number) {
  const { data, error } = await supabase.rpc('keyword_search_models', {
    search_query: query,
    query_limit: limit
  })

  if (error) {
    console.error(`❌ RPC keyword_search_models failed:`, error)
    return []
  }

  if (!data?.success) {
    console.warn(`⚠️ keyword_search_models returned no success:`, data)
    return []
  }

  return (data.data.results || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    url: m.url,
    doc_type: 'hf_model',
    similarity: m.similarity,
    downloads: m.downloads,
    likes: m.likes,
    author: m.author
  }))
}

async function searchRepos(supabase: SupabaseClient, query: string, limit: number) {
  const { data, error } = await supabase.rpc('keyword_search_repos', {
    search_query: query,
    query_limit: limit
  })

  if (error) {
    console.error(`❌ RPC keyword_search_repos failed:`, error)
    return []
  }

  if (!data?.success) {
    console.warn(`⚠️ keyword_search_repos returned no success:`, data)
    return []
  }

  return (data.data.results || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    url: r.url,
    doc_type: 'github_repo',
    similarity: r.similarity,
    stars: r.stars,
    forks: r.forks,
    owner: r.author
  }))
}

