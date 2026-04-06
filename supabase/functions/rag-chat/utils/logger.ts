/**
 * Logging utility with configurable levels
 * Levels: INFO (production) < DEBUG < VERBOSE
 */

import { LOG_PREFIX } from './constants.ts'

export enum LogLevel {
  INFO = 0,    // Production - essential information only
  DEBUG = 1,   // Development - include intermediate steps
  VERBOSE = 2, // Deep debugging - all details
}

// Get log level from environment or default to INFO
const LOG_LEVEL_ENV = Deno.env.get('LOG_LEVEL')?.toUpperCase() || 'INFO'
const CURRENT_LOG_LEVEL = LogLevel[LOG_LEVEL_ENV as keyof typeof LogLevel] ?? LogLevel.INFO

class Logger {
  private level: LogLevel

  constructor(level: LogLevel = CURRENT_LOG_LEVEL) {
    this.level = level
  }

  /**
   * INFO: Production logs - essential information
   * Always shown: query, results count, success/errors
   */
  info(message: string, ...args: any[]) {
    if (this.level >= LogLevel.INFO) {
      console.log(`${LOG_PREFIX.INFO} ${message}`, ...args)
    }
  }

  /**
   * DEBUG: Development logs - intermediate steps
   * Shown in DEBUG and VERBOSE: search details, scores, filtering
   */
  debug(message: string, ...args: any[]) {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`${LOG_PREFIX.INFO} ${message}`, ...args)
    }
  }

  /**
   * VERBOSE: Deep debugging - implementation details
   * Only shown in VERBOSE: raw responses, parameters, internal state
   */
  verbose(message: string, ...args: any[]) {
    if (this.level >= LogLevel.VERBOSE) {
      console.log(`${LOG_PREFIX.INFO} ${message}`, ...args)
    }
  }

  /**
   * SUCCESS: Always shown - operation completed successfully
   */
  success(message: string, ...args: any[]) {
    console.log(`${LOG_PREFIX.SUCCESS} ${message}`, ...args)
  }

  /**
   * WARN: Always shown - warnings and retries
   */
  warn(message: string, ...args: any[]) {
    console.warn(`${LOG_PREFIX.WARN} ${message}`, ...args)
  }

  /**
   * ERROR: Always shown - errors
   */
  error(message: string, ...args: any[]) {
    console.error(`${LOG_PREFIX.ERROR} ${message}`, ...args)
  }

  /**
   * QUERY: Always shown - user queries
   */
  query(message: string, ...args: any[]) {
    console.log(`${LOG_PREFIX.QUERY} ${message}`, ...args)
  }

  /**
   * EXECUTE: Always shown - execution steps
   */
  execute(message: string, ...args: any[]) {
    console.log(`${LOG_PREFIX.EXECUTE} ${message}`, ...args)
  }

  /**
   * METRICS: Always shown - performance and usage metrics
   */
  metrics(message: string, ...args: any[]) {
    console.log(`${LOG_PREFIX.METRICS} ${message}`, ...args)
  }

  getLevel(): LogLevel {
    return this.level
  }

  setLevel(level: LogLevel) {
    this.level = level
  }
}

// Singleton logger instance
export const logger = new Logger()

/**
 * Helper to check current log level
 */
export function isDebugEnabled(): boolean {
  return logger.getLevel() >= LogLevel.DEBUG
}

export function isVerboseEnabled(): boolean {
  return logger.getLevel() >= LogLevel.VERBOSE
}
