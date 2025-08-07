import {useEffect, useCallback, useMemo} from 'react'
import {useQueryClient, QueryClient} from '@tanstack/react-query'
import {logger} from '#/logger'
import {journalKeys} from './journal-keys'

/**
 * Performance monitoring and metrics collection for journal queries
 * Provides real-time insights into query performance, cache efficiency, and user experience
 */

export interface QueryMetrics {
  queryKey: string
  executionTime: number
  cacheHit: boolean
  dataSize: number
  networkTime?: number
  errorCount: number
  retryCount: number
  timestamp: number
}

export interface CacheMetrics {
  hitRate: number
  missRate: number
  evictionRate: number
  memoryUsage: number
  privacyDataRatio: number
  avgQueryTime: number
  slowestQueries: Array<{queryKey: string; time: number}>
}

export interface UserExperienceMetrics {
  timeToFirstByte: number
  timeToInteractive: number
  scrollPerformance: {
    fps: number
    jankyFrames: number
  }
  offlineEvents: number
  errorRecoveryTime: number
}

/**
 * Query performance tracker with detailed metrics collection
 */
export class JournalQueryTracker {
  private metrics: Map<string, QueryMetrics[]> = new Map()
  private performanceObserver?: PerformanceObserver
  private maxMetricsHistory = 100

  constructor(private queryClient: QueryClient) {
    this.setupQueryTracking()
    this.setupPerformanceObserver()
  }

  private setupQueryTracking() {
    // Track query lifecycle events
    this.queryClient.getQueryCache().subscribe((event) => {
      switch (event.type) {
        case 'queryAdded':
          this.trackQueryStart(event.query)
          break
        case 'queryUpdated':
          this.trackQueryUpdate(event.query)
          break
        case 'queryRemoved':
          this.trackQueryRemoval(event.query)
          break
      }
    })
  }

  private setupPerformanceObserver() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.name.includes('journal')) {
            this.recordPerformanceEntry(entry)
          }
        })
      })

      this.performanceObserver.observe({entryTypes: ['measure', 'navigation', 'resource']})
    }
  }

  private trackQueryStart(query: any) {
    const queryKey = query.queryKey.join(':')
    if (!queryKey.includes('journal')) return

    // Mark performance measurement start
    if (typeof performance !== 'undefined') {
      performance.mark(`journal-query-start-${queryKey}`)
    }

    logger.debug('Journal query started', {
      queryKey,
      state: query.state.status,
    })
  }

  private trackQueryUpdate(query: any) {
    const queryKey = query.queryKey.join(':')
    if (!queryKey.includes('journal')) return

    const wasFromCache = query.state.isFetchedAfterMount === false
    const hasError = !!query.state.error
    const dataSize = this.estimateDataSize(query.state.data)

    // Mark performance measurement end
    let executionTime = 0
    if (typeof performance !== 'undefined') {
      try {
        performance.mark(`journal-query-end-${queryKey}`)
        performance.measure(
          `journal-query-${queryKey}`,
          `journal-query-start-${queryKey}`,
          `journal-query-end-${queryKey}`
        )
        
        const measure = performance.getEntriesByName(`journal-query-${queryKey}`)[0]
        executionTime = measure.duration
      } catch (error) {
        // Performance API might not be available or measurement might have failed
      }
    }

    const metric: QueryMetrics = {
      queryKey,
      executionTime,
      cacheHit: wasFromCache,
      dataSize,
      errorCount: hasError ? 1 : 0,
      retryCount: query.state.fetchFailureCount || 0,
      timestamp: Date.now(),
    }

    this.recordMetric(metric)

    logger.debug('Journal query updated', {
      queryKey,
      executionTime,
      cacheHit: wasFromCache,
      dataSize,
      hasError,
    })
  }

  private trackQueryRemoval(query: any) {
    const queryKey = query.queryKey.join(':')
    if (!queryKey.includes('journal')) return

    logger.debug('Journal query removed from cache', {queryKey})
  }

  private recordPerformanceEntry(entry: PerformanceEntry) {
    logger.debug('Performance entry recorded', {
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime,
    })
  }

  private recordMetric(metric: QueryMetrics) {
    const existing = this.metrics.get(metric.queryKey) || []
    existing.push(metric)
    
    // Keep only recent metrics to prevent memory leak
    if (existing.length > this.maxMetricsHistory) {
      existing.splice(0, existing.length - this.maxMetricsHistory)
    }
    
    this.metrics.set(metric.queryKey, existing)
  }

  private estimateDataSize(data: any): number {
    if (!data) return 0
    
    try {
      return JSON.stringify(data).length * 2 // Rough UTF-16 byte estimate
    } catch {
      return 0
    }
  }

  getCacheMetrics(): CacheMetrics {
    const allMetrics = Array.from(this.metrics.values()).flat()
    const totalQueries = allMetrics.length
    
    if (totalQueries === 0) {
      return {
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        memoryUsage: 0,
        privacyDataRatio: 0,
        avgQueryTime: 0,
        slowestQueries: [],
      }
    }

    const cacheHits = allMetrics.filter(m => m.cacheHit).length
    const totalExecutionTime = allMetrics.reduce((sum, m) => sum + m.executionTime, 0)
    const totalDataSize = allMetrics.reduce((sum, m) => sum + m.dataSize, 0)
    
    const slowestQueries = allMetrics
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 5)
      .map(m => ({queryKey: m.queryKey, time: m.executionTime}))

    return {
      hitRate: cacheHits / totalQueries,
      missRate: (totalQueries - cacheHits) / totalQueries,
      evictionRate: 0, // Would need cache eviction tracking
      memoryUsage: totalDataSize,
      privacyDataRatio: 0, // Would need privacy tracking integration
      avgQueryTime: totalExecutionTime / totalQueries,
      slowestQueries,
    }
  }

  getQueryHistory(queryKey: string): QueryMetrics[] {
    return this.metrics.get(queryKey) || []
  }

  cleanup() {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
    }
    this.metrics.clear()
  }
}

