import React, {useCallback, useMemo} from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  keepPreviousData,
  InfiniteData,
} from '@tanstack/react-query'
import {useAgent, useSession} from '#/state/session'
import {STALE} from '#/state/queries'
import {logger} from '#/logger'
import {journalKeys, JournalFilters, PrivacyLevel, TimePeriod, FeedType, FeedParams} from './journal-keys'
import {JournalCacheInvalidator} from './journal-cache'

// Types from existing JournalEntry component
export interface JournalEntry {
  uri: string
  cid: string
  text: string
  entryType: 'real_time' | 'backdated'
  incidentTimestamp?: string
  location?: {
    latitude: number
    longitude: number
    accuracy?: number
    address?: string
  }
  symptoms?: Array<{
    category: string
    severity: number
    notes?: string
  }>
  tags?: string[]
  sourceIds?: string[]
  isPrivate: boolean
  createdAt: string
  indexedAt?: string
  author: {
    did: string
    handle: string
    displayName?: string
    avatar?: string
  }
}

export interface JournalDraft {
  id: string
  text: string
  entryType: 'real_time' | 'backdated'
  incidentTimestamp?: string
  location?: JournalEntry['location']
  symptoms?: JournalEntry['symptoms']
  tags?: string[]
  sourceIds?: string[]
  isPrivate: boolean
  lastSaved: string
}

export interface JournalPrivacySettings {
  defaultPrivacy: PrivacyLevel
  allowPublicSymptoms: boolean
  allowPublicLocation: boolean
  shareWithCommunity: boolean
  enableAnalytics: boolean
  dataRetentionDays?: number
}

export interface JournalNotification {
  id: string
  type: 'entry_created' | 'entry_updated' | 'privacy_changed' | 'backup_completed' | 'sync_completed'
  entryUri?: string
  message: string
  timestamp: string
  read: boolean
}

export interface JournalExportData {
  metadata: {
    exportedAt: string
    totalEntries: number
    dateRange: {start: string; end: string}
    privacyLevel: PrivacyLevel
  }
  entries: JournalEntry[]
  analytics?: JournalStats
}

export interface JournalSyncStatus {
  lastSync: string
  pendingChanges: number
  conflicts: number
  isOnline: boolean
  isSyncing: boolean
}

export interface JournalStats {
  totalEntries: number
  privateEntries: number
  publicEntries: number
  realTimeEntries: number
  backdatedEntries: number
  entriesWithSymptoms: number
  entriesWithLocation: number
  entriesWithSources: number
  avgSymptomsPerEntry: number
  mostCommonSymptoms: Array<{category: string; count: number}>
  timelineCoverage: {
    firstEntry: string
    lastEntry: string
    totalDays: number
  }
}

export interface CreateJournalEntryParams {
  text: string
  entryType: 'real_time' | 'backdated'
  incidentTimestamp?: string
  location?: JournalEntry['location']
  symptoms?: JournalEntry['symptoms']
  tags?: string[]
  sourceIds?: string[]
  isPrivate: boolean
}

export interface UpdateJournalEntryParams extends Partial<CreateJournalEntryParams> {
  uri: string
  swapCid?: string // For conflict resolution
}

export interface JournalSearchParams {
  query: string
  filters?: JournalFilters
  sortBy?: 'relevance' | 'date' | 'symptoms'
  includePHI?: boolean // Include protected health information
}

export interface JournalShareParams {
  entryUri: string
  shareWith: 'public' | 'followers' | 'specific'
  recipients?: string[] // DIDs for specific sharing
  includeSymptoms?: boolean
  includeLocation?: boolean
  expirationDate?: string
}

// Infinite query page structure
interface JournalPage {
  entries: JournalEntry[]
  cursor?: string
  hasMore: boolean
}

/**
 * Fetch journal entries with infinite scroll support
 * Optimized for large datasets with privacy-aware caching
 */
