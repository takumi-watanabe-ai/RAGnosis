/**
 * Answer Evaluator - Self-evaluation for iterative improvement
 * Implements quality scoring and adaptive iteration
 */

import { config } from './config.ts'

export interface EvaluationResult {
  score: number  // 0-100
  confidence: 'low' | 'medium' | 'high'
  issues: string[]
  shouldIterate: boolean
}

/**
 * Evaluate answer quality and decide if we need to iterate
 */
export async function evaluateAnswer(
  question: string,
  answer: string,
  sourcesUsed: number
): Promise<EvaluationResult> {
  // Quick checks first
  if (answer.length < 50) {
    return {
      score: 30,
      confidence: 'low',
      issues: ['Answer too short'],
      shouldIterate: true
    }
  }

  if (sourcesUsed === 0) {
    return {
      score: 20,
      confidence: 'low',
      issues: ['No sources used'],
      shouldIterate: true
    }
  }

  // Use LLM to evaluate quality
  const prompt = `You are a STRICT RAG answer evaluator. Most answers score 60-80. Be critical and demanding.

Question: ${question}

Answer: ${answer}

Sources Used: ${sourcesUsed}

SCORING RUBRIC (0-100) - BE STRICT:
90-100: EXCEPTIONAL (rare) - Comprehensive answer with 3+ specific citations, covers all angles, provides examples/metrics, zero ambiguity
80-89: VERY GOOD - Answers fully with 2+ good citations, well-structured, minimal gaps
70-79: GOOD - Solid answer with citations, minor gaps in depth or coverage
60-69: ADEQUATE - Basic answer, limited citations, lacks depth or misses some aspects
50-59: MEDIOCRE - Partially answers, weak/generic, poor citations
0-49: POOR - Fails to answer properly, no citations, or wrong information

EVALUATION CRITERIA (deduct points for issues):
1. Relevance (0-25): Directly answers the specific question? Or too generic/tangential?
2. Completeness (0-25): Covers ALL key aspects with sufficient depth? Or surface-level?
3. Citation Quality (0-25): Specific source references? Or vague "according to sources"?
4. Clarity & Structure (0-25): Well-organized and clear? Or rambling/confusing?

COMMON ISSUES TO CHECK:
- Vague statements without source attribution
- Generic answers that could apply to any similar question
- Missing key technical details or comparisons
- No concrete examples, metrics
- Poor structure or logical flow
- Incomplete coverage of the question's scope

BE SPECIFIC in issues:
ALWAYS list at least 1-2 issues unless truly exceptional (90+).

Respond ONLY with valid JSON (no markdown):
{
  "score": <0-100>,
  "issues": ["specific issue 1", "specific issue 2"]
}`

  try {
    const response = await fetch(`${config.llm.url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.llm.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 500
        }
      })
    })

    if (!response.ok) {
      // If evaluation fails, assume decent quality and don't iterate
      console.error('Evaluation API call failed:', response.status)
      return {
        score: 70,
        confidence: 'medium',
        issues: ['Evaluation service unavailable'],
        shouldIterate: false
      }
    }

    const data = await response.json()
    const result = JSON.parse(data.response.trim())

    const score = result.score || 70
    const issues = result.issues || []

    // Quality thresholds
    const confidence = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low'
    const shouldIterate = score < 70  // Iterate if below 70

    return {
      score,
      confidence,
      issues,
      shouldIterate
    }
  } catch (error) {
    console.error('Evaluation failed:', error)
    // If evaluation fails, assume decent quality and don't iterate
    return {
      score: 70,
      confidence: 'medium',
      issues: ['Evaluation failed - answer accepted as-is'],
      shouldIterate: false
    }
  }
}
