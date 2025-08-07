import {QueryClient, QueryCache} from '@tanstack/react-query'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {logger} from '#/logger'
import {journalKeys} from './journal-keys'
import {JournalEntry} from './journal'

/**
 * Privacy-aware cache management for journal data
 * Implements segmented caching, selective persistence, and memory pressure handling
 * 
 * REVIEW AND FIX BEFORE GOING TO PRODUCTION
 * 
 */

export interface CacheConfig {
  maxCacheSize: number // Maximum cache size in MB
  privacyCacheSize: number // Reserved space for private data
  persistanceEnabled: boolean
  encryptPrivateData: boolean
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxCacheSize: 100, // 100MB total cache
  privacyCacheSize: 20, // 20MB for private entries
  persistanceEnabled: true,
  encryptPrivateData: true,
}

/**
 * Custom query cache with privacy-aware eviction and memory management
 */
export class JournalQueryCache extends QueryCache {
  private cacheConfig: CacheConfig
  private memoryPressureThreshold = 0.8 // 80% of max cache size
  private privateDataKeys = new Set<string>()

  constructor(config: CacheConfig = DEFAULT_CACHE_CONFIG) {
    super()
    this.cacheConfig = config
    this.setupMemoryPressureHandling()
    this.setupPrivacyTracking()
  }

  private setupMemoryPressureHandling() {
    // Monitor cache size and trigger cleanup when needed
    setInterval(() => {
      const cacheSize = this.getCacheSize()
      if (cacheSize > this.cacheConfig.maxCacheSize * this.memoryPressureThreshold) {
        this.handleMemoryPressure()
      }
    }, 30000) // Check every 30 seconds
  }

  private setupPrivacyTracking() {
    // Track which cache entries contain private data
    this.subscribe((event) => {
      if (event.type === 'queryAdded' || event.type === 'queryUpdated') {
        const queryKey = event.query.queryKey.join(':')
        const data = event.query.state.data

        if (this.containsPrivateData(data)) {
          this.privateDataKeys.add(queryKey)
        } else {
          this.privateDataKeys.delete(queryKey)
        }
      }
    })
  }

  private containsPrivateData(data: any): boolean {
    if (!data) return false

    // Check if data contains private journal entries
    if (Array.isArray(data)) {
      return data.some((item) => item?.isPrivate === true)
    }

    if (data.pages) {
      // Infinite query data
      return data.pages.some((page: any) =>
        page.entries?.some((entry: JournalEntry) => entry.isPrivate)
      )
    }

    if (data.isPrivate === true) {
      return true
    }

    return false
  }

  private getCacheSize(): number {
    // Estimate cache size in MB
    // This is a rough estimate - in production, use more accurate memory measurement
    const queries = this.getAll()
    let totalSize = 0

    queries.forEach((query) => {
      if (query.state.data) {
        try {
          const serialized = JSON.stringify(query.state.data)
          totalSize += serialized.length * 2 // Rough byte estimate (UTF-16)
        } catch {
          // Skip unserializable data
        }
      }
    })

    return totalSize / (1024 * 1024) // Convert to MB
  }

  private handleMemoryPressure() {
    logger.info('Handling memory pressure in journal cache', {
      currentSize: this.getCacheSize(),
      threshold: this.cacheConfig.maxCacheSize * this.memoryPressureThreshold,
    })

    // Strategy: Remove least recently used non-private data first
    const queries = this.getAll()
    const sortedQueries = queries
      .filter((query) => {
        const queryKey = query.queryKey.join(':')
        return !this.privateDataKeys.has(queryKey) // Don't evict private data
      })
      .sort((a, b) => (a.state.dataUpdatedAt || 0) - (b.state.dataUpdatedAt || 0))

    // Remove oldest 25% of non-private queries
    const toRemove = Math.ceil(sortedQueries.length * 0.25)
    for (let i = 0; i < toRemove; i++) {
      sortedQueries[i].remove()
    }

    logger.info('Memory pressure cleanup completed', {
      queriesRemoved: toRemove,
      newSize: this.getCacheSize(),
    })
  }