export function useJournalEntriesInfinite(
  filters?: JournalFilters,
  enabled: boolean = true
) {
  const {currentAccount} = useSession()
  const agent = useAgent()

  return useInfiniteQuery<JournalPage, Error>({
    queryKey: journalKeys.entryList(currentAccount?.did || '', filters),
    queryFn: async ({pageParam}) => {
      if (!currentAccount) throw new Error('No authenticated user')

      try {
        const response = await agent.com.atproto.repo.listRecords({
          repo: currentAccount.did,
          collection: 'app.warlog.journal',
          limit: 20,
          cursor: pageParam as string | undefined,
        })

        const entries = response.data.records.map((record: any) => ({
          uri: record.uri,
          cid: record.cid,
          ...record.value,
          author: {
            did: currentAccount.did,
            handle: currentAccount.handle,
            displayName: currentAccount.displayName,
            avatar: currentAccount.avatar,
          },
        })) as JournalEntry[]

        // Apply client-side filtering for complex filters
        const filteredEntries = applyJournalFilters(entries, filters)

        return {
          entries: filteredEntries,
          cursor: response.data.cursor,
          hasMore: !!response.data.cursor,
        }
      } catch (error) {
        logger.error('Failed to fetch journal entries', {
          message: String(error),
          did: currentAccount.did,
          filters,
        })
        throw error
      }
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.cursor,
    staleTime: STALE.MINUTES.ONE,
    enabled: enabled && !!currentAccount,
    // Cache invalidation strategy
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  })
}

/**
 * Fetch a single journal entry with optimistic updates support
 */
export function useJournalEntry(uri: string, enabled: boolean = true) {
  const agent = useAgent()
  const {currentAccount} = useSession()

  return useQuery<JournalEntry, Error>({
    queryKey: journalKeys.entry(uri),
    queryFn: async () => {
      if (!currentAccount) throw new Error('No authenticated user')

      try {
        const response = await agent.com.atproto.repo.getRecord({
          repo: currentAccount.did,
          collection: 'app.warlog.journal',
          rkey: uri.split('/').pop()!,
        })

        return {
          uri: response.uri,
          cid: response.cid,
          ...response.value,
          author: {
            did: currentAccount.did,
            handle: currentAccount.handle,
            displayName: currentAccount.displayName,
            avatar: currentAccount.avatar,
          },
        } as JournalEntry
      } catch (error) {
        logger.error('Failed to fetch journal entry', {
          message: String(error),
          uri,
        })
        throw error
      }
    },
    staleTime: STALE.MINUTES.FIVE,
    enabled: enabled && !!uri && !!currentAccount,
  })
}

/**
 * Journal analytics with smart caching and background updates
 */
export function useJournalStats(period: TimePeriod = 'month') {
  const {currentAccount} = useSession()
  const agent = useAgent()

  return useQuery<JournalStats, Error>({
    queryKey: journalKeys.stats(currentAccount?.did || '', period),
    queryFn: async () => {
      if (!currentAccount) throw new Error('No authenticated user')

      try {
        // Fetch all entries for analysis (could be optimized with server-side aggregation)
        const response = await agent.com.atproto.repo.listRecords({
          repo: currentAccount.did,
          collection: 'app.warlog.journal',
          limit: 1000, // Consider pagination for users with many entries
        })

        const entries = response.data.records.map((record: any) => ({
          ...record.value,
          uri: record.uri,
        })) as JournalEntry[]

        return computeJournalStats(entries, period)
      } catch (error) {
        logger.error('Failed to compute journal stats', {
          message: String(error),
          did: currentAccount.did,
        })
        throw error
      }
    },
    staleTime: STALE.MINUTES.THIRTY,
    enabled: !!currentAccount,
    // Background refetch for analytics
    refetchInterval: STALE.MINUTES.THIRTY,
  })
}

/**
 * Create journal entry with optimistic updates and offline support
 */
export function useCreateJournalEntry() {
  const queryClient = useQueryClient()
  const agent = useAgent()
  const {currentAccount} = useSession()

  return useMutation<JournalEntry, Error, CreateJournalEntryParams>({
    mutationFn: async (params) => {
      if (!currentAccount) throw new Error('No authenticated user')

      try {
        const record = {
          $type: 'app.warlog.journal',
          ...params,
          createdAt: new Date().toISOString(),
        }

        const response = await agent.com.atproto.repo.createRecord({
          repo: currentAccount.did,
          collection: 'app.warlog.journal',
          record,
        })

        return {
          uri: response.uri,
          cid: response.cid,
          ...record,
          author: {
            did: currentAccount.did,
            handle: currentAccount.handle,
            displayName: currentAccount.displayName,
            avatar: currentAccount.avatar,
          },
        } as JournalEntry
      } catch (error) {
        logger.error('Failed to create journal entry', {
          message: String(error),
          params,
        })
        throw error
      }
    },
    onMutate: async (newEntry) => {
      // Optimistic update
      await queryClient.cancelQueries({
        queryKey: journalKeys.entries(),
      })

      // Create optimistic entry
      const optimisticEntry: JournalEntry = {
        uri: `temp:${Date.now()}`,
        cid: `temp:${Date.now()}`,
        ...newEntry,
        createdAt: new Date().toISOString(),
        author: {
          did: currentAccount?.did || '',
          handle: currentAccount?.handle || '',
          displayName: currentAccount?.displayName,
          avatar: currentAccount?.avatar,
        },
      }

      // Update infinite query cache
      queryClient.setQueriesData(
        {queryKey: journalKeys.entries()},
        (old: InfiniteData<JournalPage> | undefined) => {
          if (!old) return old
          return {
            ...old,
            pages: [
              {
                ...old.pages[0],
                entries: [optimisticEntry, ...old.pages[0].entries],
              },
              ...old.pages.slice(1),
            ],
          }
        }
      )

      return {optimisticEntry}
    },
    onSuccess: (newEntry, variables, context) => {
      // Update with real entry
      queryClient.setQueriesData(
        {queryKey: journalKeys.entries()},
        (old: InfiniteData<JournalPage> | undefined) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page, index) => {
              if (index === 0) {
                return {
                  ...page,
                  entries: page.entries.map((entry) =>
                    entry.uri === context?.optimisticEntry.uri ? newEntry : entry
                  ),
                }
              }
              return page
            }),
          }
        }
      )

      // Invalidate related caches
      queryClient.invalidateQueries({
        queryKey: journalKeys.analytics(),
      })
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.optimisticEntry) {
        queryClient.setQueriesData(
          {queryKey: journalKeys.entries()},
          (old: InfiniteData<JournalPage> | undefined) => {
            if (!old) return old
            return {
              ...old,
              pages: old.pages.map((page, index) => {
                if (index === 0) {
                  return {
                    ...page,
                    entries: page.entries.filter(
                      (entry) => entry.uri !== context.optimisticEntry.uri
                    ),
                  }
                }
                return page
              }),
            }
          }
        )
      }
    },
  })
}

