/**
 * Journal Feed Hooks with Privacy-Aware Infinite Scroll
 * 
 * Provides privacy-controlled access to journal feeds with:
 * - Infinite scroll pagination
 * - Privacy-level filtering
 * - Badge-based community access
 * - Real-time updates
 * - Background refetching
 * - Optimized caching strategies
 */

import {useCallback, useMemo} from 'react'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  InfiniteData,
} from '@tanstack/react-query'
import {useAgent, useSession} from '#/state/session'
import {STALE} from '#/state/queries'
import {logger} from '#/logger'
import {JOURNAL_API_CONFIG} from '#/env'

import type {
  JournalEntryView,
  JournalFeedPage,
  JournalFeedFilters,
  JournalFeedType,
  JournalSortOrder,
  JournalSearchParams,
  JournalSearchResult,
  JournalError,
  JournalErrorType,
} from './types'
import {
  JOURNAL_QUERY_KEYS,
  JOURNAL_STALE_TIME,
  JOURNAL_GC_TIME,
  JOURNAL_RETRY_CONFIG,
} from './constants'

import {
  PrivacyAccessControlManager,
  SecurityContext,
  PrivacyLevel,
} from '#/../../NPWA-atproto/packages/pds/src/journal-security'

// Initialize access manager
const accessManager = new PrivacyAccessControlManager()

/**
 * Create security context from session
 */
function createSecurityContext(currentAccount: any): SecurityContext {
  return {
    userDid: currentAccount?.did || '',
    sessionId: currentAccount?.accessJwt || crypto.randomUUID(),
    ipAddress: 'unknown',
    userAgent: 'TISocial-App',
    authLevel: 'basic',
    permissions: currentAccount?.permissions || [],
  }
}

/**
 * Enhanced error creation for feed operations
 */
function createFeedError(
  type: JournalErrorType,
  message: string,
  error?: any,
): JournalError {
  const feedError = new Error(message) as JournalError
  feedError.type = type
  feedError.retryable = !['permission_denied', 'badge_verification_required'].includes(type)
  feedError.privacyRelated = ['permission_denied', 'privacy_violation', 'badge_verification_required'].includes(type)
  feedError.userMessage = getUserFriendlyFeedErrorMessage(type, message)
  feedError.details = error
  return feedError
}

function getUserFriendlyFeedErrorMessage(type: JournalErrorType, originalMessage: string): string {
  switch (type) {
    case 'permission_denied':
      return 'You do not have permission to view this content.'
    case 'badge_verification_required':
      return 'This content requires a verified community badge to access.'
    case 'privacy_violation':
      return 'This content is not available due to privacy restrictions.'
    case 'network_error':
      return 'Unable to load journal entries. Please check your connection.'
    case 'server_error':
      return 'Server error while loading entries. Please try again.'
    default:
      return originalMessage || 'Unable to load journal entries.'
  }
}

/**
 * Hook for infinite scroll journal feed with privacy filtering
 */
