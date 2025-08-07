import {useCallback, useEffect, useMemo, useState} from 'react'
import {useQueryClient, QueryClient} from '@tanstack/react-query'
import {logger} from '#/logger'
import {journalKeys} from './journal-keys'
import {JournalEntry} from './journal'

/**
 * Error recovery and resilience system for journal operations
 * Implements exponential backoff, circuit breaker, and data consistency validation
 */

export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitterMs: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitterMs: 100,
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeout: number
  monitoringWindow: number
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5, // Trip after 5 failures
  recoveryTimeout: 60000, // 1 minute
  monitoringWindow: 300000, // 5 minutes
}

/**
 * Exponential backoff retry utility with jitter
 */
export class RetryManager {
  constructor(private config: RetryConfig = DEFAULT_RETRY_CONFIG) {}

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await operation()
        
        if (attempt > 0) {
          logger.info('Retry succeeded', {
            context,
            attempt,
            totalAttempts: attempt + 1,
          })
        }
        
        return result
      } catch (error) {
        lastError = error as Error
        
        logger.warn('Operation failed, considering retry', {
          context,
          attempt: attempt + 1,
          error: String(error),
          willRetry: attempt < this.config.maxRetries,
        })

        if (attempt < this.config.maxRetries) {
          const delay = this.calculateDelay(attempt)
          await this.sleep(delay)
        }
      }
    }

    logger.error('All retry attempts failed', {
      context,
      totalAttempts: this.config.maxRetries + 1,
      finalError: String(lastError),
    })

    throw lastError!
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt),
      this.config.maxDelay
    )
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.config.jitterMs
    
    return exponentialDelay + jitter
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Circuit breaker pattern for journal API calls
 */
export class JournalCircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  private failures: Array<{timestamp: number; error: string}> = []
  private lastFailureTime = 0
  private nextAttemptTime = 0

  constructor(private config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {}

  async execute<T>(operation: () => Promise<T>, context: string): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`Circuit breaker is open for ${context}. Next attempt in ${Math.ceil((this.nextAttemptTime - Date.now()) / 1000)}s`)
      } else {
        this.state = 'half-open'
        logger.info('Circuit breaker entering half-open state', {context})
      }
    }

    try {
      const result = await operation()
      
      if (this.state === 'half-open') {
        this.reset()
        logger.info('Circuit breaker recovered, returning to closed state', {context})
      }
      
      return result
    } catch (error) {
      this.recordFailure(String(error))
      
      if (this.shouldTrip()) {
        this.trip(context)
      }
      
      throw error
    }
  }

  private recordFailure(error: string) {
    const now = Date.now()
    this.failures.push({timestamp: now, error})
    this.lastFailureTime = now
    
    // Clean old failures outside monitoring window
    this.failures = this.failures.filter(
      failure => now - failure.timestamp < this.config.monitoringWindow
    )
  }

  private shouldTrip(): boolean {
    const recentFailures = this.failures.filter(
      failure => Date.now() - failure.timestamp < this.config.monitoringWindow
    )
    
    return recentFailures.length >= this.config.failureThreshold
  }

  private trip(context: string) {
    this.state = 'open'
    this.nextAttemptTime = Date.now() + this.config.recoveryTimeout
    
    logger.error('Circuit breaker tripped', {
      context,
      failures: this.failures.length,
      nextAttemptTime: new Date(this.nextAttemptTime).toISOString(),
    })
  }

  private reset() {
    this.state = 'closed'
    this.failures = []
    this.lastFailureTime = 0
    this.nextAttemptTime = 0
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures.length,
      nextAttemptTime: this.nextAttemptTime,
    }
  }
}

/**
 * Data consistency validation and repair
 */
export class DataConsistencyManager {
  constructor(private queryClient: QueryClient) {}

  /**
   * Validate cache consistency and repair if necessary
   */
  async validateAndRepair(did: string) {
    logger.info('Starting data consistency validation', {did})

    try {
      await this.validateCacheIntegrity(did)
      await this.repairInconsistentData(did)
      await this.validateAnalyticsConsistency(did)
      
      logger.info('Data consistency validation completed successfully', {did})
    } catch (error) {
      logger.error('Data consistency validation failed', {
        did,
        error: String(error),
      })
    }
  }