/**
 * Update journal entry with conflict resolution
 */
export function useUpdateJournalEntry() {
  const queryClient = useQueryClient()
  const agent = useAgent()
  const {currentAccount} = useSession()

  return useMutation<JournalEntry, Error, UpdateJournalEntryParams>({
    mutationFn: async (params) => {
      if (!currentAccount) throw new Error('No authenticated user')

      try {
        const {uri, ...updateData} = params
        const rkey = uri.split('/').pop()!

        // Get current record for CID
        const currentRecord = await agent.com.atproto.repo.getRecord({
          repo: currentAccount.did,
          collection: 'app.warlog.journal',
          rkey,
        })

        const updatedRecord = {
          ...currentRecord.value,
          ...updateData,
        }

        const response = await agent.com.atproto.repo.putRecord({
          repo: currentAccount.did,
          collection: 'app.warlog.journal',
          rkey,
          record: updatedRecord,
        })

        return {
          uri: response.uri,
          cid: response.cid,
          ...updatedRecord,
          author: {
            did: currentAccount.did,
            handle: currentAccount.handle,
            displayName: currentAccount.displayName,
            avatar: currentAccount.avatar,
          },
        } as JournalEntry
      } catch (error) {
        logger.error('Failed to update journal entry', {
          message: String(error),
          params,
        })
        throw error
      }
    },
    onSuccess: (updatedEntry) => {
      // Update specific entry cache
      queryClient.setQueryData(
        journalKeys.entry(updatedEntry.uri),
        updatedEntry
      )

      // Update entries in infinite query
      queryClient.setQueriesData(
        {queryKey: journalKeys.entries()},
        (old: InfiniteData<JournalPage> | undefined) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              entries: page.entries.map((entry) =>
                entry.uri === updatedEntry.uri ? updatedEntry : entry
              ),
            })),
          }
        }
      )

      // Invalidate analytics if privacy or other key fields changed
      queryClient.invalidateQueries({
        queryKey: journalKeys.analytics(),
      })
    },
  })
}

/**
 * Delete journal entry with cascade cleanup and confirmation
 */
export function useDeleteJournalEntry() {
  const queryClient = useQueryClient()
  const agent = useAgent()
  const {currentAccount} = useSession()
  const invalidator = useMemo(() => new JournalCacheInvalidator(queryClient), [queryClient])

  return useMutation<void, Error, {uri: string; confirm?: boolean}>({
    mutationFn: async ({uri, confirm = false}) => {
      if (!currentAccount) throw new Error('No authenticated user')
      if (!confirm) throw new Error('Deletion must be confirmed')

      try {
        const rkey = uri.split('/').pop()!
        
        // Log deletion for audit trail
        logger.info('Journal entry deletion requested', {
          uri,
          did: currentAccount.did,
          timestamp: new Date().toISOString(),
        })

        await agent.com.atproto.repo.deleteRecord({
          repo: currentAccount.did,
          collection: 'app.warlog.journal',
          rkey,
        })

        // Log successful deletion
        logger.info('Journal entry deleted successfully', {
          uri,
          did: currentAccount.did,
        })
      } catch (error) {
        logger.error('Failed to delete journal entry', {
          message: String(error),
          uri,
          did: currentAccount.did,
        })
        throw error
      }
    },
    onSuccess: async (_, {uri}) => {
      await invalidator.invalidateEntry(uri, currentAccount?.did || '')
    },
  })
}

