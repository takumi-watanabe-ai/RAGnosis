import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QueryRequest {
  query: string
  top_k?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, top_k = 5 }: QueryRequest = await req.json()

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Processing query:', query)

    // Layer 1: Vector Search (future - for articles/docs)
    const vectorResults = await searchVectorLayer(supabase, query, top_k)

    // Layer 2: SQL Search (current - agentic orchestration of small functions)
    const sqlResults = await searchSQLLayer(supabase, query, top_k)

    // Combine results (prioritize vector if available, fallback to SQL)
    const results = vectorResults.length > 0 ? vectorResults : sqlResults

    if (results.length === 0) {
      // Extract what they were looking for to give helpful feedback
      const extractKeyword = (text: string) => {
        return text
          .toLowerCase()
          .replace(/\b(is|there|a|an|the|for|about|what|how|when|where|github|repo|repository|model|huggingface)\b/g, '')
          .trim()
          .split(/\s+/)
          .filter(w => w.length > 2)[0] || 'that topic'
      }

      const searchedFor = extractKeyword(query)

      return new Response(
        JSON.stringify({
          answer: `I searched for "${searchedFor}" but didn't find any matching results in the database.\n\nThe database contains:\n- RAG-related models from HuggingFace\n- RAG frameworks and tools from GitHub\n- Google Trends data for RAG keywords\n\nTry asking about: RAG models, LangChain, LlamaIndex, embedding models, vector databases, or RAG trends.`,
          sources: [],
          confidence: 'low'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate answer using LLM
    const answer = await generateAnswer(query, results)

    return new Response(
      JSON.stringify({
        answer,
        sources: results.slice(0, top_k).map((r: any, i: number) => ({
          text: r.description || r.text || r.name || '',
          score: r.score || (1.0 - i * 0.05),
          type: r.type || 'unknown',
          metadata: {
            title: r.metadata?.title || r.name || 'N/A',
            company: r.metadata?.company || r.metadata?.author || 'N/A',
            url: r.metadata?.url || '',
            downloads: r.metadata?.downloads,
            stars: r.metadata?.stars,
            interest: r.metadata?.interest,
            date: r.metadata?.date
          }
        })),
        confidence: 'high',
        count: Math.min(results.length, top_k)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Vector Layer - Semantic search for articles/docs
 * Future: Will search ragnosis_docs table for "how to", "explain", etc.
 */
async function searchVectorLayer(supabase: any, query: string, limit: number): Promise<any[]> {
  // TODO: Implement when articles are ingested
  return []
}

/**
 * Available tools/functions that the LLM can call
 */
const AVAILABLE_TOOLS = [
  {
    name: 'get_rag_models',
    description: 'Get RAG-related models (embedding models, retrieval models) from HuggingFace',
    parameters: { limit: 'number of results (default 5)' }
  },
  {
    name: 'get_rag_repos',
    description: 'Get RAG-related repositories (frameworks, tools) from GitHub',
    parameters: { limit: 'number of results (default 5)' }
  },
  {
    name: 'search_models',
    description: 'Search HuggingFace models by keyword (name, author, task, description)',
    parameters: { keyword: 'search term', limit: 'number of results' }
  },
  {
    name: 'search_repos',
    description: 'Search GitHub repositories by keyword (name, description, topics)',
    parameters: { keyword: 'search term', limit: 'number of results' }
  },
  {
    name: 'get_trends',
    description: 'Get Google Trends data for specific keywords or all available trends',
    parameters: { keyword: 'optional keyword to filter trends (e.g., "RAG", "LangChain")', limit: 'number of results' }
  },
  {
    name: 'get_models_by_task',
    description: 'Get models filtered by task type (e.g., "feature-extraction", "text-generation")',
    parameters: { task: 'task type', limit: 'number of results' }
  },
  {
    name: 'get_top_models',
    description: 'Get most downloaded models (any category)',
    parameters: { limit: 'number of results' }
  },
  {
    name: 'get_top_repos',
    description: 'Get most starred GitHub repositories (any topic)',
    parameters: { limit: 'number of results' }
  }
]

/**
 * Use LLM to analyze query and decide which tools to call
 */
async function routeQuery(query: string, limit: number): Promise<any[]> {
  const ollamaUrl = Deno.env.get('OLLAMA_URL') || 'http://host.docker.internal:11434'
  const ollamaModel = Deno.env.get('OLLAMA_MODEL') || 'qwen2.5:3b-instruct'

  const toolsDescription = AVAILABLE_TOOLS.map((tool, i) =>
    `${i + 1}. ${tool.name}: ${tool.description}\n   Parameters: ${JSON.stringify(tool.parameters)}`
  ).join('\n\n')

  const prompt = `You are a query routing agent for a RAG/AI market intelligence system. Extract ANY keywords and search aggressively.

AVAILABLE FUNCTIONS:
${toolsDescription}

USER QUESTION: "${query}"

INSTRUCTIONS:
- Extract ANY technical keywords, product names, or topics from the question
- Be VERY liberal - if the user mentions ANY term (qdrant, langchain, embedding, etc.), search for it
- Default to search_repos if they ask about a product/framework/tool
- Default to search_models if they ask about models/embedding
- Use get_trends if they mention "trend", "trending", "popular over time"
- ALWAYS return at least one function call - never give up!
- Output ONLY valid JSON:

{
  "reasoning": "brief explanation",
  "function_calls": [
    {"name": "search_repos", "parameters": {"keyword": "extracted_keyword", "limit": ${limit}}}
  ]
}

OUTPUT (JSON only):`

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      prompt,
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 300
      }
    })
  })

  if (!response.ok) {
    console.error('LLM routing failed, falling back to heuristics')
    return null
  }

  try {
    const data = await response.json()
    const llmOutput = data.response.trim()
    console.log('LLM routing decision:', llmOutput)

    // Extract JSON from response (in case LLM adds extra text)
    const jsonMatch = llmOutput.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON found in LLM response')
      return null
    }

    const decision = JSON.parse(jsonMatch[0])
    console.log('Parsed decision:', JSON.stringify(decision))
    return decision.function_calls || []
  } catch (error) {
    console.error('Failed to parse LLM routing decision:', error)
    return null
  }
}

/**
 * SQL Layer - Intelligent agent that orchestrates small, composable SQL functions
 * Uses LLM to analyze query and route to appropriate function(s)
 */
async function searchSQLLayer(supabase: any, query: string, limit: number): Promise<any[]> {
  // Use fast heuristic routing by default (LLM routing is too slow - double Ollama calls)
  // TODO: Make LLM routing optional or async for complex queries only
  console.log('Using heuristic routing (fast path)')
  return searchSQLLayerHeuristic(supabase, query, limit)

  /* LLM routing disabled for performance - uncomment to enable
  const functionCalls = await routeQuery(query, limit)
  if (functionCalls && functionCalls.length > 0) {
    const allResults: any[] = []
    for (const call of functionCalls) {
      const results = await executeFunction(supabase, call.name, call.parameters)
      allResults.push(...results)
    }
    return allResults.slice(0, limit)
  }
  return searchSQLLayerHeuristic(supabase, query, limit)
  */
}

/**
 * Execute a function call based on LLM decision
 */
async function executeFunction(supabase: any, functionName: string, params: any): Promise<any[]> {
  const limit = params.limit || 5
  const keyword = params.keyword || params.task || params.topic || ''

  switch (functionName) {
    case 'get_rag_models':
      return await getRagModels(supabase, limit)
    case 'get_rag_repos':
      return await getRagRepos(supabase, limit)
    case 'search_models':
      return await searchModels(supabase, keyword, limit)
    case 'search_repos':
      return await searchRepos(supabase, keyword, limit)
    case 'get_trends':
      return await getTrends(supabase, limit, keyword)
    case 'get_models_by_task':
      return await getModelsByTask(supabase, keyword, limit)
    case 'get_top_models':
      return await getTopModels(supabase, limit)
    case 'get_top_repos':
      return await getTopRepos(supabase, limit)
    default:
      console.error(`Unknown function: ${functionName}`)
      return []
  }
}

/**
 * Heuristic-based routing (fallback when LLM fails)
 */
async function searchSQLLayerHeuristic(supabase: any, query: string, limit: number): Promise<any[]> {
  const q = query.toLowerCase()
  console.log(`Query: "${query}"`)

  // Extract meaningful keywords - technical terms, product names, topics
  const extractKeywords = (text: string) => {
    // Remove common stopwords
    const cleaned = text
      .replace(/\b(what|are|the|is|how|about|top|best|most|popular|for|which|should|i|use|can|you|tell|me|modern|current|latest|there|any|some|github|repo|repository|model|models|framework|frameworks|a|an|and|or|in|on|at|to|of)\b/gi, '')
      .trim()

    // Split into words and find the longest meaningful word (likely the topic)
    const words = cleaned.split(/\s+/).filter(w => w.length > 2)

    // Prefer capitalized words (product names) or longest word
    const capitalizedWord = words.find(w => /^[A-Z]/.test(w))
    if (capitalizedWord) return capitalizedWord.toLowerCase()

    // Return longest word or first word
    return words.sort((a, b) => b.length - a.length)[0] || cleaned
  }

  // Analyze query intent and route to appropriate function(s)

  // Trend queries → get_trends_data, fallback to search if empty
  if (q.includes('trend') || q.includes('history') || q.includes('over time')) {
    console.log('Intent: Trends query → calling get_trends_data')
    const trends = await getTrends(supabase, limit)
    if (trends.length > 0) return trends

    // Fallback: search for repos/models related to the topic
    console.log('No trends found, falling back to repos/models search')
    const keywords = extractKeywords(query)
    const repos = await searchRepos(supabase, keywords, limit)
    if (repos.length > 0) return repos
  }

  // RAG models specifically → get_rag_models
  if ((q.includes('rag') && q.includes('model')) || q.includes('rag model')) {
    console.log('Intent: RAG models → calling get_rag_models')
    return await getRagModels(supabase, limit)
  }

  // RAG frameworks/repos → get_rag_repos
  if ((q.includes('rag') && (q.includes('framework') || q.includes('repo') || q.includes('tool')))) {
    console.log('Intent: RAG frameworks → calling get_rag_repos')
    return await getRagRepos(supabase, limit)
  }

  // Embedding models → get_models_by_task
  if (q.includes('embedding')) {
    console.log('Intent: Embedding models → calling get_models_by_task')
    return await getModelsByTask(supabase, 'feature-extraction', limit)
  }

  // Vector database repos → search_repos
  if (q.includes('vector') && q.includes('database')) {
    console.log('Intent: Vector databases → calling search_repos')
    return await searchRepos(supabase, 'vector database', limit)
  }

  // Agentic AI / Agent queries → search for agent-related repos
  if (q.includes('agent') || q.includes('agentic')) {
    console.log('Intent: Agentic AI → calling search_repos')
    const repos = await searchRepos(supabase, 'agent', limit)
    if (repos.length > 0) return repos
  }

  // Generic "top models" → get_top_models
  if (q.includes('top') && q.includes('model') && !q.includes('rag')) {
    console.log('Intent: Top models → calling get_top_models')
    return await getTopModels(supabase, limit)
  }

  // Generic "top repos" → get_top_repos
  if (q.includes('top') && (q.includes('repo') || q.includes('framework'))) {
    console.log('Intent: Top repos → calling get_top_repos')
    return await getTopRepos(supabase, limit)
  }

  // Default: For RAG-related queries, get both models and repos
  if (q.includes('rag')) {
    console.log('Intent: General RAG query → calling get_rag_models + get_rag_repos')
    const models = await getRagModels(supabase, Math.ceil(limit / 2))
    const repos = await getRagRepos(supabase, Math.ceil(limit / 2))
    return [...models, ...repos].slice(0, limit)
  }

  // Fallback: extract keywords and search aggressively
  console.log('Intent: Generic search → calling search_models + search_repos')
  const keywords = extractKeywords(query)

  // Always try to search - be aggressive with keyword extraction
  if (keywords && keywords.length > 2) {
    console.log(`Extracted keywords: "${keywords}"`)
    const models = await searchModels(supabase, keywords, Math.ceil(limit / 2))
    const repos = await searchRepos(supabase, keywords, Math.ceil(limit / 2))
    const combined = [...models, ...repos]

    if (combined.length > 0) {
      return combined.slice(0, limit)
    }
  }

  // Last resort: search for the entire query
  console.log('Searching with full query as fallback')
  const models = await searchModels(supabase, query, Math.ceil(limit / 2))
  const repos = await searchRepos(supabase, query, Math.ceil(limit / 2))
  return [...models, ...repos].slice(0, limit)
}

// ============================
// Small, Composable SQL Function Helpers
// ============================

async function getRagModels(supabase: any, limit: number): Promise<any[]> {
  const { data } = await supabase.rpc('get_rag_models', { query_limit: limit })
  return transformResults(data)
}

async function getRagRepos(supabase: any, limit: number): Promise<any[]> {
  const { data } = await supabase.rpc('get_rag_repos', { query_limit: limit })
  return transformResults(data)
}

async function getTopModels(supabase: any, limit: number): Promise<any[]> {
  const { data } = await supabase.rpc('get_top_models', { query_limit: limit })
  return transformResults(data)
}

async function getTopRepos(supabase: any, limit: number): Promise<any[]> {
  const { data } = await supabase.rpc('get_top_repos', { query_limit: limit })
  return transformResults(data)
}

async function searchModels(supabase: any, query: string, limit: number): Promise<any[]> {
  const { data } = await supabase.rpc('search_models', { search_query: query, query_limit: limit })
  return transformResults(data)
}

async function searchRepos(supabase: any, query: string, limit: number): Promise<any[]> {
  const { data } = await supabase.rpc('search_repos', { search_query: query, query_limit: limit })
  return transformResults(data)
}

async function getModelsByTask(supabase: any, task: string, limit: number): Promise<any[]> {
  const { data } = await supabase.rpc('get_models_by_task', { task_name: task, query_limit: limit })
  return transformResults(data)
}

async function getTrends(supabase: any, limit: number, keyword?: string): Promise<any[]> {
  const { data } = await supabase.rpc('get_trends_data', { query_limit: 30 })
  if (!data?.success || !data?.data?.results) return []

  let trends = data.data.results

  // Filter by keyword if provided
  if (keyword && keyword.trim()) {
    const searchTerm = keyword.toLowerCase().trim()
    trends = trends.filter((t: any) =>
      t.keyword.toLowerCase().includes(searchTerm)
    )
    console.log(`Filtered trends for "${keyword}": ${trends.length} results`)
  }

  return trends.slice(0, limit).map((t: any) => ({
    type: 'trend',
    name: t.keyword,
    text: `${t.keyword}: ${t.interest}% interest on ${t.date}`,
    description: `Google Trends data for "${t.keyword}"`,
    metadata: {
      title: t.keyword,
      company: 'Google Trends',
      interest: t.interest,
      date: t.date,
      url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(t.keyword)}`
    }
  }))
}

// Transform SQL results to consistent format
function transformResults(data: any): any[] {
  if (!data?.success || !data?.data?.results) {
    console.log('No results from SQL function')
    return []
  }

  const results = data.data.results
  console.log(`Received ${results.length} results`)

  return results.map((item: any) => ({
    type: item.type,
    name: item.name,
    description: item.description || `${item.type} by ${item.author}`,
    metadata: {
      title: item.name,
      company: item.author || 'N/A',
      downloads: item.downloads,
      stars: item.stars,
      url: item.url || (item.type === 'model'
        ? `https://huggingface.co/${item.name}`
        : `https://github.com/${item.name}`)
    }
  }))
}