  private async validateCacheIntegrity(did: string) {
    // Check if cached data matches expected structure
    const queries = this.queryClient.getQueriesData({
      queryKey: journalKeys.entries(),
    })

    for (const [queryKey, data] of queries) {
      if (!data) continue

      try {
        this.validateDataStructure(data, queryKey)
      } catch (error) {
        logger.warn('Invalid data structure detected, removing from cache', {
          queryKey,
          error: String(error),
        })
        
        this.queryClient.removeQueries({queryKey: queryKey as any})
      }
    }
  }

  private validateDataStructure(data: any, queryKey: any) {
    // Validate infinite query structure
    if (data.pages) {
      if (!Array.isArray(data.pages)) {
        throw new Error('Invalid pages structure')
      }
      
      data.pages.forEach((page: any, index: number) => {
        if (!page.entries || !Array.isArray(page.entries)) {
          throw new Error(`Invalid entries structure in page ${index}`)
        }
        
        page.entries.forEach((entry: any, entryIndex: number) => {
          this.validateEntryStructure(entry, `page ${index}, entry ${entryIndex}`)
        })
      })
    }
    
    // Validate single entry
    if (data.uri) {
      this.validateEntryStructure(data, 'single entry')
    }
  }

  private validateEntryStructure(entry: any, context: string) {
    const requiredFields = ['uri', 'text', 'entryType', 'createdAt', 'isPrivate']
    
    for (const field of requiredFields) {
      if (!(field in entry)) {
        throw new Error(`Missing required field '${field}' in ${context}`)
      }
    }

    // Validate field types
    if (typeof entry.uri !== 'string' || !entry.uri.startsWith('at://')) {
      throw new Error(`Invalid uri format in ${context}`)
    }
    
    if (!['real_time', 'backdated'].includes(entry.entryType)) {
      throw new Error(`Invalid entryType in ${context}`)
    }
    
    if (typeof entry.isPrivate !== 'boolean') {
      throw new Error(`Invalid isPrivate type in ${context}`)
    }
  }

  private async repairInconsistentData(did: string) {
    // Look for duplicate entries across different cache keys
    const allEntries = new Map<string, {queryKey: any; entry: JournalEntry}>()
    const duplicates: string[] = []

    const queries = this.queryClient.getQueriesData({
      queryKey: journalKeys.entries(),
    })

    for (const [queryKey, data] of queries) {
      if (!data) continue

      const entries = this.extractEntriesFromData(data)
      
      entries.forEach(entry => {
        if (allEntries.has(entry.uri)) {
          duplicates.push(entry.uri)
        } else {
          allEntries.set(entry.uri, {queryKey: queryKey as any, entry})
        }
      })
    }

    if (duplicates.length > 0) {
      logger.warn('Found duplicate entries in cache, cleaning up', {
        duplicates: duplicates.length,
      })

      // Remove duplicate entries (keep the most recent one)
      for (const duplicateUri of duplicates) {
        const allCopies = Array.from(allEntries.values())
          .filter(({entry}) => entry.uri === duplicateUri)
          .sort((a, b) => 
            new Date(b.entry.createdAt).getTime() - new Date(a.entry.createdAt).getTime()
          )

        // Keep first (most recent), remove others
        for (let i = 1; i < allCopies.length; i++) {
          this.removeEntryFromCache(allCopies[i].queryKey, duplicateUri)
        }
      }
    }
  }

  private extractEntriesFromData(data: any): JournalEntry[] {
    if (data.pages) {
      return data.pages.flatMap((page: any) => page.entries || [])
    }
    
    if (data.uri) {
      return [data]
    }
    
    return []
  }