/**
 * User experience monitoring for journal interactions
 */
export class UserExperienceTracker {
  private interactionMetrics: Map<string, number> = new Map()
  private scrollMetrics = {
    frameCount: 0,
    jankyFrames: 0,
    lastFrameTime: 0,
  }

  constructor() {
    this.setupScrollTracking()
    this.setupInteractionTracking()
  }

  private setupScrollTracking() {
    if (typeof window !== 'undefined') {
      let rafId: number

      const trackScrollPerformance = () => {
        const now = performance.now()
        const frameDelta = now - this.scrollMetrics.lastFrameTime

        if (this.scrollMetrics.lastFrameTime > 0) {
          this.scrollMetrics.frameCount++
          
          // Frame is janky if it takes longer than 16.67ms (60fps)
          if (frameDelta > 16.67) {
            this.scrollMetrics.jankyFrames++
          }
        }

        this.scrollMetrics.lastFrameTime = now
        rafId = requestAnimationFrame(trackScrollPerformance)
      }

      // Start tracking during journal list scroll
      const startScrollTracking = () => {
        if (!rafId) {
          trackScrollPerformance()
        }
      }

      const stopScrollTracking = () => {
        if (rafId) {
          cancelAnimationFrame(rafId)
          rafId = 0
        }
      }

      // Listen for scroll events on journal containers
      document.addEventListener('scroll', startScrollTracking, {passive: true})
      
      // Stop tracking after scroll ends
      let scrollTimeout: number
      document.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout)
        scrollTimeout = window.setTimeout(stopScrollTracking, 100)
      }, {passive: true})
    }
  }

  private setupInteractionTracking() {
    if (typeof window !== 'undefined') {
      // Track time to interactive for journal features
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.entryType === 'measure' && entry.name.includes('journal')) {
            this.interactionMetrics.set(entry.name, entry.duration)
          }
        })
      })

      observer.observe({entryTypes: ['measure']})
    }
  }

  markInteractionStart(interactionName: string) {
    if (typeof performance !== 'undefined') {
      performance.mark(`${interactionName}-start`)
    }
  }

  markInteractionEnd(interactionName: string) {
    if (typeof performance !== 'undefined') {
      try {
        performance.mark(`${interactionName}-end`)
        performance.measure(
          interactionName,
          `${interactionName}-start`,
          `${interactionName}-end`
        )
      } catch (error) {
        logger.warn('Failed to measure interaction', {interactionName, error})
      }
    }
  }

  getScrollPerformance() {
    const fps = this.scrollMetrics.frameCount > 0 
      ? 60 * (this.scrollMetrics.frameCount - this.scrollMetrics.jankyFrames) / this.scrollMetrics.frameCount
      : 60

    return {
      fps: Math.round(fps),
      jankyFrames: this.scrollMetrics.jankyFrames,
      totalFrames: this.scrollMetrics.frameCount,
      smoothnessScore: fps / 60, // 0-1 scale
    }
  }

  getInteractionMetrics(): UserExperienceMetrics {
    const scrollPerf = this.getScrollPerformance()
    
    return {
      timeToFirstByte: this.interactionMetrics.get('journal-load-ttfb') || 0,
      timeToInteractive: this.interactionMetrics.get('journal-load-tti') || 0,
      scrollPerformance: {
        fps: scrollPerf.fps,
        jankyFrames: scrollPerf.jankyFrames,
      },
      offlineEvents: 0, // Would be tracked separately
      errorRecoveryTime: this.interactionMetrics.get('journal-error-recovery') || 0,
    }
  }

  reset() {
    this.interactionMetrics.clear()
    this.scrollMetrics = {
      frameCount: 0,
      jankyFrames: 0,
      lastFrameTime: 0,
    }
  }
}