/**
 * Generate answer using Ollama
 */
async function generateAnswer(query: string, results: any[]): Promise<string> {
  const ollamaUrl = Deno.env.get('OLLAMA_URL') || 'http://host.docker.internal:11434'
  const ollamaModel = Deno.env.get('OLLAMA_MODEL') || 'qwen2.5:3b-instruct'

  // Build context with numbered sources
  let context = ''
  results.forEach((item, i) => {
    const num = i + 1
    context += `\n[${num}] ${item.name || 'Unknown'}\n`
    if (item.type) context += `   Type: ${item.type}\n`
    if (item.description) context += `   Description: ${item.description}\n`
    if (item.metadata?.downloads) context += `   Downloads: ${item.metadata.downloads.toLocaleString()}\n`
    if (item.metadata?.stars) context += `   Stars: ${item.metadata.stars.toLocaleString()}\n`
    if (item.metadata?.interest) context += `   Interest: ${item.metadata.interest}%\n`
    if (item.metadata?.url) context += `   URL: ${item.metadata.url}\n`
  })

  const prompt = `You are a RAG market intelligence assistant. Answer the user's question using ONLY the provided sources.

SOURCES:
${context}

QUESTION: ${query}

INSTRUCTIONS:
- Format your answer in clean markdown
- Create a numbered list of the most relevant items
- For each item, include:
  * Bold name with markdown link: **[name](url)**
  * Key metric (downloads/stars/interest)
  * One-line description if relevant
- Add a brief summary at the end
- Use ONLY the data provided - do not hallucinate
- If data is insufficient, say so clearly

ANSWER (in markdown):`

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      prompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 600
      }
    })
  })

  if (!response.ok) {
    throw new Error(`Ollama failed: ${response.statusText}`)
  }

  const data = await response.json()
  return data.response.trim()
}
