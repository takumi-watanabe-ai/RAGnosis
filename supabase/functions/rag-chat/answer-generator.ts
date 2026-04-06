/**
 * Answer Generator - Step 3: Synthesize answer from data sources
 * Single LLM call to generate final answer
 */

import type { SearchResult, QueryIntent } from "./types.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { config } from "./config.ts";
import { getLLMClient } from "./services/llm-client.ts";
import { PATTERNS, RESPONSE_MESSAGES, LOG_PREFIX } from "./utils/constants.ts";
import { cleanPartSuffix, markdownLink, truncate } from "./utils/formatters.ts";

/**
 * Generate answer from search results
 */
export async function generateAnswer(
  query: string,
  results: SearchResult[],
  intent: QueryIntent,
  supabase?: SupabaseClient,
): Promise<string> {
  // For market intelligence list queries, use LLM with strict grounding
  const isListQuery = PATTERNS.LIST_QUERY.test(query);
  if (intent === "market_intelligence" && isListQuery && results.length > 0) {
    // Use LLM for context, but with strict anti-hallucination rules
    const prompt = buildMarketIntelligencePrompt(query, results);
    return await generateWithLLM(prompt);
  }

  // Otherwise use LLM to synthesize answer
  const prompt = buildAnswerPrompt(query, results, intent);

  try {
    const llmClient = getLLMClient();
    const answer = await llmClient.generate(prompt);

    return answer;
  } catch (error) {
    console.error(`${LOG_PREFIX.ERROR} Answer generation failed:`, error);
    return RESPONSE_MESSAGES.GENERATION_ERROR;
  }
}

/**
 * Generate answer from search results with streaming support
 */
export async function* generateAnswerStream(
  query: string,
  results: SearchResult[],
  intent: QueryIntent,
  supabase?: SupabaseClient,
): AsyncIterableIterator<string> {
  // For market intelligence list queries, use LLM with strict grounding
  const isListQuery = PATTERNS.LIST_QUERY.test(query);
  if (intent === "market_intelligence" && isListQuery && results.length > 0) {
    const prompt = buildMarketIntelligencePrompt(query, results);
    yield* generateWithLLMStream(prompt);
    return;
  }

  // Otherwise use LLM to synthesize answer
  const prompt = buildAnswerPrompt(query, results, intent);

  try {
    yield* generateWithLLMStream(prompt);
  } catch (error) {
    console.error(`${LOG_PREFIX.ERROR} Answer generation failed:`, error);
    yield RESPONSE_MESSAGES.GENERATION_ERROR;
  }
}

/**
 * Build prompt for market intelligence queries with strict grounding
 */
function buildMarketIntelligencePrompt(query: string, results: SearchResult[]): string {
  const docType = results[0]?.doc_type;
  let context = "TOP RESULTS:\n\n";

  results.forEach((item, i) => {
    const num = i + 1;
    const cleanName = cleanPartSuffix(item.name);

    context += `${num}. ${cleanName}\n`;
    context += `   URL: ${item.url}\n`;

    if (docType === "hf_model") {
      if (item.downloads) context += `   Downloads: ${item.downloads.toLocaleString()}\n`;
      if (item.likes) context += `   Likes: ${item.likes.toLocaleString()}\n`;
      if (item.author) context += `   Author: ${item.author}\n`;
      if (item.task) context += `   Task: ${item.task}\n`;
      if (item.description) context += `   Description: ${truncate(cleanPartSuffix(item.description), 200)}\n`;
    } else if (docType === "github_repo") {
      if (item.stars) context += `   Stars: ${item.stars.toLocaleString()}\n`;
      if (item.forks) context += `   Forks: ${item.forks.toLocaleString()}\n`;
      if (item.owner) context += `   Owner: ${item.owner}\n`;
      if (item.language) context += `   Language: ${item.language}\n`;
      if (item.description) context += `   Description: ${truncate(cleanPartSuffix(item.description), 200)}\n`;
    }
    context += "\n";
  });

  return `${context}

Question: ${query}

ANSWER REQUIREMENTS:

1. For EACH model/repo, provide:
   - Name as clickable link: **[Name](URL)**
   - Key metrics (downloads/stars/likes)
   - What it's good for (from description/task)
   - When to use it (based on description)

2. After the list, add "Choosing the Right One":
   - Quick decision guide based on use cases from descriptions above
   - Only use information explicitly in the data above

3. STRICT RULES:
   - NEVER mention items not in the list above
   - NEVER invent features or capabilities
   - Base ALL context on the descriptions provided

Answer format:
## Top [Models/Repos]

1. **[Name](URL)** - [Downloads/Stars]
   - **What**: [From description]
   - **Best for**: [From task/description]

## Choosing the Right One
- [Decision guide from data above only]

Answer:`;
}

