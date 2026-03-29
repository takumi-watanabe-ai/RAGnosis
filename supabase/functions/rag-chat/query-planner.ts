/**
 * Query Planner - Step 1: Analyze + Plan
 * Single LLM call to determine intent and plan data sources
 */

import type { QueryPlan } from './types.ts'
import { config } from './config.ts'

/**
 * Analyze query and create execution plan using hybrid routing
 * Routes explicit ranking queries to specialized DB functions
 * Everything else goes to semantic search
 */
export async function createQueryPlan(query: string, top_k: number = 5): Promise<QueryPlan> {
  const lowerQuery = query.toLowerCase()

  // ROUTE 1: Explicit "top X embedding/reranking models" → Direct DB ranking
  // Pattern: "top/best/most popular/show me" + number? + "embedding/reranking" + "models"
  const modelRankingPatterns = [
    /\b(top|best|most popular|show me|list)\s+(\d+\s+)?(embedding|reranking|sentence[\s-]?transformer)s?\s+models?\b/,
    /\b(top|best|most popular)\s+(\d+\s+)?models?\s+(for\s+)?(embedding|reranking)\b/,
    /\bmost popular embedding model\b/
  ]

  for (const pattern of modelRankingPatterns) {
    if (pattern.test(lowerQuery)) {
      console.log(`📋 Route: top_models_by_downloads (explicit model ranking query)`)
      return {
        intent: 'market_intelligence',
        confidence: 0.95,
        is_valid: true,
        reason: 'Explicit model ranking query - using direct DB sort',
        data_sources: [{
          source: 'top_models_by_downloads',
          params: { limit: top_k }
        }]
      }
    }
  }

  // ROUTE 2: Explicit "top X repos/frameworks" → Direct DB ranking
  // Pattern: "top/best/most popular/show me" + number? + "repo/framework/library"
  const repoRankingPatterns = [
    /\b(top|best|most popular|show me|list)\s+(\d+\s+)?(rag\s+)?(repos?|repositories|frameworks?|libraries)\b/,
    /\b(top|best|most popular)\s+(\d+\s+)?github\s+repos?\b/,
    /\bwhat are the top.*repos?\b/
  ]

  for (const pattern of repoRankingPatterns) {
    if (pattern.test(lowerQuery)) {
      console.log(`📋 Route: top_repos_by_stars (explicit repo ranking query)`)
      return {
        intent: 'market_intelligence',
        confidence: 0.95,
        is_valid: true,
        reason: 'Explicit repo ranking query - using direct DB sort',
        data_sources: [{
          source: 'top_repos_by_stars',
          params: { limit: top_k }
        }]
      }
    }
  }

  // ROUTE 3: Everything else → Semantic search (hybrid vector + BM25)
  // Includes: how-to, comparisons, conceptual questions, specific model queries, etc.
  const weights = determineWeights(query)
  console.log(`📋 Route: vector_search_unified (semantic search, weights: ${Math.round(weights.blog * 100)}% blog, ${Math.round(weights.structured * 100)}% structured)`)

  return {
    intent: 'conceptual',
    confidence: 1.0,
    is_valid: true,
    reason: 'Using unified semantic search with query-adaptive diversity',
    data_sources: [{
      source: 'vector_search_unified',
      params: { query, limit: top_k, weights }
    }]
  }
}

/**
 * Determine diversity weights based on query intent
 * Returns percentage split between blog articles and structured data (models/repos)
 *
 * IMPORTANT: Keep weights balanced to avoid forcing low-quality matches.
 * Stratified sampling will ensure diversity, but shouldn't override relevance too strongly.
 */
function determineWeights(query: string): { blog: number; structured: number } {
  const lowerQuery = query.toLowerCase()

  // Pattern 1: Explicit "top X models/repos" queries → balanced with slight structured preference (50/50)
  // Don't force too high structured % - if models don't match well, blogs explaining models are better
  if (/\b(top|best|popular|leading|show|list|find)\s+\d*\s*(model|repo|framework|library|database|tool|package)/i.test(lowerQuery)) {
    return { blog: 0.2, structured: 0.8 }
  }

  // Pattern 2: How-to/tutorial/implementation queries → favor blogs (80/20)
  if (/\b(how to|how do|tutorial|guide|step[\s-]?by[\s-]?step|walkthrough|example|implement|build|create|setup|configure)/i.test(lowerQuery)) {
    return { blog: 0.8, structured: 0.2 }
  }

  // Pattern 3: Comparison queries → favor blogs for depth (70/30)
  if (/\b(vs|versus|compare|comparison|difference|better|choose|which)/i.test(lowerQuery)) {
    return { blog: 0.7, structured: 0.3 }
  }

  // Pattern 4: Conceptual/explanation queries → favor blogs (75/25)
  if (/\b(what is|what are|explain|understand|learn|why|when|concept)/i.test(lowerQuery)) {
    return { blog: 0.75, structured: 0.25 }
  }

  // Default: favor blogs slightly (70/30) - they typically have more context
  return { blog: 0.7, structured: 0.3 }
}

