/**
 * Reranking strategies for search results
 * - ScoreFusion: Fast, combines existing vector + BM25 scores
 * - CrossEncoder: Slower but more accurate, uses gte-small to encode query+doc together
 */

import type { SearchResult } from './types.ts'
import { config } from './config.ts'

// Supabase.ai is globally available in edge runtime
declare const Supabase: any

/**
 * Score fusion reranker - combines existing scores
 */
export class ScoreFusionReranker {
  async rerank(
    query: string,
    results: SearchResult[],
    topK: number = 20
  ): Promise<SearchResult[]> {
    if (results.length === 0) return results

    console.log(`🔀 Reranking ${results.length} results with score fusion...`)

    const { vectorWeight, bm25Weight } = config.search.reranker.fusion

    // Combine vector similarity + BM25 scores
    const scored = results.map(result => {
      let score = (result.vector_similarity || 0) * vectorWeight

      if (result.bm25_rank) {
        score += result.bm25_rank * bm25Weight
      }

      return {
        ...result,
        rerank_score: score,
        similarity: score
      }
    })

    // Sort by combined score and return top K
    const reranked = scored
      .sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0))
      .slice(0, topK)

    console.log(`✅ Score fusion complete, returning top ${reranked.length}`)
    if (reranked.length > 0) {
      console.log(`   Top result: "${reranked[0].name.substring(0, 60)}..." (score: ${reranked[0].rerank_score?.toFixed(2)})`)
    }

    return reranked
  }
}

/**
 * Cross-encoder reranker - uses gte-small to encode query+doc together
 * Simulates cross-encoder behavior with bi-encoder by:
 * 1. Embedding query alone
 * 2. Embedding query + document together
 * 3. Comparing the combined embedding to measure relevance
 */
export class CrossEncoderReranker {
  private aiSession: any = null
  private embeddingModel: string

  constructor(embeddingModel: string = 'gte-small') {
    this.embeddingModel = embeddingModel
  }

  async rerank(
    query: string,
    results: SearchResult[],
    topK: number = 20
  ): Promise<SearchResult[]> {
    if (results.length === 0) return results

    console.log(`🔀 Reranking ${results.length} results with cross-encoder (gte-small)...`)

    try {
      // Initialize AI session if needed
      if (!this.aiSession) {
        console.log(`🤖 Initializing AI session for cross-encoding: ${this.embeddingModel}`)
        this.aiSession = new Supabase.ai.Session(this.embeddingModel)
      }

      // Embed query once
      const queryEmbedding = await this.aiSession.run(query, { mean_pool: true, normalize: true })

      // Score each result by embedding query + document together
      const scoredPromises = results.map(async (result) => {
        const docText = this.getDocumentText(result)

        // Embed query + document together
        const combinedText = `${query} ${docText}`
        const combinedEmbedding = await this.aiSession.run(combinedText, { mean_pool: true, normalize: true })

        // Calculate relevance as similarity between combined and query
        // Higher similarity means the document is more relevant to the query
        const relevanceScore = this.cosineSimilarity(combinedEmbedding, queryEmbedding)

        return {
          ...result,
          rerank_score: relevanceScore,
          similarity: relevanceScore
        }
      })

      const scored = await Promise.all(scoredPromises)

      // Sort by relevance score and return top K
      const reranked = scored
        .sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0))
        .slice(0, topK)

      console.log(`✅ Cross-encoder reranking complete, returning top ${reranked.length}`)
      if (reranked.length > 0) {
        console.log(`   Top result: "${reranked[0].name.substring(0, 60)}..." (score: ${reranked[0].rerank_score?.toFixed(4)})`)
      }

      return reranked

    } catch (error) {
      console.error('❌ Cross-encoder reranking failed, falling back to score fusion:', error)
      // Fallback to simple score fusion
      const fallback = new ScoreFusionReranker()
      return fallback.rerank(query, results, topK)
    }
  }

  /**
   * Extract text from document for cross-encoding
   */
  private getDocumentText(result: SearchResult): string {
    const { maxChars } = config.search.reranker.crossEncoder
    const parts: string[] = []

    if (result.name) parts.push(result.name)
    if (result.description) parts.push(result.description)

    // For models/repos, include task for better context
    if (result.doc_type === 'hf_model' || result.doc_type === 'github_repo') {
      if (result.task) parts.push(result.task)
    }

    return parts.join(' ').substring(0, maxChars)
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same length')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}

/**
 * Factory function to create reranker based on config
 */
export function createReranker(embeddingModel: string = 'gte-small') {
  const strategy = config.search.reranker.strategy

  if (strategy === 'cross-encoder') {
    return new CrossEncoderReranker(embeddingModel)
  }

  // Default to score fusion
  return new ScoreFusionReranker()
}
