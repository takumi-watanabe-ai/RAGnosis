/**
 * RAGnosis Query API
 *
 * Simple orchestrator for RAG market intelligence queries.
 * Routes to vector search (semantic) or SQL queries (structured).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import type { QueryRequest, QueryResponse } from '../_shared/types.ts'
import { vectorSearch, sqlQuery } from './db.ts'
import { generateAnswer } from './llm.ts'
import { routeQuery } from './router.ts'
import { config } from './config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': config.cors.allowOrigin,
  'Access-Control-Allow-Headers': config.cors.allowHeaders,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, top_k = 5, use_vector = false }: QueryRequest & { use_vector?: boolean } = await req.json()

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      config.database.url,
      config.database.serviceRoleKey
    )

    console.log(`📝 Query: "${query}"`)

    // Route query using routing table (Open/Closed principle)
    const route = routeQuery(query)
    console.log(`🎯 Route: ${route.name}`)

    let results: any[] = []
    if (route.handler === 'sql' && route.sqlType) {
      results = await sqlQuery(supabase, route.sqlType, { limit: top_k })
    } else {
      results = await vectorSearch(supabase, query, { top_k })
    }

    if (results.length === 0) {
      return new Response(
        JSON.stringify({
          answer: `No results found for "${query}".\n\nTry: "top RAG models", "embedding models", "top RAG frameworks", or "RAG trends"`,
          sources: [],
          confidence: 'low',
          count: 0
        } as QueryResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate natural language answer
    const answer = await generateAnswer(query, results)

    // Transform results to match Streamlit app's expected format
    const formattedSources = results.map((r: any, i: number) => ({
      text: r.description || r.name || '',
      score: r.similarity || (1.0 - i * 0.05),
      type: r.doc_type || 'unknown',
      metadata: {
        title: r.name || 'N/A',
        company: r.author || r.owner || 'N/A',
        url: r.url || '',
        downloads: r.downloads,
        stars: r.stars,
        likes: r.likes,
        interest: r.current_interest,
        date: r.snapshot_date
      }
    }))

    const response: QueryResponse = {
      answer,
      sources: formattedSources as any,
      confidence: 'high',
      count: results.length
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Extract meaningful keyword from query.
 */
function extractKeyword(query: string): string {
  const cleaned = query
    .toLowerCase()
    .replace(/\b(what|are|the|is|how|about|top|best|most|popular|for|which|show|me|find|get|list)\b/gi, '')
    .trim()

  const words = cleaned.split(/\s+/).filter(w => w.length > 2)
  return words[0] || query
}