  private removeEntryFromCache(queryKey: any, entryUri: string) {
    this.queryClient.setQueryData(queryKey, (oldData: any) => {
      if (!oldData) return oldData

      if (oldData.pages) {
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            entries: page.entries.filter((entry: JournalEntry) => 
              entry.uri !== entryUri
            ),
          })),
        }
      }

      if (oldData.uri === entryUri) {
        return null
      }

      return oldData
    })
  }

  private async validateAnalyticsConsistency(did: string) {
    // Validate that analytics data is consistent with journal entries
    const analyticsQueries = this.queryClient.getQueriesData({
      queryKey: journalKeys.analytics(),
    })

    for (const [queryKey, analyticsData] of analyticsQueries) {
      if (!analyticsData) continue

      // Get corresponding entries data
      const entriesData = this.queryClient.getQueryData(
        journalKeys.entryList(did)
      )

      if (entriesData) {
        const entries = this.extractEntriesFromData(entriesData)
        const calculatedStats = this.calculateStatsFromEntries(entries)
        
        if (!this.statsMatch(analyticsData as any, calculatedStats)) {
          logger.warn('Analytics data inconsistent with entries, invalidating', {
            queryKey,
          })
          
          this.queryClient.invalidateQueries({queryKey: queryKey as any})
        }
      }
    }
  }

  private calculateStatsFromEntries(entries: JournalEntry[]) {
    return {
      totalEntries: entries.length,
      privateEntries: entries.filter(e => e.isPrivate).length,
      publicEntries: entries.filter(e => !e.isPrivate).length,
      realTimeEntries: entries.filter(e => e.entryType === 'real_time').length,
      backdatedEntries: entries.filter(e => e.entryType === 'backdated').length,
    }
  }

  private statsMatch(cached: any, calculated: any): boolean {
    const tolerance = 0.1 // 10% tolerance for timing differences
    
    return Math.abs(cached.totalEntries - calculated.totalEntries) <= tolerance &&
           Math.abs(cached.privateEntries - calculated.privateEntries) <= tolerance &&
           Math.abs(cached.publicEntries - calculated.publicEntries) <= tolerance
  }
}

/**
 * React hook for error recovery and user notifications
 */
export function useJournalErrorRecovery() {
  const queryClient = useQueryClient()
  const [errorState, setErrorState] = useState<{
    hasError: boolean
    error?: Error
    recovery?: () => void
  }>({hasError: false})

  const retryManager = useMemo(() => new RetryManager(), [])
  const circuitBreaker = useMemo(() => new JournalCircuitBreaker(), [])
  const consistencyManager = useMemo(
    () => new DataConsistencyManager(queryClient), 
    [queryClient]
  )

  const executeWithRecovery = useCallback(async <T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> => {
    try {
      return await circuitBreaker.execute(
        () => retryManager.executeWithRetry(operation, context),
        context
      )
    } catch (error) {
      setErrorState({
        hasError: true,
        error: error as Error,
        recovery: () => {
          setErrorState({hasError: false})
          // Optionally retry the operation
        },
      })
      throw error
    }
  }, [retryManager, circuitBreaker])

  const clearErrors = useCallback(() => {
    setErrorState({hasError: false})
  }, [])

  const validateDataConsistency = useCallback(async (did: string) => {
    try {
      await consistencyManager.validateAndRepair(did)
    } catch (error) {
      logger.error('Data consistency validation failed', {
        error: String(error),
      })
    }
  }, [consistencyManager])

  // Monitor circuit breaker state
  const circuitBreakerState = useMemo(() => 
    circuitBreaker.getState(), 
    [circuitBreaker]
  )

  return {
    errorState,
    executeWithRecovery,
    clearErrors,
    validateDataConsistency,
    circuitBreakerState,
  }
}

/**
 * Global error boundary for journal operations
 */
export class JournalErrorBoundary {
  private errorHandlers: Map<string, (error: Error) => void> = new Map()
  private globalErrorHandler?: (error: Error, context: string) => void

  registerErrorHandler(context: string, handler: (error: Error) => void) {
    this.errorHandlers.set(context, handler)
  }

  setGlobalErrorHandler(handler: (error: Error, context: string) => void) {
    this.globalErrorHandler = handler
  }

  handleError(error: Error, context: string) {
    logger.error('Journal operation error', {
      context,
      error: String(error),
      stack: error.stack,
    })

    // Try context-specific handler first
    const contextHandler = this.errorHandlers.get(context)
    if (contextHandler) {
      try {
        contextHandler(error)
        return
      } catch (handlerError) {
        logger.error('Error handler failed', {
          context,
          handlerError: String(handlerError),
        })
      }
    }

    // Fall back to global handler
    if (this.globalErrorHandler) {
      try {
        this.globalErrorHandler(error, context)
      } catch (handlerError) {
        logger.error('Global error handler failed', {
          context,
          handlerError: String(handlerError),
        })
      }
    }
  }
}

// Global instance
export const journalErrorBoundary = new JournalErrorBoundary()