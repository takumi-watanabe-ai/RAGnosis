/**
 * Repository for Google Trends data
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import type { SearchResult } from '../types.ts'

export class TrendsRepository {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  /**
   * Get top trending keywords by current interest
   */
  async getTopTrends(limit: number): Promise<SearchResult[]> {
    console.log(`📈 Search trends`)

    const { data, error } = await this.supabase
      .from('google_trends')
      .select('*')
      .order('current_interest', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ Trends search failed:', JSON.stringify(error, null, 2))
      return []
    }

    if (!data || data.length === 0) {
      return []
    }

    return data.map(t => this.mapToSearchResult(t))
  }

  /**
   * Map database record to SearchResult
   */
  private mapToSearchResult(t: any): SearchResult {
    return {
      id: t.id,
      name: t.keyword,
      description: `Search interest: ${t.current_interest}% (avg: ${t.avg_interest?.toFixed(1)}%, peak: ${t.peak_interest}%)`,
      url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(t.keyword)}`,
      doc_type: 'google_trend' as const,
      similarity: 1.0,
      rerank_score: 1.0,
      current_interest: t.current_interest,
      avg_interest: t.avg_interest,
      peak_interest: t.peak_interest
    }
  }
}