export function useJournalFeed(
  feedType: JournalFeedType = 'personal',
  filters?: JournalFeedFilters,
  options?: {
    enabled?: boolean
    sortBy?: JournalSortOrder
    limit?: number
  }
) {
  const agent = useAgent()
  const {currentAccount} = useSession()
  
  const queryKey = useMemo(() => 
    JOURNAL_QUERY_KEYS.feed(feedType, currentAccount?.did || '', filters, options?.sortBy),
    [feedType, currentAccount?.did, filters, options?.sortBy]
  )

  return useInfiniteQuery<JournalFeedPage, JournalError, InfiniteData<JournalFeedPage>, any, string | undefined>({
    queryKey,
    queryFn: async ({pageParam}): Promise<JournalFeedPage> => {
      if (!currentAccount) {
        throw createFeedError('permission_denied', 'Authentication required')
      }

      try {
        const securityContext = createSecurityContext(currentAccount)
        const limit = options?.limit || 20

        // Build query parameters based on feed type
        let queryParams: any = {
          limit,
          cursor: pageParam,
          sortBy: options?.sortBy || 'newest',
        }

        // Apply feed type specific logic
        switch (feedType) {
          case 'personal':
            queryParams.authorDid = currentAccount.did
            break
          case 'contacts':
            // TODO: Get following list from profile service
            queryParams.authorDids = [] // await getFollowingDids(currentAccount.did)
            break
          case 'community':
            // Filter by badge community access
            queryParams.requiresBadgeAccess = await getUserBadges(currentAccount.did)
            break
          case 'public':
            queryParams.privacyLevels = ['public']
            break
          case 'local':
            // TODO: Implement geolocation-based filtering
            if (filters?.location) {
              queryParams.location = filters.location
            }
            break
          case 'trending':
            queryParams.sortBy = 'engagement'
            queryParams.minEngagement = 5 // Minimum engagement threshold
            break
        }

        // Apply additional filters
        if (filters) {
          queryParams = {...queryParams, ...filters}
        }

        // Fetch from AT Protocol using XRPC journal endpoints
        const response = await agent.call(
          JOURNAL_API_CONFIG.JOURNAL_ENDPOINTS.QUERY_FEED,
          'get',
          {
            feedType,
            ...queryParams,
          }
        )

        // Convert AT Protocol records to entries
        let entries: JournalEntryView[] = response.data.records.map((record: any) => ({
          id: record.uri.split('/').pop(),
          uri: record.uri,
          cid: record.cid,
          author: {
            did: record.value.author?.did || currentAccount.did,
            handle: record.value.author?.handle || currentAccount.handle,
            displayName: record.value.author?.displayName || currentAccount.displayName,
            avatar: record.value.author?.avatar,
          },
          text: record.value.text,
          title: record.value.title,
          entryType: record.value.entryType,
          createdAt: record.value.createdAt,
          incidentTimestamp: record.value.incidentTimestamp,
          privacyLevel: record.value.privacyLevel,
          symptomCount: record.value.symptoms?.count || 0,
          evidenceCount: record.value.evidenceUris?.length || 0,
          sourceCount: record.value.sourceIds?.length || 0,
          tags: record.value.tags || [],
          engagement: {
            commentCount: record.value.commentCount || 0,
            shareCount: record.value.shareCount || 0,
            supportReactionCount: record.value.supportReactionCount || 0,
          },
          viewer: {
            canView: true,
            canComment: record.value.allowComments !== false,
            hasAccess: true,
          },
          locationPreview: record.value.location?.address,
          triggerWarnings: record.value.triggerWarnings,
        }))

        // Apply privacy filtering (entries should already be filtered by backend)
        entries = await filterEntriesByPrivacy(entries, securityContext)

        // Apply client-side filtering for complex filters
        entries = applyClientSideFilters(entries, filters)

        // Sort entries if needed
        entries = sortEntries(entries, options?.sortBy || 'newest')

        return {
          entries,
          cursor: response.data.cursor,
          hasMore: response.data.hasMore || (!!response.data.cursor && entries.length >= limit),
          totalCount: response.data.totalCount || entries.length,
        }

      } catch (error: any) {
        logger.error('Failed to fetch journal feed', {
          feedType,
          error: error.message,
          userDid: currentAccount.did,
        })

        if (error.type) {
          throw error // Already a JournalError
        }

        if (error.message?.includes('permission') || error.message?.includes('access')) {
          throw createFeedError('permission_denied', error.message, error)
        }

        throw createFeedError('server_error', error.message, error)
      }
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.cursor,
    enabled: (options?.enabled !== false) && !!currentAccount,
    staleTime: JOURNAL_STALE_TIME.FEED,
    gcTime: JOURNAL_GC_TIME.FEED,
    refetchOnWindowFocus: feedType === 'trending', // Only trending feed refetches on focus
    refetchInterval: feedType === 'trending' ? STALE.MINUTES.FIVE : undefined,
    ...JOURNAL_RETRY_CONFIG.DEFAULT,
  })
}

/**
 * Hook for searching journal entries with privacy filtering
 */
export function useJournalSearch(searchParams: JournalSearchParams) {
  const agent = useAgent()
  const {currentAccount} = useSession()

  const queryKey = useMemo(() => 
    JOURNAL_QUERY_KEYS.search(currentAccount?.did || '', searchParams),
    [currentAccount?.did, searchParams]
  )

  return useQuery<JournalSearchResult, JournalError>({
    queryKey,
    queryFn: async (): Promise<JournalSearchResult> => {
      if (!currentAccount) {
        throw createFeedError('permission_denied', 'Authentication required for search')
      }

      if (!searchParams.query?.trim()) {
        return {
          entries: [],
          totalCount: 0,
          hasMore: false,
        }
      }

      try {
        const securityContext = createSecurityContext(currentAccount)
        
        // Build search query
        const searchQuery = {
          query: searchParams.query,
          limit: searchParams.limit || 20,
          cursor: searchParams.cursor,
          filters: searchParams.filters,
          sortBy: searchParams.sortBy || 'relevance',
        }

        // Use dedicated search endpoint
        const response = await agent.call(
          JOURNAL_API_CONFIG.JOURNAL_ENDPOINTS.SEARCH_ENTRIES,
          'get',
          searchQuery
        )

        // Convert to entries and apply search filtering
        let entries: JournalEntryView[] = response.data.records
          .map(convertRecordToEntryView)
          .filter(entry => 
            entry.text.toLowerCase().includes(searchParams.query!.toLowerCase()) ||
            entry.title?.toLowerCase().includes(searchParams.query!.toLowerCase()) ||
            entry.tags.some(tag => tag.toLowerCase().includes(searchParams.query!.toLowerCase()))
          )

        // Apply privacy filtering
        entries = await filterEntriesByPrivacy(entries, securityContext)

        // Apply additional filters
        if (searchParams.filters) {
          entries = applyClientSideFilters(entries, searchParams.filters)
        }

        // Sort results
        entries = sortEntries(entries, searchParams.sortBy || 'relevance')

        // Paginate results
        const startIndex = searchParams.cursor ? parseInt(searchParams.cursor) : 0
        const limit = searchParams.limit || 20
        const paginatedEntries = entries.slice(startIndex, startIndex + limit)

        return {
          entries: paginatedEntries,
          totalCount: entries.length,
          cursor: (startIndex + limit < entries.length) ? String(startIndex + limit) : undefined,
          hasMore: startIndex + limit < entries.length,
          facets: generateSearchFacets(entries),
        }

      } catch (error: any) {
        logger.error('Failed to search journal entries', {
          query: searchParams.query,
          error: error.message,
          userDid: currentAccount.did,
        })

        throw createFeedError('server_error', error.message, error)
      }
    },
    enabled: !!searchParams.query?.trim() && !!currentAccount,
    staleTime: STALE.MINUTES.THREE,
    gcTime: JOURNAL_GC_TIME.SEARCH,
    ...JOURNAL_RETRY_CONFIG.DEFAULT,
  })
}

/**
 * Hook for getting recent journal activity
 */
export function useJournalActivity(timeframe: 'day' | 'week' | 'month' = 'week') {
  const {currentAccount} = useSession()

  return useQuery({
    queryKey: JOURNAL_QUERY_KEYS.activity(currentAccount?.did || '', timeframe),
    queryFn: async () => {
      if (!currentAccount) {
        throw createFeedError('permission_denied', 'Authentication required')
      }

      // TODO: Implement activity aggregation
      return {
        newEntries: 0,
        newComments: 0,
        newShares: 0,
        trendingTopics: [],
      }
    },
    enabled: !!currentAccount,
    staleTime: STALE.MINUTES.FIVE,
    refetchInterval: STALE.MINUTES.FIVE,
  })
}

/**
 * Hook for prefetching next page of feed
 */
export function usePrefetchNextFeedPage() {
  const queryClient = useQueryClient()

  return useCallback((
    feedType: JournalFeedType,
    currentCursor?: string,
    filters?: JournalFeedFilters
  ) => {
    if (!currentCursor) return

    const {currentAccount} = useSession()
    if (!currentAccount) return

    const queryKey = JOURNAL_QUERY_KEYS.feed(feedType, currentAccount.did, filters)
    
    queryClient.prefetchInfiniteQuery({
      queryKey,
      initialPageParam: currentCursor,
    })
  }, [queryClient])
}

// Helper functions

async function filterEntriesByPrivacy(
  entries: JournalEntryView[],
  securityContext: SecurityContext
): Promise<JournalEntryView[]> {
  const filteredEntries: JournalEntryView[] = []

  for (const entry of entries) {
    try {
      // Create mock secure entry for access check
      const secureEntry = {
        uri: entry.uri,
        author: entry.author,
        privacyLevel: mapClientPrivacyToSecurity(entry.privacyLevel),
        classification: 'unclassified', // Would be determined from actual entry
        accessControlList: [],
      }

      const accessCheck = await accessManager.checkAccess(secureEntry as any, securityContext)
      
      if (accessCheck.hasAccess) {
        filteredEntries.push({
          ...entry,
          viewer: {
            ...entry.viewer,
            hasAccess: true,
          },
        })
      }
    } catch (error) {
      // If access check fails, exclude the entry
      logger.debug('Entry filtered due to privacy check', {
        entryId: entry.id,
        error,
      })
    }
  }

  return filteredEntries
}

function mapClientPrivacyToSecurity(privacy: any): PrivacyLevel {
  switch (privacy) {
    case 'public': return PrivacyLevel.PUBLIC
    case 'contacts': return PrivacyLevel.PRIVATE
    case 'badge_community': return PrivacyLevel.COMMUNITY
    case 'private': return PrivacyLevel.PRIVATE
    case 'anonymous': return PrivacyLevel.ANONYMOUS
    default: return PrivacyLevel.PRIVATE
  }
}

function applyClientSideFilters(
  entries: JournalEntryView[],
  filters?: JournalFeedFilters
): JournalEntryView[] {
  if (!filters) return entries

  return entries.filter(entry => {
    // Privacy level filter
    if (filters.privacyLevels && !filters.privacyLevels.includes(entry.privacyLevel)) {
      return false
    }

    // Date range filter
    if (filters.dateRange) {
      const entryDate = new Date(entry.createdAt)
      const startDate = new Date(filters.dateRange.start)
      const endDate = new Date(filters.dateRange.end)
      if (entryDate < startDate || entryDate > endDate) {
        return false
      }
    }

    // Tag filter
    if (filters.tags && filters.tags.length > 0) {
      const hasMatchingTag = entry.tags.some(tag => filters.tags!.includes(tag))
      if (!hasMatchingTag) return false
    }

    // Evidence filter
    if (filters.hasEvidence !== undefined) {
      if (filters.hasEvidence && entry.evidenceCount === 0) return false
      if (!filters.hasEvidence && entry.evidenceCount > 0) return false
    }

    // Sources filter
    if (filters.hasSources !== undefined) {
      if (filters.hasSources && entry.sourceCount === 0) return false
      if (!filters.hasSources && entry.sourceCount > 0) return false
    }

    return true
  })
}

function sortEntries(entries: JournalEntryView[], sortBy: JournalSortOrder): JournalEntryView[] {
  return [...entries].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'incident_time':
        const aTime = new Date(a.incidentTimestamp || a.createdAt).getTime()
        const bTime = new Date(b.incidentTimestamp || b.createdAt).getTime()
        return bTime - aTime
      case 'engagement':
        const aEngagement = a.engagement.commentCount + a.engagement.shareCount + a.engagement.supportReactionCount
        const bEngagement = b.engagement.commentCount + b.engagement.shareCount + b.engagement.supportReactionCount
        return bEngagement - aEngagement
      case 'relevance':
      default:
        // For relevance, keep original order from search API
        return 0
    }
  })
}

