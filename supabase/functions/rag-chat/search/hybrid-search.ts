/**
 * Hybrid search - combines vector (k-NN) + full-text (BM25) search
 * Uses Reciprocal Rank Fusion (RRF) to merge results
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import type { SearchResult } from '../types.ts'

// Supabase.ai is globally available in edge runtime
declare const Supabase: any

interface SearchConfig {
  candidateCount: number
  descriptionMax: number
}

export class HybridSearch {
  private aiSession: any = null

  constructor(
    private supabase: ReturnType<typeof createClient>,
    private config: SearchConfig,
    private embeddingModel: string,
    private enableStratifiedSampling: boolean = false
  ) {}

  /**
   * Perform hybrid search combining vector and text search
   */
  async search(
    query: string,
    limit: number,
    weights?: { blog: number; structured: number }
  ): Promise<SearchResult[]> {
    console.log(`🔍 Hybrid search (k-NN + BM25): "${query}"`)

    // Run both searches in parallel
    const [vectorResults, textResults] = await Promise.all([
      this.performVectorSearch(query),
      this.performTextSearch(query)
    ])

    console.log(`📊 Vector search: ${vectorResults.length} results`)
    console.log(`📊 Text search: ${textResults.length} results`)

    // Merge with Reciprocal Rank Fusion (RRF)
    const merged = this.mergeWithRRF(vectorResults, textResults, this.config.candidateCount)
    console.log(`📊 Merged: ${merged.length} unique results`)

    // Apply stratified sampling for diversity if enabled and weights provided
    const final = (this.enableStratifiedSampling && weights)
      ? this.stratifiedSample(merged, limit, weights)
      : merged.slice(0, limit)

    if (!this.enableStratifiedSampling && weights) {
      console.log(`⚠️  Stratified sampling disabled - using pure RRF scores`)
    }

    console.log(`✅ Hybrid search complete: ${final.length} results`)

    return final
  }

  /**
   * Vector search using k-NN
   */
  private async performVectorSearch(query: string): Promise<SearchResult[]> {
    // Generate embedding
    let embedding: number[]
    try {
      if (!this.aiSession) {
        console.log(`🤖 Initializing AI session with model: ${this.embeddingModel}`)
        // @ts-ignore
        this.aiSession = new Supabase.ai.Session(this.embeddingModel)
      }

      embedding = await this.aiSession.run(query, { mean_pool: true, normalize: true })
    } catch (error) {
      console.error('❌ Embedding generation failed:', error)
      return []
    }

    // Vector search
    const { data, error } = await this.supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_count: this.config.candidateCount,
      filter_doc_type: null,
      filter_rag_category: null
    })

    if (error) {
      console.error('❌ Vector search failed:', error)
      return []
    }

    return (data || []).map((d: any) => this.mapToSearchResult(d, d.similarity || 0))
  }

  /**
   * Full-text search using BM25
   */
  private async performTextSearch(query: string): Promise<SearchResult[]> {
    const { data, error } = await this.supabase.rpc('text_search_documents', {
      search_query: query,
      match_count: this.config.candidateCount,
      filter_doc_type: null,
      filter_rag_category: null
    })

    if (error) {
      console.error('❌ Text search failed:', error)
      return []
    }

    if (!data || !data.success) {
      console.error('❌ Text search returned error:', data?.error)
      return []
    }

    return (data.data?.results || []).map((d: any) => this.mapToSearchResult(d, d.rank || 0))
  }

  /**
   * Merge results using Reciprocal Rank Fusion (RRF)
   * RRF formula: score(d) = sum(1 / (k + rank(d))) for each ranking
   */
  private mergeWithRRF(
    vectorResults: SearchResult[],
    textResults: SearchResult[],
    limit: number
  ): SearchResult[] {
    const k = 60  // RRF constant (typical value)
    const scores = new Map<string, { result: SearchResult; score: number }>()

    // Add vector search scores
    vectorResults.forEach((result, index) => {
      const rank = index + 1
      const score = 1 / (k + rank)
      scores.set(result.id, { result, score })
    })

    // Add text search scores
    textResults.forEach((result, index) => {
      const rank = index + 1
      const score = 1 / (k + rank)

      if (scores.has(result.id)) {
        // Document appears in both - add scores
        scores.get(result.id)!.score += score
      } else {
        scores.set(result.id, { result, score })
      }
    })

    // Apply boost to models/repos (compensate for shorter content vs long blog articles)
    // BM25 heavily penalizes short documents - need significant boost to compete
    // Increased from 2x to 5x to better surface structured data that matches the query
    scores.forEach((value) => {
      const docType = value.result.doc_type
      if (docType === 'hf_model' || docType === 'github_repo') {
        value.score *= 5.0  // 5x boost to compensate for BM25 length penalty
      }
    })

    // Sort by RRF score and deduplicate by URL
    const sorted = Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .map(({ result, score }) => ({
        ...result,
        rerank_score: score,
        similarity: score
      }))

    // Deduplicate by URL (keep highest score)
    const urlMap = new Map<string, SearchResult>()
    sorted.forEach(r => {
      if (!urlMap.has(r.url) || (r.rerank_score || 0) > (urlMap.get(r.url)!.rerank_score || 0)) {
        urlMap.set(r.url, r)
      }
    })

    return Array.from(urlMap.values()).slice(0, limit)
  }

  /**
   * Stratified sampling to ensure diversity across doc types
   * Enforces target distribution between blog articles and structured data
   */
  private stratifiedSample(
    results: SearchResult[],
    targetCount: number,
    weights: { blog: number; structured: number }
  ): SearchResult[] {
    // Separate by category
    const blogs = results.filter(r => r.doc_type === 'blog_article')
    const structured = results.filter(r => r.doc_type === 'hf_model' || r.doc_type === 'github_repo')

    console.log(`📊 Pre-sampling: ${blogs.length} blogs, ${structured.length} structured`)

    // Calculate quotas based on weights
    const blogQuota = Math.round(targetCount * weights.blog)
    const structuredQuota = Math.round(targetCount * weights.structured)

    console.log(`📊 Quotas: ${blogQuota} blogs (${Math.round(weights.blog * 100)}%), ${structuredQuota} structured (${Math.round(weights.structured * 100)}%)`)

    // Sample from each category (already sorted by RRF score)
    const sampledBlogs = blogs.slice(0, blogQuota)
    const sampledStructured = structured.slice(0, structuredQuota)

    // Combine samples
    let combined = [...sampledBlogs, ...sampledStructured]

    // If we're short of target (due to insufficient results in one category), backfill from the other
    if (combined.length < targetCount) {
      const remaining = targetCount - combined.length
      const leftoverBlogs = blogs.slice(blogQuota)
      const leftoverStructured = structured.slice(structuredQuota)
      const backfill = [...leftoverBlogs, ...leftoverStructured]
        .sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0))
        .slice(0, remaining)
      combined.push(...backfill)
    }

    // Re-sort by RRF score to maintain relevance ordering
    const final = combined
      .sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0))
      .slice(0, targetCount)

    const finalBlogs = final.filter(r => r.doc_type === 'blog_article').length
    const finalStructured = final.filter(r => r.doc_type === 'hf_model' || r.doc_type === 'github_repo').length
    console.log(`📊 Final mix: ${finalBlogs} blogs, ${finalStructured} structured`)

    return final
  }

  /**
   * Map database result to SearchResult
   */
  private mapToSearchResult(d: any, score: number): SearchResult {
    return {
      id: d.id,
      name: d.name || '',
      description: d.description || d.text?.substring(0, this.config.descriptionMax) || '',
      url: d.url,
      doc_type: d.doc_type,
      similarity: score,
      rerank_score: score,
      rag_category: d.rag_category,
      content: d.text,
      downloads: d.downloads,
      stars: d.stars,
      likes: d.likes,
      forks: d.forks,
      ranking_position: d.ranking_position,
      author: d.author,
      owner: d.owner,
      language: d.language,
      task: d.task,
      published_at: d.published_at,
      content_source: d.content_source,
      snapshot_date: d.snapshot_date
    }
  }
}
