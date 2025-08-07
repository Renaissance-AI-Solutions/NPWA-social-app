import React, {useCallback, useMemo} from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query'
import {useAgent, useSession} from '#/state/session'
import {STALE} from '#/state/queries'
import {logger} from '#/logger'
import {journalKeys, JournalFilters, PrivacyLevel, TimePeriod, FeedType, FeedParams} from './journal-keys'
import {JournalCacheInvalidator} from './journal-cache'
import {
  JournalEntry,
  JournalPrivacySettings,
  JournalNotification,
  JournalExportData,
  JournalSyncStatus,
  JournalSearchParams,
  JournalShareParams,
  JournalStats,
} from './journal'

// Infinite query page structure
interface JournalPage {
  entries: JournalEntry[]
  cursor?: string
  hasMore: boolean
}

/**
 * Search journal entries with advanced filtering and ranking
 */
export function useJournalSearch(params: JournalSearchParams, enabled: boolean = true) {
  const {currentAccount} = useSession()
  const agent = useAgent()
  const debouncedQuery = useDebounce(params.query, 300)

  return useQuery<JournalEntry[], Error>({
    queryKey: journalKeys.entrySearch(currentAccount?.did || '', debouncedQuery),
    queryFn: async () => {
      if (!currentAccount || debouncedQuery.length < 2) return []

      try {
        // Fetch all entries first (could be optimized with server-side search)
        const response = await agent.com.atproto.repo.listRecords({
          repo: currentAccount.did,
          collection: 'app.warlog.journal',
          limit: 1000,
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

        // Apply text search and filtering
        const searchResults = searchJournalEntries(entries, debouncedQuery, params)
        return searchResults
      } catch (error) {
        logger.error('Failed to search journal entries', {
          message: String(error),
          query: debouncedQuery,
        })
        throw error
      }
    },
    staleTime: STALE.MINUTES.TWO,
    enabled: enabled && !!currentAccount && debouncedQuery.length >= 2,
  })
}

/**
 * Manage journal privacy settings
 */
export function useJournalPrivacySettings() {
  const {currentAccount} = useSession()
  const agent = useAgent()
  const queryClient = useQueryClient()

  const query = useQuery<JournalPrivacySettings, Error>({
    queryKey: journalKeys.privacySettings(currentAccount?.did || ''),
    queryFn: async () => {
      if (!currentAccount) throw new Error('No authenticated user')

      try {
        // Check if privacy settings record exists
        const response = await agent.com.atproto.repo.getRecord({
          repo: currentAccount.did,
          collection: 'app.warlog.journal.privacy',
          rkey: 'settings',
        })

        return response.value as JournalPrivacySettings
      } catch (error) {
        // Return default settings if none exist
        return {
          defaultPrivacy: 'private',
          allowPublicSymptoms: false,
          allowPublicLocation: false,
          shareWithCommunity: false,
          enableAnalytics: true,
        }
      }
    },
    staleTime: STALE.MINUTES.TEN,
    enabled: !!currentAccount,
  })

  const mutation = useMutation<JournalPrivacySettings, Error, Partial<JournalPrivacySettings>>({
    mutationFn: async (updates) => {
      if (!currentAccount) throw new Error('No authenticated user')

      const currentSettings = query.data || {
        defaultPrivacy: 'private' as PrivacyLevel,
        allowPublicSymptoms: false,
        allowPublicLocation: false,
        shareWithCommunity: false,
        enableAnalytics: true,
      }

      const newSettings = { ...currentSettings, ...updates }

      try {
        await agent.com.atproto.repo.putRecord({
          repo: currentAccount.did,
          collection: 'app.warlog.journal.privacy',
          rkey: 'settings',
          record: {
            $type: 'app.warlog.journal.privacy',
            ...newSettings,
            updatedAt: new Date().toISOString(),
          },
        })

        logger.info('Privacy settings updated', {
          did: currentAccount.did,
          updates,
        })

        return newSettings
      } catch (error) {
        logger.error('Failed to update privacy settings', {
          message: String(error),
          updates,
        })
        throw error
      }
    },
    onSuccess: (newSettings) => {
      queryClient.setQueryData(
        journalKeys.privacySettings(currentAccount?.did || ''),
        newSettings
      )

      // Invalidate entries if privacy defaults changed
      if (query.data?.defaultPrivacy !== newSettings.defaultPrivacy) {
        queryClient.invalidateQueries({
          queryKey: journalKeys.entries(),
        })
      }
    },
  })

  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateSettings: mutation.mutate,
    isUpdating: mutation.isPending,
    updateError: mutation.error,
  }
}

/**
 * Share journal entries with specific privacy controls
 */
export function useJournalSharing() {
  const {currentAccount} = useSession()
  const agent = useAgent()
  const queryClient = useQueryClient()

  return useMutation<void, Error, JournalShareParams>({
    mutationFn: async (params) => {
      if (!currentAccount) throw new Error('No authenticated user')

      try {
        // Create sharing record
        const shareRecord = {
          $type: 'app.warlog.journal.share',
          entryUri: params.entryUri,
          shareWith: params.shareWith,
          recipients: params.recipients || [],
          includeSymptoms: params.includeSymptoms ?? true,
          includeLocation: params.includeLocation ?? false,
          expirationDate: params.expirationDate,
          createdAt: new Date().toISOString(),
        }

        await agent.com.atproto.repo.createRecord({
          repo: currentAccount.did,
          collection: 'app.warlog.journal.share',
          record: shareRecord,
        })

        logger.info('Journal entry shared', {
          entryUri: params.entryUri,
          shareWith: params.shareWith,
          recipients: params.recipients?.length || 0,
        })
      } catch (error) {
        logger.error('Failed to share journal entry', {
          message: String(error),
          params,
        })
        throw error
      }
    },
    onSuccess: (_, params) => {
      // Invalidate sharing-related queries
      queryClient.invalidateQueries({
        queryKey: journalKeys.sharing(currentAccount?.did || ''),
      })
    },
  })
}

/**
 * Validate journal permissions for specific operations
 */
export function useJournalPermissions(resource?: string) {
  const {currentAccount} = useSession()

  return useQuery<{canRead: boolean; canWrite: boolean; canDelete: boolean; canShare: boolean}, Error>({
    queryKey: journalKeys.permissions(currentAccount?.did || '', resource),
    queryFn: async () => {
      if (!currentAccount) {
        return {
          canRead: false,
          canWrite: false,
          canDelete: false,
          canShare: false,
        }
      }

      // In a real implementation, this would check against the access control matrix
      // For now, return full permissions for authenticated users
      return {
        canRead: true,
        canWrite: true,
        canDelete: true,
        canShare: true,
      }
    },
    staleTime: STALE.MINUTES.FIVE,
    enabled: !!currentAccount,
  })
}

/**
 * Export journal data with privacy filtering
 */
export function useJournalExport() {
  const {currentAccount} = useSession()
  const agent = useAgent()

  return useMutation<JournalExportData, Error, {privacy: PrivacyLevel; dateRange?: {start: Date; end: Date}}>({
    mutationFn: async ({privacy, dateRange}) => {
      if (!currentAccount) throw new Error('No authenticated user')

      try {
        // Fetch entries with privacy filtering
        const response = await agent.com.atproto.repo.listRecords({
          repo: currentAccount.did,
          collection: 'app.warlog.journal',
          limit: 1000,
        })

        let entries = response.data.records.map((record: any) => ({
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

        // Apply privacy filtering
        entries = entries.filter(entry => {
          if (privacy === 'public' && entry.isPrivate) return false
          if (privacy === 'private' && !entry.isPrivate) return false
          return true
        })

        // Apply date range filtering
        if (dateRange) {
          entries = entries.filter(entry => {
            const entryDate = new Date(entry.createdAt)
            return entryDate >= dateRange.start && entryDate <= dateRange.end
          })
        }

        // Compute analytics for export
        const stats = computeJournalStats(entries, 'year')

        const exportData: JournalExportData = {
          metadata: {
            exportedAt: new Date().toISOString(),
            totalEntries: entries.length,
            dateRange: {
              start: dateRange?.start.toISOString() || entries[0]?.createdAt || '',
              end: dateRange?.end.toISOString() || entries[entries.length - 1]?.createdAt || '',
            },
            privacyLevel: privacy,
          },
          entries,
          analytics: stats,
        }

        logger.info('Journal export completed', {
          entriesCount: entries.length,
          privacy,
          dateRange,
        })

        return exportData
      } catch (error) {
        logger.error('Failed to export journal data', {
          message: String(error),
          privacy,
          dateRange,
        })
        throw error
      }
    },
  })
}

/**
 * Manage journal sync status and offline operations
 */
export function useJournalSync() {
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()

  const syncStatus = useQuery<JournalSyncStatus, Error>({
    queryKey: journalKeys.syncStatus(currentAccount?.did || ''),
    queryFn: async () => {
      // This would integrate with your offline sync system
      // For now, return mock status
      return {
        lastSync: new Date().toISOString(),
        pendingChanges: 0,
        conflicts: 0,
        isOnline: navigator.onLine,
        isSyncing: false,
      }
    },
    staleTime: STALE.SECONDS.THIRTY,
    refetchInterval: 30000, // Check sync status every 30 seconds
    enabled: !!currentAccount,
  })

  const forceSync = useMutation<void, Error, void>({
    mutationFn: async () => {
      // Trigger manual sync
      logger.info('Manual sync triggered')
      // Implementation would depend on your sync strategy
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: journalKeys.syncStatus(currentAccount?.did || ''),
      })
    },
  })

  return {
    status: syncStatus.data,
    isLoading: syncStatus.isLoading,
    error: syncStatus.error,
    forceSync: forceSync.mutate,
    isSyncing: forceSync.isPending,
  }
}

/**
 * Journal notifications management
 */
export function useJournalNotifications() {
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()

  const notifications = useQuery<JournalNotification[], Error>({
    queryKey: journalKeys.notifications(currentAccount?.did || ''),
    queryFn: async () => {
      // Mock notifications - in production, fetch from backend
      return [] as JournalNotification[]
    },
    staleTime: STALE.MINUTES.ONE,
    enabled: !!currentAccount,
  })

  const markAsRead = useMutation<void, Error, string>({
    mutationFn: async (notificationId) => {
      // Mark notification as read
      logger.info('Marking notification as read', {notificationId})
    },
    onSuccess: (_, notificationId) => {
      queryClient.setQueryData(
        journalKeys.notifications(currentAccount?.did || ''),
        (old: JournalNotification[] | undefined) => {
          if (!old) return old
          return old.map(notif => 
            notif.id === notificationId ? {...notif, read: true} : notif
          )
        }
      )
    },
  })

  return {
    notifications: notifications.data || [],
    isLoading: notifications.isLoading,
    error: notifications.error,
    markAsRead: markAsRead.mutate,
    unreadCount: notifications.data?.filter(n => !n.read).length || 0,
  }
}

/**
 * Journal backup management
 */
export function useJournalBackup() {
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()

  const backupStatus = useQuery<{lastBackup: string; isBackupEnabled: boolean; nextBackup: string}, Error>({
    queryKey: journalKeys.backupStatus(currentAccount?.did || ''),
    queryFn: async () => {
      // Mock backup status - in production, fetch from backend
      return {
        lastBackup: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        isBackupEnabled: true,
        nextBackup: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }
    },
    staleTime: STALE.MINUTES.TEN,
    enabled: !!currentAccount,
  })

  const createBackup = useMutation<void, Error, {includePrivate: boolean}>({
    mutationFn: async ({includePrivate}) => {
      logger.info('Creating journal backup', {includePrivate})
      // Implementation would depend on your backup strategy
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: journalKeys.backupStatus(currentAccount?.did || ''),
      })
    },
  })

  return {
    status: backupStatus.data,
    isLoading: backupStatus.isLoading,
    error: backupStatus.error,
    createBackup: createBackup.mutate,
    isCreatingBackup: createBackup.isPending,
  }
}