  /**
   * Selective cache invalidation based on privacy levels
   */
  invalidatePrivateEntries(did: string) {
    this.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey.join(':')
        return (
          queryKey.includes(did) &&
          this.privateDataKeys.has(queryKey)
        )
      },
    })
  }

  /**
   * Clear all private data from cache (useful for user logout)
   */
  clearPrivateData() {
    const privateQueries = this.getAll().filter((query) => {
      const queryKey = query.queryKey.join(':')
      return this.privateDataKeys.has(queryKey)
    })

    privateQueries.forEach((query) => query.remove())
    this.privateDataKeys.clear()

    logger.info('Cleared all private data from cache', {
      queriesRemoved: privateQueries.length,
    })
  }
}

/**
 * Cache persistence utilities with encryption for private data
 */
export class JournalCachePersistence {
  private storageKey = 'journal-query-cache'
  private encryptionKey?: string

  constructor(encryptionKey?: string) {
    this.encryptionKey = encryptionKey
  }

  async persistCache(queryClient: QueryClient) {
    if (!DEFAULT_CACHE_CONFIG.persistanceEnabled) return

    try {
      const cache = queryClient.getQueryCache()
      const persistData = {
        queries: [] as any[],
        timestamp: Date.now(),
      }

      cache.getAll().forEach((query) => {
        const queryKey = query.queryKey.join(':')
        const isPrivate = cache instanceof JournalQueryCache && 
          (cache as JournalQueryCache)['privateDataKeys'].has(queryKey)

        // Only persist certain query types
        if (this.shouldPersistQuery(query.queryKey)) {
          let data = query.state.data
          
          // Encrypt private data before persistence
          if (isPrivate && this.encryptionKey && DEFAULT_CACHE_CONFIG.encryptPrivateData) {
            data = this.encryptData(data)
          }

          persistData.queries.push({
            queryKey: query.queryKey,
            data,
            dataUpdatedAt: query.state.dataUpdatedAt,
            isPrivate,
            encrypted: isPrivate && !!this.encryptionKey,
          })
        }
      })

      await AsyncStorage.setItem(this.storageKey, JSON.stringify(persistData))
      logger.info('Cache persistence completed', {
        queriesCount: persistData.queries.length,
      })
    } catch (error) {
      logger.error('Failed to persist cache', {message: String(error)})
    }
  }

  async restoreCache(queryClient: QueryClient) {
    if (!DEFAULT_CACHE_CONFIG.persistanceEnabled) return

    try {
      const persistedData = await AsyncStorage.getItem(this.storageKey)
      if (!persistedData) return

      const {queries, timestamp} = JSON.parse(persistedData)
      
      // Check if cache is too old (older than 24 hours)
      if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
        await AsyncStorage.removeItem(this.storageKey)
        return
      }

      for (const persistedQuery of queries) {
        try {
          let data = persistedQuery.data

          // Decrypt private data if needed
          if (persistedQuery.encrypted && this.encryptionKey) {
            data = this.decryptData(data)
          }

          queryClient.setQueryData(persistedQuery.queryKey, data)
        } catch (error) {
          logger.error('Failed to restore query from cache', {
            queryKey: persistedQuery.queryKey,
            error: String(error),
          })
        }
      }

      logger.info('Cache restoration completed', {
        queriesRestored: queries.length,
      })
    } catch (error) {
      logger.error('Failed to restore cache', {message: String(error)})
    }
  }

  private shouldPersistQuery(queryKey: unknown[]): boolean {
    const keyString = queryKey.join(':')
    
    // Persist journal entries and analytics, but not real-time feeds
    return (
      keyString.includes('journal:entries') ||
      keyString.includes('journal:analytics') ||
      keyString.includes('journal:sources')
    ) && !keyString.includes('feed:timeline')
  }

  private encryptData(data: any): string {
    // In production, use proper encryption like AES-256-GCM
    // This is a placeholder for the encryption implementation
    if (!this.encryptionKey) return JSON.stringify(data)
    
    // TODO: Implement actual encryption
    return btoa(JSON.stringify(data))
  }

  private decryptData(encryptedData: string): any {
    // In production, use proper decryption
    // This is a placeholder for the decryption implementation
    if (!this.encryptionKey) return JSON.parse(encryptedData)
    
    // TODO: Implement actual decryption
    return JSON.parse(atob(encryptedData))
  }
}

