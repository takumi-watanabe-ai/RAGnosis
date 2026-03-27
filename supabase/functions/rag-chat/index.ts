/**
 * RAGnosis Query API - With LLM-Based Query Analysis
 *
 * Uses Ollama (qwen2.5:3b) for intelligent query preprocessing
 * Inspired by finance-agent's best practices
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { smartSearch } from './db.ts'
import { generateAnswer } from './llm.ts'
import { config } from './config.ts'
import { analyzeQuery, getRoutingExplanation } from './query-analyzer.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': config.cors.allowOrigin,
  'Access-Control-Allow-Headers': config.cors.allowHeaders,
}

/**
 * Format market intelligence results directly (no LLM to prevent hallucination)
 */
function formatMarketIntelligence(query: string, results: any[]): string {
  const isModelQuery = results[0]?.doc_type === 'hf_model'

  let answer = ''

  results.forEach((item, i) => {
    const num = i + 1
    answer += `\n${num}. **[${item.name}](${item.url})**\n`

    if (isModelQuery) {
      if (item.downloads) answer += `   - Downloads: ${item.downloads.toLocaleString()}\n`
      if (item.likes) answer += `   - Likes: ${item.likes.toLocaleString()}\n`
      if (item.ranking_position) answer += `   - Ranking: #${item.ranking_position}\n`
      if (item.author) answer += `   - Author: ${item.author}\n`
    } else {
      if (item.stars) answer += `   - Stars: ${item.stars.toLocaleString()}\n`
      if (item.forks) answer += `   - Forks: ${item.forks.toLocaleString()}\n`
      if (item.owner) answer += `   - Owner: ${item.owner}\n`
      if (item.language) answer += `   - Language: ${item.language}\n`
    }
  })

  return answer.trim()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, top_k = 5 } = await req.json()

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(config.database.url, config.database.serviceRoleKey)
    console.log(`📝 Query: "${query}"`)

    // Analyze query with LLM (validate, classify intent, extract entities, determine routing)
    const analysis = await analyzeQuery(query)
    console.log(`🎯 Intent: ${analysis.intent} | Source: ${analysis.source} | Mode: ${analysis.answer_mode} | Confidence: ${(analysis.confidence * 100).toFixed(0)}%`)
    console.log(`🔍 ${getRoutingExplanation(analysis)}`)

    // Reject invalid queries early
    if (!analysis.is_valid) {
      return new Response(
        JSON.stringify({
          answer: analysis.reason || 'Invalid query',
          sources: [],
          confidence: 'low',
          count: 0,
          suggestions: analysis.suggestions || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Simple retry: if no results, ask LLM for broader query
    let searchQuery = query
    let results = await smartSearch(supabase, searchQuery, top_k, analysis.source, analysis.entities)

    if (results.length === 0) {
      try {
        const retryPrompt = `No results for: "${query}". Suggest broader search (2-5 words, no explanation):`
        const { url: ollamaUrl, model: ollamaModel } = config.llm
        const res = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: ollamaModel, prompt: retryPrompt, stream: false, options: { temperature: 0.3, num_predict: 50 } })
        })
        if (res.ok) {
          const data = await res.json()
          searchQuery = data.response?.trim() || query
          results = await smartSearch(supabase, searchQuery, top_k, 'blog', {})
        }
      } catch (error) {
        console.error('Retry failed:', error)
      }
    }

    if (results.length === 0) {
      return new Response(
        JSON.stringify({
          answer: `No results found for "${query}". Try rephrasing or being more specific.`,
          sources: [],
          confidence: 'low',
          count: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For market intelligence: use direct formatting for "top/list" queries, LLM for specific questions
    let answer: string
    const isListQuery = /\b(top|best|popular|trending|list)\b/i.test(query)

    if (analysis.intent === 'market_intelligence' && isListQuery && results.length > 0) {
      // Direct formatting for lists (prevents hallucination)
      answer = formatMarketIntelligence(query, results)
    } else {
      // Use LLM for specific questions (can extract info from descriptions)
      answer = await generateAnswer(query, results, analysis.intent, analysis.answer_mode)
    }

    // Format sources
    const sources = results.map((r: any, i: number) => ({
      text: r.description || r.name || '',
      score: r.similarity || (1.0 - i * 0.05),
      type: r.doc_type,
      metadata: {
        title: r.name?.replace(/\s*\(part\s+\d+\/\d+\)\s*$/i, '').trim(),
        company: r.author || r.owner || 'N/A',
        url: r.url,
        downloads: r.downloads,
        stars: r.stars,
        likes: r.likes
      }
    }))

    return new Response(
      JSON.stringify({ answer, sources, confidence: 'high', count: results.length }),
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