/**
 * React hook for monitoring journal query performance
 */
export function useJournalPerformanceMonitoring() {
  const queryClient = useQueryClient()
  
  const tracker = useMemo(() => 
    new JournalQueryTracker(queryClient), 
    [queryClient]
  )
  
  const uxTracker = useMemo(() => 
    new UserExperienceTracker(), 
    []
  )

  const getCacheMetrics = useCallback(() => 
    tracker.getCacheMetrics(), 
    [tracker]
  )

  const getUXMetrics = useCallback(() =>
    uxTracker.getInteractionMetrics(),
    [uxTracker]
  )

  const markInteractionStart = useCallback((name: string) =>
    uxTracker.markInteractionStart(name),
    [uxTracker]
  )

  const markInteractionEnd = useCallback((name: string) =>
    uxTracker.markInteractionEnd(name),
    [uxTracker]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      tracker.cleanup()
    }
  }, [tracker])

  // Report metrics periodically
  useEffect(() => {
    const reportInterval = setInterval(() => {
      const cacheMetrics = getCacheMetrics()
      const uxMetrics = getUXMetrics()
      
      logger.info('Journal performance metrics', {
        cache: cacheMetrics,
        userExperience: uxMetrics,
      })
    }, 60000) // Report every minute

    return () => clearInterval(reportInterval)
  }, [getCacheMetrics, getUXMetrics])

  return {
    getCacheMetrics,
    getUXMetrics,
    markInteractionStart,
    markInteractionEnd,
    queryTracker: tracker,
    uxTracker,
  }
}

/**
 * Performance-aware query configuration
 */
export function getOptimalQueryConfig(queryType: 'entries' | 'analytics' | 'search') {
  const baseConfig = {
    staleTime: 60000, // 1 minute default
    cacheTime: 300000, // 5 minutes default
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  }

  switch (queryType) {
    case 'entries':
      return {
        ...baseConfig,
        staleTime: 120000, // 2 minutes - entries change less frequently
        cacheTime: 600000, // 10 minutes - keep entries cached longer
        refetchInterval: false, // Don't auto-refetch entries
      }
    
    case 'analytics':
      return {
        ...baseConfig,
        staleTime: 300000, // 5 minutes - analytics computed less frequently
        cacheTime: 1800000, // 30 minutes - analytics can be cached longer
        refetchInterval: 300000, // Refresh every 5 minutes in background
      }
    
    case 'search':
      return {
        ...baseConfig,
        staleTime: 30000, // 30 seconds - search results can change quickly
        cacheTime: 180000, // 3 minutes - don't keep search results too long
        refetchOnWindowFocus: true, // Refetch search on focus
      }
    
    default:
      return baseConfig
  }
}

/**
 * A/B testing support for query optimization
 */
export function useQueryOptimizationExperiment(experimentName: string) {
  // This would integrate with your A/B testing service
  // For now, return default configuration
  const experiment = useMemo(() => ({
    variant: 'control' as 'control' | 'optimized',
    config: getOptimalQueryConfig('entries'),
  }), [])

  const trackExperimentMetric = useCallback((metricName: string, value: number) => {
    logger.info('A/B test metric', {
      experiment: experimentName,
      variant: experiment.variant,
      metric: metricName,
      value,
    })
  }, [experimentName, experiment.variant])

  return {
    variant: experiment.variant,
    config: experiment.config,
    trackMetric: trackExperimentMetric,
  }
}