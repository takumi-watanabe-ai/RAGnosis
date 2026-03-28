/**
 * Repository for GitHub repos data
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import type { SearchResult } from '../types.ts'

interface ReposFilters {
  categories?: string[]
  owners?: string[]
}

export class ReposRepository {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  /**
   * Get top repos by stars with optional filters
   */
  async getTopByStars(limit: number, filters?: ReposFilters): Promise<SearchResult[]> {
    console.log(`📊 Top repos by stars (using market query)`)

    const hasFilters = (filters?.categories && filters.categories.length > 0) ||
                       (filters?.owners && filters.owners.length > 0)

    // Try with filters first if specified
    if (hasFilters) {
      const results = await this.queryWithFilters(limit, filters!)
      if (results.length > 0) {
        return results
      }
      console.log(`⚠️  No repos with filters, falling back to unfiltered`)
    }

    // Fall back to unfiltered query
    return await this.queryUnfiltered(limit)
  }

  /**
   * Query with category and owner filters
   */
  private async queryWithFilters(limit: number, filters: ReposFilters): Promise<SearchResult[]> {
    let query = this.supabase
      .from('documents')
      .select('*')
      .eq('doc_type', 'github_repo')

    if (filters.categories && filters.categories.length > 0) {
      query = query.in('rag_category', filters.categories)
    }

    if (filters.owners && filters.owners.length > 0) {
      query = query.in('owner', filters.owners)
    }

    const { data, error } = await query
      .not('stars', 'is', null)
      .order('stars', { ascending: false })
      .limit(limit)

    if (error || !data || data.length === 0) {
      return []
    }

    return data.map(r => this.mapToSearchResult(r))
  }

  /**
   * Query without filters
   */
  private async queryUnfiltered(limit: number): Promise<SearchResult[]> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('doc_type', 'github_repo')
      .not('stars', 'is', null)
      .order('stars', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ Top repos query failed:', JSON.stringify(error, null, 2))
      return []
    }

    return (data || []).map(r => this.mapToSearchResult(r))
  }

  /**
   * Map database record to SearchResult
   */
  private mapToSearchResult(r: any): SearchResult {
    return {
      id: r.id,
      name: r.name,
      description: r.description || '',
      url: r.url,
      doc_type: 'github_repo' as const,
      similarity: 1.0,
      rerank_score: 1.0,
      stars: r.stars,
      forks: r.forks,
      owner: r.owner,
      language: r.language,
      rag_category: r.rag_category
    }
  }
}