/**
 * Enhanced journal feed with privacy-aware infinite scrolling
 */
export function useJournalFeed(
  feedType: FeedType = 'personal',
  params?: FeedParams,
  enabled: boolean = true
) {
  const {currentAccount} = useSession()
  const agent = useAgent()

  return useInfiniteQuery<JournalPage, Error>({
    queryKey: journalKeys.feed(currentAccount?.did || '', feedType, params),
    queryFn: async ({pageParam}) => {
      if (!currentAccount) throw new Error('No authenticated user')

      try {
        let entries: JournalEntry[] = []

        if (feedType === 'personal') {
          // Personal feed - user's own entries
          const response = await agent.com.atproto.repo.listRecords({
            repo: currentAccount.did,
            collection: 'app.warlog.journal',
            limit: params?.limit || 20,
            cursor: pageParam as string | undefined,
          })

          entries = response.data.records.map((record: any) => ({
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

          return {
            entries,
            cursor: response.data.cursor,
            hasMore: !!response.data.cursor,
          }
        } else if (feedType === 'public') {
          // Public feed - would query appview for public entries
          // This is a placeholder - actual implementation would depend on backend
          return {
            entries: [],
            hasMore: false,
          }
        } else if (feedType === 'community') {
          // Community feed - entries from followed users
          // This would require backend support for following relationships
          return {
            entries: [],
            hasMore: false,
          }
        }

        return {
          entries: [],
          hasMore: false,
        }
      } catch (error) {
        logger.error('Failed to fetch journal feed', {
          message: String(error),
          feedType,
          params,
        })
        throw error
      }
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.cursor,
    staleTime: STALE.MINUTES.TWO,
    enabled: enabled && !!currentAccount,
    // Background refetch for real-time updates
    refetchInterval: feedType === 'public' ? STALE.MINUTES.FIVE : undefined,
  })
}

// Helper functions
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value)

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

function searchJournalEntries(
  entries: JournalEntry[], 
  query: string, 
  params: JournalSearchParams
): JournalEntry[] {
  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 1)
  
  const scored = entries.map(entry => {
    let score = 0
    const searchableText = [
      entry.text,
      ...(entry.tags || []),
      ...(entry.symptoms?.map(s => s.category) || []),
    ].join(' ').toLowerCase()

    // Calculate relevance score
    searchTerms.forEach(term => {
      const termCount = (searchableText.match(new RegExp(term, 'g')) || []).length
      score += termCount
      
      // Boost score for exact matches in text
      if (entry.text.toLowerCase().includes(term)) {
        score += 2
      }
    })

    return {entry, score}
  })

  // Filter and sort results
  let results = scored
    .filter(({score}) => score > 0)
    .sort((a, b) => {
      if (params.sortBy === 'date') {
        return new Date(b.entry.createdAt).getTime() - new Date(a.entry.createdAt).getTime()
      }
      return b.score - a.score // Default to relevance
    })
    .map(({entry}) => entry)

  // Apply filters
  if (params.filters) {
    results = applyJournalFilters(results, params.filters)
  }

  return results
}

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