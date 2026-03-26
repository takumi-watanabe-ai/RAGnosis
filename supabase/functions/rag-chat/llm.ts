import type { EnrichedResult } from '../_shared/types.ts'
import { config } from './config.ts'

/**
 * Generate answer using LLM (Ollama).
 */
export async function generateAnswer(
  query: string,
  results: EnrichedResult[]
): Promise<string> {
  const { url: ollamaUrl, model: ollamaModel, temperature, maxTokens } = config.llm

  // Build context from enriched results
  let context = ''
  results.forEach((item, i) => {
    const num = i + 1
    context += `\n[${num}] ${item.name}\n`
    context += `   Type: ${item.doc_type === 'hf_model' ? 'HuggingFace Model' : 'GitHub Repository'}\n`

    if (item.description) {
      // Use full description for better LLM context (critical details often come later)
      context += `   Description: ${item.description}\n`
    }

    if (item.rag_category) {
      context += `   Category: ${item.rag_category}\n`
    }

    // Add metrics
    if (item.downloads) {
      context += `   Downloads: ${item.downloads.toLocaleString()}\n`
    }
    if (item.likes) {
      context += `   Likes: ${item.likes.toLocaleString()}\n`
    }
    if (item.stars) {
      context += `   Stars: ${item.stars.toLocaleString()}\n`
    }
    if (item.forks) {
      context += `   Forks: ${item.forks.toLocaleString()}\n`
    }
    if (item.ranking_position) {
      context += `   Ranking: #${item.ranking_position}\n`
    }

    context += `   URL: ${item.url}\n`
  })

  const prompt = `You are a RAG market intelligence assistant. Answer the user's question using ONLY the provided sources.

SOURCES:
${context}

QUESTION: ${query}

INSTRUCTIONS:
- FIRST: Identify which source(s) answer the question (directly OR indirectly)
- Be FLEXIBLE: If the question asks about "RAG systems", include embedding models, rerankers, and RAG frameworks
- Be HELPFUL: If the question asks about "on-prem", recommend models suitable for local deployment even if not explicitly labeled "on-prem"
- Format your answer in clean markdown
- For each relevant source, include:
  * Bold name with markdown link: **[name](url)**
  * Key metric (downloads/stars/ranking)
  * Brief explanation of WHY it's relevant to the question
- List sources in order of relevance (most relevant first)
- Use ONLY the data provided - do not hallucinate
- If truly NO sources are relevant, say so clearly

ANSWER (in markdown):`

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      prompt,
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens
      }
    })
  })

  if (!response.ok) {
    throw new Error(`Ollama failed: ${response.statusText}`)
  }

  const data = await response.json()
  return data.response.trim()
}