/**
 * Generate answer with LLM (includes token tracking)
 */
async function generateWithLLM(prompt: string): Promise<string> {
  try {
    const llmClient = getLLMClient();
    const result = await llmClient.generateWithUsage(prompt, {
      temperature: 0.3,
      maxTokens: 1000,
    });

    if (result.usage) {
      console.log(`${LOG_PREFIX.SUCCESS} Generation complete - Used ${result.usage.totalTokens} tokens`)
    }

    return result.content;
  } catch (error) {
    console.error(`${LOG_PREFIX.ERROR} LLM generation failed:`, error);
    return RESPONSE_MESSAGES.GENERATION_ERROR;
  }
}

/**
 * Generate answer with LLM using streaming (includes retry logic)
 */
async function* generateWithLLMStream(prompt: string): AsyncIterableIterator<string> {
  try {
    const llmClient = getLLMClient();

    // Retry callback for logging
    const onRetry = (attempt: number, waitSeconds: number) => {
      console.log(`${LOG_PREFIX.WARN} Retrying LLM request (${attempt}/3) after ${waitSeconds}s...`)
    }

    yield* llmClient.generateStream(prompt, {
      temperature: 0.3,
      maxTokens: 1000,
    }, onRetry);
  } catch (error) {
    console.error(`${LOG_PREFIX.ERROR} LLM streaming generation failed:`, error);
    yield RESPONSE_MESSAGES.GENERATION_ERROR;
  }
}

/**
 * Build LLM prompt for answer synthesis (cost-optimized)
 */
function buildAnswerPrompt(
  query: string,
  results: SearchResult[],
  intent: QueryIntent,
): string {
  // Build context from results with smart sizing
  let context = "SOURCES:\n";

  results.forEach((item, i) => {
    // Clean both name and title to remove (Part X/Y)
    const cleanName = cleanPartSuffix(item.name);
    const cleanTitle = item.metadata?.title
      ? cleanPartSuffix(item.metadata.title)
      : cleanName;
    const sourceLink = markdownLink(cleanTitle, item.url);

    context += `\n- ${sourceLink}`;

    // Add type indicator
    if (item.doc_type === "hf_model") context += ` (Type: HuggingFace Model)`;
    else if (item.doc_type === "github_repo")
      context += ` (Type: GitHub Repository)`;
    else if (item.doc_type === "knowledge_base")
      context += ` (Type: Knowledge Base Article)`;
    else if (item.doc_type === "google_trend")
      context += ` (Type: Google Trend)`;

    context += "\n";

    // Add metrics
    if (item.doc_type === "hf_model") {
      if (item.downloads)
        context += `   Downloads: ${item.downloads.toLocaleString()}\n`;
      if (item.likes) context += `   Likes: ${item.likes.toLocaleString()}\n`;
      if (item.author) context += `   Author: ${item.author}\n`;
    } else if (item.doc_type === "github_repo") {
      if (item.stars) context += `   Stars: ${item.stars.toLocaleString()}\n`;
      if (item.forks) context += `   Forks: ${item.forks.toLocaleString()}\n`;
      if (item.owner) context += `   Owner: ${item.owner}\n`;
      if (item.language) context += `   Language: ${item.language}\n`;
    } else if (item.doc_type === "google_trend") {
      if (item.current_interest)
        context += `   Current Interest: ${item.current_interest}%\n`;
      if (item.avg_interest)
        context += `   Average Interest: ${item.avg_interest.toFixed(1)}%\n`;
      if (item.peak_interest)
        context += `   Peak Interest: ${item.peak_interest}%\n`;
    } else if (item.doc_type === "knowledge_base") {
      // Smart context allocation: top 2 sources get more context
      if (item.content) {
        const excerptLength =
          i < 2
            ? config.search.context.primaryExcerpt
            : config.search.context.secondaryExcerpt;
        const excerpt = truncate(
          cleanPartSuffix(item.content),
          excerptLength
        );
        context += `   ${excerpt}\n`;
      }
    }

    // Add description for models/repos (optimized length)
    if (item.description && item.doc_type !== "knowledge_base") {
      const desc = truncate(
        cleanPartSuffix(item.description),
        config.search.context.descriptionMax
      );
      context += `   ${desc}\n`;
    }
  });

  // Build intent-specific instructions
  const instructions = getInstructionsByIntent(intent);

  return `${context}

Question: ${query}

${instructions}

Answer:`;
}

/**
 * Get instructions based on query intent
 */
