import type { EnrichedResult } from '../_shared/types.ts'
import { config } from './config.ts'

/**
 * Build prompt based on query intent - Instruction-based (inspired by finance-agent)
 * No rigid examples - flexible, adaptive responses
 */
function buildPrompt(query: string, context: string, intent: string, answerMode: string): string {

  // Market Intelligence: Data-driven insights with metrics
  if (intent === 'market_intelligence') {
    return `${context}

Question: ${query}

You are a RAG/ML market analyst. Answer STRICTLY using ONLY the sources above.

CRITICAL GROUNDING RULES:
- Use ONLY information explicitly shown in the SOURCES section above
- Do NOT use your training knowledge or make assumptions
- If something is not in SOURCES, do not mention it
- Every fact MUST come from the provided sources

Requirements:
- RESPECT SOURCE TYPES: If asked about "models", only use sources with Type: HuggingFace Model. If asked about "repos/tools", only use Type: GitHub Repository. Blog articles provide context, not data.
- ONLY use metrics explicitly shown for each source (HF models: downloads/likes/ranking, GitHub repos: stars/forks)
- NEVER infer, estimate, or mention metrics not provided - if a metric is missing, don't mention it
- Include ALL provided metrics with exact numbers from the sources
- CRITICAL: Every time you reference a source, copy its EXACT link format from SOURCES (includes **[Name](url)**)
- Use ALL relevant sources of the correct type
- Be concise but comprehensive - no unnecessary elaboration

Structure: Choose narrative, bullets, or table based on what best answers the question.

Answer:`
  }

  // Implementation: Practical, actionable guidance
  if (intent === 'implementation') {
    return `${context}

Question: ${query}

You are a senior RAG engineer providing implementation guidance. Answer STRICTLY using ONLY the sources above.

CRITICAL GROUNDING RULES:
- Use ONLY information explicitly shown in the SOURCES section above
- Do NOT use your training knowledge or make assumptions
- If something is not in SOURCES, do not mention it

Requirements:
- Include specific parameters, configurations, and technical details from sources
- CRITICAL: Every time you reference a source, copy its EXACT link format from SOURCES (includes **[Name](url)**)
- Explain what to do AND why it works
- Cover alternatives and trade-offs if sources mention them
- Be concise - focus on actionable information

Answer:`
  }

  // Troubleshooting: Diagnose → Solve
  if (intent === 'troubleshooting') {
    return `${context}

Question: ${query}

You are a RAG expert helping solve a problem. Answer STRICTLY using ONLY the sources above.

CRITICAL GROUNDING RULES:
- Use ONLY information explicitly shown in the SOURCES section above
- Do NOT use your training knowledge or make assumptions
- If something is not in SOURCES, do not mention it

Requirements:
- Explain root causes and symptoms
- Provide ALL solutions from sources with specific parameters and configurations
- CRITICAL: Every time you reference a source, copy its EXACT link format from SOURCES (includes **[Name](url)**)
- Indicate which solutions work best for which scenarios
- Include prevention best practices
- Be concise - prioritize actionable solutions

Answer:`
  }

  // Comparison: Side-by-side analysis
  if (intent === 'comparison') {
    return `${context}

Question: ${query}

You are comparing RAG tools/approaches. Answer STRICTLY using ONLY the sources above.

CRITICAL GROUNDING RULES:
- Use ONLY information explicitly shown in the SOURCES section above
- Do NOT use your training knowledge or make assumptions
- If something is not in SOURCES, do not mention it

Requirements:
- Compare ALL items with features, performance, use cases, and metrics from sources
- CRITICAL: Every time you reference a source, copy its EXACT link format from SOURCES (includes **[Name](url)**)
- Use markdown table for 3+ items, otherwise use clear sections
- Provide "Use X if..." decision guidance
- Be concise - focus on key differentiators

Answer:`
  }

  // Conceptual/Default: Deep explanation
  return `${context}

Question: ${query}

You are explaining a RAG/ML concept. Answer STRICTLY using ONLY the sources above.

CRITICAL GROUNDING RULES:
- Use ONLY information explicitly shown in the SOURCES section above
- Do NOT use your training knowledge or make assumptions
- If something is not in SOURCES, do not mention it

Requirements:
- Answer directly covering what, why, and how from ALL sources
- CRITICAL: Every time you reference a source, copy its EXACT link format from SOURCES (includes **[Name](url)**)
- Include definitions, mechanisms, use cases, and trade-offs
- Synthesize across sources - show different perspectives
- Be concise yet thorough - focus on understanding, not elaboration

Answer:`
}

/**
 * Generate answer using LLM (Ollama).
 */
export async function generateAnswer(
  query: string,
  results: EnrichedResult[],
  intent: string = 'conceptual',
  answerMode: string = 'standard'
): Promise<string> {
  const { url: ollamaUrl, model: ollamaModel, maxTokensSafetyCeiling, stopSequences } = config.llm

  // Build context from enriched results
  let context = 'SOURCES:\n'
  results.forEach((item, i) => {
    const num = i + 1
    // Clean up chunk markers like "(part 3/6)" from titles
    const cleanName = item.name.replace(/\s*\(part\s+\d+\/\d+\)\s*$/i, '').trim()

    // Format source name as markdown link from the start
    const sourceLink = `**[${cleanName}](${item.url})**`

    // Include relevance score for blog articles
    if (item.doc_type === 'blog_article' && (item as any).similarity) {
      const relevanceScore = ((item as any).similarity * 100).toFixed(1)
      context += `\n[${num}] ${sourceLink} [Relevance: ${relevanceScore}%]\n`
    } else {
      context += `\n[${num}] ${sourceLink}\n`
    }

    // Handle different doc types
    if (item.doc_type === 'blog_article') {
      context += `   Type: Blog Article\n`
      if ((item as any).source) {
        context += `   Source: ${(item as any).source}\n`
      }
      if ((item as any).published_at) {
        context += `   Published: ${new Date((item as any).published_at).toLocaleDateString()}\n`
      }
    } else if (item.doc_type === 'hf_model') {
      context += `   Type: HuggingFace Model\n`
    } else if (item.doc_type === 'github_repo') {
      context += `   Type: GitHub Repository\n`
    } else if (item.doc_type === 'trend') {
      context += `   Type: Google Trend\n`
    }

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
  })

  // Build intent-specific prompt
  const prompt = buildPrompt(query, context, intent, answerMode)

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      prompt,
      stream: false,
      options: {
        temperature: 0.5,  // Increased from 0.3 for better instruction following
        num_predict: maxTokensSafetyCeiling,  // Safety ceiling to allow completion
        stop: stopSequences  // Stop at unwanted patterns
      }
    })
  })

  if (!response.ok) {
    throw new Error(`Ollama failed: ${response.statusText}`)
  }

  const data = await response.json()
  return data.response.trim()
}