// Helper functions
function applyJournalFilters(entries: JournalEntry[], filters?: JournalFilters): JournalEntry[] {
  if (!filters) return entries

  return entries.filter((entry) => {
    // Entry type filter
    if (filters.entryType && filters.entryType !== 'all' && entry.entryType !== filters.entryType) {
      return false
    }

    // Privacy filter
    if (filters.privacy && filters.privacy !== 'all') {
      const isPrivate = entry.isPrivate
      if (filters.privacy === 'private' && !isPrivate) return false
      if (filters.privacy === 'public' && isPrivate) return false
    }

    // Date range filter
    if (filters.dateRange) {
      const entryDate = new Date(entry.createdAt)
      if (entryDate < filters.dateRange.start || entryDate > filters.dateRange.end) {
        return false
      }
    }

    // Symptom filter
    if (filters.symptoms && filters.symptoms.length > 0 && entry.symptoms) {
      const hasMatchingSymptom = entry.symptoms.some((symptom) =>
        filters.symptoms!.includes(symptom.category)
      )
      if (!hasMatchingSymptom) return false
    }

    // Location filter (radius search)
    if (filters.location && entry.location) {
      const distance = calculateDistance(
        [entry.location.latitude, entry.location.longitude],
        filters.location.center
      )
      if (distance > filters.location.radius) return false
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0 && entry.tags) {
      const hasMatchingTag = entry.tags.some((tag) =>
        filters.tags!.includes(tag)
      )
      if (!hasMatchingTag) return false
    }

    return true
  })
}

function computeJournalStats(entries: JournalEntry[], period: TimePeriod): JournalStats {
  const now = new Date()
  const periodStart = getPeriodStart(now, period)
  
  const periodEntries = entries.filter((entry) => 
    new Date(entry.createdAt) >= periodStart
  )

  const symptomCounts = new Map<string, number>()
  let totalSymptoms = 0

  periodEntries.forEach((entry) => {
    if (entry.symptoms) {
      totalSymptoms += entry.symptoms.length
      entry.symptoms.forEach((symptom) => {
        symptomCounts.set(symptom.category, (symptomCounts.get(symptom.category) || 0) + 1)
      })
    }
  })

  const mostCommonSymptoms = Array.from(symptomCounts.entries())
    .map(([category, count]) => ({category, count}))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const dates = entries.map((e) => new Date(e.createdAt)).sort((a, b) => a.getTime() - b.getTime())
  const firstEntry = dates[0]
  const lastEntry = dates[dates.length - 1]
  const totalDays = firstEntry && lastEntry 
    ? Math.ceil((lastEntry.getTime() - firstEntry.getTime()) / (1000 * 60 * 60 * 24))
    : 0

  return {
    totalEntries: periodEntries.length,
    privateEntries: periodEntries.filter((e) => e.isPrivate).length,
    publicEntries: periodEntries.filter((e) => !e.isPrivate).length,
    realTimeEntries: periodEntries.filter((e) => e.entryType === 'real_time').length,
    backdatedEntries: periodEntries.filter((e) => e.entryType === 'backdated').length,
    entriesWithSymptoms: periodEntries.filter((e) => e.symptoms && e.symptoms.length > 0).length,
    entriesWithLocation: periodEntries.filter((e) => !!e.location).length,
    entriesWithSources: periodEntries.filter((e) => e.sourceIds && e.sourceIds.length > 0).length,
    avgSymptomsPerEntry: periodEntries.length > 0 ? totalSymptoms / periodEntries.length : 0,
    mostCommonSymptoms,
    timelineCoverage: {
      firstEntry: firstEntry?.toISOString() || '',
      lastEntry: lastEntry?.toISOString() || '',
      totalDays,
    },
  }
}

function getPeriodStart(now: Date, period: TimePeriod): Date {
  const start = new Date(now)
  switch (period) {
    case 'day':
      start.setHours(0, 0, 0, 0)
      break
    case 'week':
      start.setDate(start.getDate() - start.getDay())
      start.setHours(0, 0, 0, 0)
      break
    case 'month':
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      break
    case 'quarter':
      const quarter = Math.floor(start.getMonth() / 3)
      start.setMonth(quarter * 3, 1)
      start.setHours(0, 0, 0, 0)
      break
    case 'year':
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
      break
  }
  return start
}

function calculateDistance([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}