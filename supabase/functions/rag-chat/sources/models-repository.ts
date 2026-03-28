/**
 * Repository for HuggingFace models data
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import type { SearchResult } from '../types.ts'

interface ModelsFilters {
  categories?: string[]
  authors?: string[]
}

export class ModelsRepository {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  /**
   * Get top models by downloads with optional filters
   */
  async getTopByDownloads(limit: number, filters?: ModelsFilters): Promise<SearchResult[]> {
    console.log(`📊 Top models by downloads (using market query)`)

    const hasFilters = (filters?.categories && filters.categories.length > 0) ||
                       (filters?.authors && filters.authors.length > 0)

    // Try with filters first if specified
    if (hasFilters) {
      const results = await this.queryWithFilters(limit, filters!)
      if (results.length > 0) {
        return results
      }
      console.log(`⚠️  No results with filters, falling back to unfiltered query`)
    }

    // Fall back to unfiltered query
    return await this.queryUnfiltered(limit)
  }

  /**
   * Query with category and author filters
   */
  private async queryWithFilters(limit: number, filters: ModelsFilters): Promise<SearchResult[]> {
    let query = this.supabase
      .from('documents')
      .select('*')
      .eq('doc_type', 'hf_model')

    if (filters.categories && filters.categories.length > 0) {
      query = query.in('rag_category', filters.categories)
    }

    if (filters.authors && filters.authors.length > 0) {
      query = query.in('author', filters.authors)
    }

    const { data, error } = await query
      .not('downloads', 'is', null)
      .order('downloads', { ascending: false })
      .limit(limit)

    if (error || !data || data.length === 0) {
      return []
    }

    return data.map(m => this.mapToSearchResult(m))
  }

  /**
   * Query without filters
   */
  private async queryUnfiltered(limit: number): Promise<SearchResult[]> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('doc_type', 'hf_model')
      .not('downloads', 'is', null)
      .order('downloads', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ Top models query failed:', error)
      return []
    }

    return (data || []).map(m => this.mapToSearchResult(m))
  }

  /**
   * Map database record to SearchResult
   */
  private mapToSearchResult(m: any): SearchResult {
    return {
      id: m.id,
      name: m.name,
      description: m.description || '',
      url: m.url,
      doc_type: 'hf_model' as const,
      similarity: 1.0,
      rerank_score: 1.0,
      downloads: m.downloads,
      likes: m.likes,
      ranking_position: m.ranking_position,
      author: m.author,
      task: m.task,
      rag_category: m.rag_category
    }
  }
}
