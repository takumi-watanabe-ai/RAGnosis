/**
 * Centralized LLM client service
 * Supports both OpenRouter (production) and Ollama (local development)
 */

import { config } from '../config.ts'
import { parseJsonFromLLM } from '../utils/json-parser.ts'
import { LOG_PREFIX } from '../utils/constants.ts'

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  format?: 'json' | 'text'
}

export interface GenerateOptions {
  temperature?: number
  maxTokens?: number
}

type LLMProvider = 'openrouter' | 'ollama'

/**
 * LLM Client for interacting with OpenRouter (production) or Ollama (local)
 * Auto-detects provider based on OPENROUTER_API_KEY presence
 */
export class LLMClient {
  private provider: LLMProvider
  private baseUrl: string
  private model: string
  private apiKey?: string

  constructor() {
    // Auto-detect: Use OpenRouter if API key exists, else Ollama
    this.apiKey = config.llm.openrouter.apiKey
    this.provider = this.apiKey ? 'openrouter' : 'ollama'

    if (this.provider === 'openrouter') {
      this.baseUrl = config.llm.openrouter.baseUrl
      this.model = config.llm.openrouter.model
    } else {
      this.baseUrl = config.llm.ollama.url
      this.model = config.llm.ollama.model
    }

    console.log(`${LOG_PREFIX.INFO} LLM Client initialized: ${this.provider} (${this.model})`)
  }

  /**
   * Chat API call (for structured JSON outputs)
   */
  async chat(
    prompt: string,
    options: ChatOptions = {}
  ): Promise<string> {
    const {
      temperature = config.llm.planning.temperature,
      maxTokens = config.llm.planning.maxTokens,
      format = 'json'
    } = options

    try {
      if (this.provider === 'openrouter') {
        return await this.chatOpenRouter(prompt, temperature, maxTokens, format)
      } else {
        return await this.chatOllama(prompt, temperature, maxTokens, format)
      }
    } catch (error) {
      console.error(`${LOG_PREFIX.ERROR} LLM chat failed:`, error)
      throw error
    }
  }

  /**
   * OpenRouter chat implementation (OpenAI-compatible API)
   */
  private async chatOpenRouter(
    prompt: string,
    temperature: number,
    maxTokens: number,
    format: 'json' | 'text'
  ): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'HTTP-Referer': 'https://ragnosis.com', // Optional: for rankings
      'X-Title': 'RAGnosis', // Optional: for rankings
    }

    const body: any = {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }

    // OpenRouter supports response_format for JSON mode
    if (format === 'json') {
      body.response_format = { type: 'json_object' }
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter API request failed: ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    return data.choices[0].message.content.trim()
  }

  /**
   * Ollama chat implementation
   */
  private async chatOllama(
    prompt: string,
    temperature: number,
    maxTokens: number,
    format: 'json' | 'text'
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        format,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama chat request failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.message.content.trim()
  }

  /**
   * Generate API call (for text generation)
   */
  async generate(
    prompt: string,
    options: GenerateOptions = {}
  ): Promise<string> {
    const {
      temperature = config.llm.answer.temperature,
      maxTokens = config.llm.answer.maxTokens,
    } = options

    try {
      if (this.provider === 'openrouter') {
        return await this.generateOpenRouter(prompt, temperature, maxTokens)
      } else {
        return await this.generateOllama(prompt, temperature, maxTokens)
      }
    } catch (error) {
      console.error(`${LOG_PREFIX.ERROR} LLM generate failed:`, error)
      throw error
    }
  }

  /**
   * OpenRouter generate implementation (using chat completions API)
   */
  private async generateOpenRouter(
    prompt: string,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'HTTP-Referer': 'https://ragnosis.com',
      'X-Title': 'RAGnosis',
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter API request failed: ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    return data.choices[0].message.content.trim()
  }

  /**
   * Ollama generate implementation
   */
  private async generateOllama(
    prompt: string,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama generate request failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.response.trim()
  }

  /**
   * Chat with automatic JSON parsing
   */
  async chatJson<T = any>(
    prompt: string,
    options: ChatOptions = {}
  ): Promise<T | null> {
    const content = await this.chat(prompt, { ...options, format: 'json' })
    console.log(`${LOG_PREFIX.LLM} Raw LLM response:`, content.substring(0, 300))
    return parseJsonFromLLM<T>(content)
  }

  /**
   * Generate with custom model
   */
  async generateWithModel(
    prompt: string,
    model: string,
    options: GenerateOptions = {}
  ): Promise<string> {
    const originalModel = this.model
    this.model = model
    try {
      return await this.generate(prompt, options)
    } finally {
      this.model = originalModel
    }
  }
}

// Singleton instance
let llmClient: LLMClient | null = null

/**
 * Get or create LLM client instance
 */
export function getLLMClient(): LLMClient {
  if (!llmClient) {
    llmClient = new LLMClient()
  }
  return llmClient
}