/**
 * Hierarchical cache invalidation utilities
 */
export class JournalCacheInvalidator {
  constructor(private queryClient: QueryClient) {}

  /**
   * Invalidate entry-related caches when an entry is modified
   */
  async invalidateEntry(entryUri: string, did: string) {
    // Invalidate the specific entry
    await this.queryClient.invalidateQueries({
      queryKey: journalKeys.entry(entryUri),
    })

    // Invalidate entry lists that might contain this entry
    await this.queryClient.invalidateQueries({
      queryKey: journalKeys.entryList(did),
    })

    // Invalidate feeds that might include this entry
    await this.queryClient.invalidateQueries({
      queryKey: journalKeys.feeds(),
    })

    // Invalidate analytics (stats might have changed)
    await this.queryClient.invalidateQueries({
      queryKey: journalKeys.analytics(),
    })
  }

  /**
   * Invalidate all caches when privacy settings change
   */
  async invalidatePrivacyChange(entryUri: string, did: string, newPrivacyLevel: boolean) {
    // This is a critical operation - privacy changes affect cache visibility
    
    // Remove the entry from all caches first
    this.queryClient.removeQueries({
      queryKey: journalKeys.entry(entryUri),
    })

    // Invalidate all related caches
    await this.invalidateEntry(entryUri, did)

    // If entry became private, ensure it's not in any public caches
    if (newPrivacyLevel) {
      this.queryClient.setQueriesData(
        {queryKey: journalKeys.entries()},
        (oldData: any) => {
          if (!oldData) return oldData
          
          // Remove from infinite query pages
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
          
          return oldData
        }
      )
    }
  }

  /**
   * Smart cache invalidation on network reconnection
   */
  async invalidateOnReconnection(did: string) {
    // Only invalidate stale data, preserve fresh data
    const staleThreshold = Date.now() - 5 * 60 * 1000 // 5 minutes

    await this.queryClient.invalidateQueries({
      predicate: (query) => {
        const isJournalQuery = query.queryKey[0] === 'journal'
        const isStale = (query.state.dataUpdatedAt || 0) < staleThreshold
        const isUserQuery = query.queryKey.includes(did)
        
        return isJournalQuery && isUserQuery && isStale
      },
    })
  }
}

/**
 * Cache performance monitoring
 */
export class JournalCacheMetrics {
  private metrics = {
    hitRate: 0,
    missRate: 0,
    totalQueries: 0,
    cacheSize: 0,
    privateDataRatio: 0,
  }

  constructor(private queryCache: JournalQueryCache) {
    this.setupMetricsCollection()
  }

  private setupMetricsCollection() {
    this.queryCache.subscribe((event) => {
      this.updateMetrics(event)
    })

    // Report metrics periodically
    setInterval(() => {
      this.reportMetrics()
    }, 60000) // Every minute
  }

  private updateMetrics(event: any) {
    switch (event.type) {
      case 'queryAdded':
        this.metrics.totalQueries++
        break
      case 'queryRemoved':
        this.metrics.totalQueries--
        break
    }

    // Update cache size and private data ratio
    this.metrics.cacheSize = this.queryCache['getCacheSize']()
    const totalQueries = this.queryCache.getAll().length
    const privateQueries = this.queryCache['privateDataKeys'].size
    this.metrics.privateDataRatio = totalQueries > 0 ? privateQueries / totalQueries : 0
  }

  private reportMetrics() {
    logger.info('Journal cache metrics', this.metrics)
  }

  getMetrics() {
    return {...this.metrics}
  }
}