function getInstructionsByIntent(intent: QueryIntent): string {
  const baseRules = `You are a RAG/ML expert assistant. You will receive multiple sources, but you must be SELECTIVE.

**SOURCE SELECTION RULES:**
1. EVALUATE each source - does it directly answer the user's question?
2. IGNORE sources that are tangentially related or off-topic
3. ONLY USE sources that contain information directly relevant to answering the question
4. Quality over quantity - a focused answer with 2-3 relevant sources is better than a scattered answer with 20 sources

**CRITICAL ANTI-HALLUCINATION RULES:**
1. ONLY use information EXPLICITLY stated in the sources you selected
2. DO NOT invent, guess, or use external knowledge — not even well-known facts
3. NEVER cite sources that don't exist in the provided context
4. If sources don't adequately answer the question, acknowledge the limitation

LENGTH: Answer can never exceed ${config.llm.answer.targetWords} words. Be complete but concise.

FORMATTING:
- ALWAYS reference sources inline as clickable links: **[Name](url)**
- Only cite sources you actually used in your answer
- Use bullet points for lists
- For structured/multi-section responses, use markdown headers (## for sections, ### for subsections)
- Structure with line breaks for readability`;

  switch (intent) {
    case "market_intelligence":
      return `${baseRules}

ANSWER APPROACH:
- EVALUATE: Which sources directly answer the question? Ignore the rest.
- FIRST: Directly answer the user's specific question
- Then provide supporting details from ONLY the relevant sources

Requirements:
- Be selective - only include items that match the user's query
- Match source types (models → HuggingFace, repos → GitHub)
- Include metrics (downloads/likes/stars/forks) from sources you use
- Use bullet points for multiple items`;

    case "implementation":
      return `${baseRules}

ANSWER APPROACH:
- EVALUATE: Which sources contain implementation guidance for this question?
- FIRST: Directly answer the user's specific question
- Then provide step-by-step implementation from relevant sources

Requirements:
- Focus on sources with actionable implementation details
- Step-by-step guidance with parameters from sources only
- Explain what to do AND why based on sources
- Use bullet points for steps`;

    case "troubleshooting":
      return `${baseRules}

ANSWER APPROACH:
- EVALUATE: Which sources address this specific problem?
- FIRST: Directly answer what's causing the issue
- Then provide solutions from relevant sources

Requirements:
- Focus on sources that directly address the user's problem
- Explain root causes based only on relevant sources
- List solutions found in the sources you selected
- Use bullet points for multiple solutions`;

    case "comparison":
      return `${baseRules}

COMPARISON FORMAT - Follow this EXACT structure:

Start with an opening sentence stating the core difference

## Key Differences

**Feature Category 1:**
- **Item A**: [description from sources]
- **Item B**: [description from sources]

**Feature Category 2:**
- **Item A**: [description from sources]
- **Item B**: [description from sources]

## When to Choose

- **Item A**: [use cases from sources]
- **Item B**: [use cases from sources]

CRITICAL RULES:
1. Start with ONE sentence summarizing the main difference
2. Group by FEATURE (not by product), then compare both items under each feature
3. Use bullet points (-) ONLY, NO numbered lists (1. 2. 3.)
4. Keep it concise - compare 3-5 key features maximum
5. ONLY use information explicitly stated in the sources
6. Compare the SAME aspects for both items (e.g., if you mention "deployment" for one, mention it for the other)`;

    case "conceptual":
    default:
      return `You are a RAG/ML expert assistant. You will receive multiple sources - select the most relevant ones.

**SOURCE SELECTION FOR CONCEPTUAL QUESTIONS:**
1. EVALUATE each source - does it explain the concept the user is asking about?
2. IGNORE sources about unrelated concepts (e.g., if asked about "chunking", ignore sources about "retrieval")
3. FOCUS on sources that directly address the core concept

**CONCEPTUAL ANSWER RULES:**
1. Synthesize GENERAL concepts from the relevant sources (abstract away tool-specific details)
2. When sources mention specific tools (Pinecone, LangChain, etc.), extract the UNDERLYING CONCEPT
3. Provide a beginner-friendly explanation of how things work in general
4. Use source examples to ILLUSTRATE concepts, not to define them
5. If multiple sources describe similar concepts with different tools, unify the explanation

LENGTH: Answer can never exceed ${config.llm.answer.targetWords} words. Be complete but concise.

FORMATTING:
- Use bullet points for lists
- Use markdown headers (## for sections, ### for subsections)
- Structure with line breaks for readability
- Only cite sources you actually used

Requirements:
- FIRST: Directly answer the user's specific question with general concepts
- Cover what, why, and how (synthesized from relevant sources only)
- Use bullet points to organize key concepts
- Abstract tool-specific details into general patterns`;
  }
}