function convertRecordToEntryView(record: any): JournalEntryView {
  return {
    id: record.uri.split('/').pop(),
    uri: record.uri,
    cid: record.cid,
    author: record.value.author || {
      did: 'unknown',
      handle: 'unknown',
      displayName: 'Unknown User',
    },
    text: record.value.text,
    title: record.value.title,
    entryType: record.value.entryType,
    createdAt: record.value.createdAt,
    incidentTimestamp: record.value.incidentTimestamp,
    privacyLevel: record.value.privacyLevel,
    symptomCount: record.value.symptoms?.count || 0,
    evidenceCount: record.value.evidenceUris?.length || 0,
    sourceCount: record.value.sourceIds?.length || 0,
    tags: record.value.tags || [],
    engagement: {
      commentCount: record.value.commentCount || 0,
      shareCount: record.value.shareCount || 0,
      supportReactionCount: record.value.supportReactionCount || 0,
    },
    viewer: {
      canView: true,
      canComment: record.value.allowComments !== false,
      hasAccess: true,
    },
    locationPreview: record.value.location?.address,
    triggerWarnings: record.value.triggerWarnings,
  }
}

function generateSearchFacets(entries: JournalEntryView[]) {
  const symptomCounts = new Map<string, number>()
  const locationCounts = new Map<string, number>()
  const dateCounts = new Map<string, number>()

  entries.forEach(entry => {
    // TODO: Extract symptom categories from entry data
    // For now, using placeholder logic
    
    // Location facets
    if (entry.locationPreview) {
      const key = entry.locationPreview
      locationCounts.set(key, (locationCounts.get(key) || 0) + 1)
    }

    // Date range facets
    const date = new Date(entry.createdAt)
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`
    dateCounts.set(monthKey, (dateCounts.get(monthKey) || 0) + 1)
  })

  return {
    symptomCategories: [], // TODO: Implement symptom facets
    locations: Array.from(locationCounts.entries()).map(([location, count]) => {
      const [city, state] = location.split(', ')
      return {city: city || location, state: state || '', count}
    }),
    dateRanges: Array.from(dateCounts.entries()).map(([range, count]) => ({range, count})),
  }
}

async function getUserBadges(userDid: string): Promise<string[]> {
  // TODO: Implement badge fetching from profile service
  return []
}