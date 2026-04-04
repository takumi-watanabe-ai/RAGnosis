/**
 * LLM Query Planner - Weighted Multi-Source Approach
 *
 * Returns query insights with doc_type weights instead of hard routing.
 * Always searches ALL sources, but uses LLM to extract intent and weights.
 */

import type { QueryInsight, PrimaryIntent, DocTypeWeights, QueryPlan } from './types.ts'
import { config } from './config.ts'

interface LLMInsightResponse {
  primary_intent: PrimaryIntent
  doc_type_weights: DocTypeWeights
  task?: string | null
  language?: string | null
  attributes?: string[] | null
  expanded_query?: string | null
}

/**
 * Get LLM-based query insights with doc_type weights
 * Returns null if planner is disabled or fails
 */
export async function getQueryInsight(
  query: string,
  supabase: any
): Promise<QueryInsight | null> {
  try {
    // Skip planner if disabled
    if (!config.features.queryPlanner.enabled) {
      return null
    }

    // Fetch minimal metadata from DB
    const { data: meta, error } = await supabase.rpc('get_filter_options')

    if (error || !meta) {
      console.error('⚠️ Metadata fetch failed:', error)
      return null
    }

    // Build LLM prompt for query understanding
    const prompt = buildInsightPrompt(query, meta)

    // Call LLM
    const response = await fetch(`${config.llm.url}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.llm.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        format: 'json',
        options: {
          temperature: config.llm.planning.temperature,
          num_predict: config.llm.planning.maxTokens,
        },
      }),
    })

    if (!response.ok) {
      console.error('⚠️ LLM insight extraction failed')
      return null
    }

    const data = await response.json()
    let content = data.message.content.trim()

    console.log('🔍 Raw LLM response:', content.substring(0, 300))

    // Extract JSON if wrapped in markdown
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
                      content.match(/(\{[\s\S]*\})/)

    if (jsonMatch) {
      content = jsonMatch[1] || jsonMatch[0]
    }

    // Clean common JSON issues
    content = cleanJsonString(content)

    let llmResponse: LLMInsightResponse
    try {
      llmResponse = JSON.parse(content)
    } catch (parseError) {
      console.error('❌ JSON parse failed:', parseError)
      console.error('📄 Content:', content)
      return null
    }

    // Validate weights (ensure they're between 0 and 1)
    const weights = normalizeWeights(llmResponse.doc_type_weights)

    const insight: QueryInsight = {
      primary_intent: llmResponse.primary_intent,
      doc_type_weights: weights,
      filters: {
        task: llmResponse.task || undefined,
        language: llmResponse.language || undefined,
        attributes: llmResponse.attributes || undefined,
      },
      expanded_query: llmResponse.expanded_query || undefined,
      confidence: 0.8,
      reason: `Intent: ${llmResponse.primary_intent}`,
    }

    console.log('🎯 Query Insight:', JSON.stringify(insight, null, 2))

    return insight

  } catch (error) {
    console.error('❌ Query insight error:', error)
    return null
  }
}

/**
 * Build LLM prompt for extracting query insights
 */
function buildInsightPrompt(query: string, meta: any): string {
  const availableTasks = meta.tasks?.slice(0, 15) || []

  return `Analyze this query and extract insights for weighted multi-source search.

Query: "${query}"

Available model tasks: ${availableTasks.join(', ')}

Your job:
1. Understand the PRIMARY INTENT
2. Assign WEIGHTS (0.0-1.0) to each doc_type based on relevance
3. Extract any filters (task, language, attributes)
4. Optionally expand the query for better search

Intent types:
- "learn": Conceptual questions (how/what/why/explain)
- "find_tool": Looking for specific models/repos/frameworks (best/top/recommend)
- "compare": Comparing options (X vs Y, difference between)
- "troubleshoot": Solving problems (fix/error/issue)
- "implement": Implementation guidance (how to build/setup)

Doc types:
- "knowledge_base": Documentation, tutorials, explanations (Qdrant, Pinecone, ChromaDB docs)
- "hf_model": HuggingFace models (embeddings, LLMs, etc.)
- "github_repo": GitHub repositories (frameworks, tools, libraries)

Weight guidelines:
- "How does RAG work?" → knowledge_base: 1.0, hf_model: 0.2, github_repo: 0.3
- "best embedding models" → knowledge_base: 0.6, hf_model: 1.0, github_repo: 0.3
- "chromadb vs pinecone" → knowledge_base: 0.8, hf_model: 0.1, github_repo: 0.4
- "how to build RAG" → knowledge_base: 0.9, hf_model: 0.4, github_repo: 0.7

**IMPORTANT**:
- Always search ALL doc types. Weights determine relevance, not exclusion.
- Keep response concise - only fill optional fields if clearly relevant.

Respond with VALID JSON only (no trailing text):
{
  "primary_intent": "learn|find_tool|compare|troubleshoot|implement",
  "doc_type_weights": {
    "knowledge_base": 0.0-1.0,
    "hf_model": 0.0-1.0,
    "github_repo": 0.0-1.0
  },
  "task": null,
  "language": null,
  "attributes": null,
  "expanded_query": null
}`
}

/**
 * Clean JSON string from common LLM issues
 */
function cleanJsonString(json: string): string {
  let cleaned = json
    // Remove trailing commas before closing braces/brackets
    .replace(/,(\s*[}\]])/g, '$1')
    // Remove comments (// and /* */)
    .replace(/\/\/.*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove any text before first {
    .replace(/^[^{]*/, '')
    // Remove any text after last }
    .replace(/[^}]*$/, '')
    .trim()

  // Handle truncated JSON - if it doesn't end with }, try to complete it
  if (!cleaned.endsWith('}')) {
    // Count open braces
    const openBraces = (cleaned.match(/\{/g) || []).length
    const closeBraces = (cleaned.match(/\}/g) || []).length
    const missing = openBraces - closeBraces

    // Add missing closing braces
    if (missing > 0) {
      // First, close any open string if truncated mid-string
      const lastQuote = cleaned.lastIndexOf('"')
      const beforeLastQuote = cleaned.substring(0, lastQuote)
      const quoteCount = (beforeLastQuote.match(/"/g) || []).length

      if (quoteCount % 2 === 1) {
        // Odd number of quotes before last quote - we're in a string
        cleaned += '"'
      }

      // Add closing braces
      cleaned += '}'.repeat(missing)
    }
  }

  return cleaned
}

/**
 * Normalize weights to ensure they're between 0 and 1
 */
function normalizeWeights(weights: DocTypeWeights): DocTypeWeights {
  return {
    knowledge_base: Math.max(0, Math.min(1, weights.knowledge_base || 0.5)),
    hf_model: Math.max(0, Math.min(1, weights.hf_model || 0.5)),
    github_repo: Math.max(0, Math.min(1, weights.github_repo || 0.5)),
  }
}

/**
 * Create query plan - backward compatible interface
 * Now uses weighted multi-source approach instead of routing
 */
export async function createQueryPlan(
  query: string,
  top_k: number,
  supabase: any
): Promise<QueryPlan> {
  // Get LLM insights (returns null if disabled or fails)
  const insight = await getQueryInsight(query, supabase)

  // Map primary intent to legacy QueryIntent
  const intent = insight ? mapPrimaryIntentToQueryIntent(insight.primary_intent) : 'conceptual'

  // Always use vector_search_unified (searches all doc types)
  // Pass doc_type_weights via params if we have insights
  const dataSource = {
    source: 'vector_search_unified' as const,
    params: {
      query: insight?.expanded_query || query,
      limit: top_k,
      ...(insight && {
        doc_type_weights: insight.doc_type_weights,
        filters: insight.filters
      })
    }
  }

  return {
    intent,
    confidence: insight?.confidence || 1.0,
    is_valid: true,
    reason: insight?.reason || 'Multi-source hybrid search',
    data_sources: [dataSource]
  }
}

/**
 * Map new PrimaryIntent to legacy QueryIntent
 */
function mapPrimaryIntentToQueryIntent(primary: PrimaryIntent): 'market_intelligence' | 'implementation' | 'troubleshooting' | 'comparison' | 'conceptual' {
  switch (primary) {
    case 'find_tool':
      return 'market_intelligence'
    case 'implement':
      return 'implementation'
    case 'troubleshoot':
      return 'troubleshooting'
    case 'compare':
      return 'comparison'
    case 'learn':
    default:
      return 'conceptual'
  }
}
