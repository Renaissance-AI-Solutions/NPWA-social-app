/**
 * TISocial Journal State Management - Complete Export Index
 * 
 * This module provides comprehensive React Query-based state management for the
 * TISocial journaling system with integrated security, privacy controls, and
 * HIPAA compliance.
 * 
 * Features:
 * - Privacy-aware CRUD operations with encryption
 * - Infinite scroll feeds with badge-based access control
 * - Real-time search with privacy filtering
 * - Comprehensive analytics with data protection
 * - HIPAA-compliant data handling
 * - Performance monitoring and optimization
 * - Export and backup functionality
 * 
 * Security Integration:
 * - Multi-tier privacy levels (PUBLIC, COMMUNITY, PRIVATE, MEDICAL, LEGAL, ANONYMOUS)
 * - Badge-based community access control
 * - End-to-end encryption for sensitive data
 * - Audit logging for PHI access
 * - Rate limiting and suspicious activity monitoring
 */

// ===== CORE CRUD OPERATIONS =====

export {
  useJournalEntry,
  useJournalEntryByUri,
  useGetJournalEntry,
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useDeleteJournalEntry,
  useDuplicateJournalEntry,
} from './crud'

// ===== FEED AND SEARCH OPERATIONS =====

export {
  useJournalFeed,
  useJournalSearch,
  useJournalActivity,
  usePrefetchNextFeedPage,
} from './feeds'

// ===== PRIVACY AND PERMISSION MANAGEMENT =====

export {
  useJournalPrivacySettings,
  useUpdatePrivacySettings,
  useJournalPermissions,
  useUserBadges,
  useRequestEntryAccess,
  useAccessRequests,
  useRespondToAccessRequest,
  useValidateHIPAACompliance,
} from './privacy'

// ===== ANALYTICS AND INSIGHTS =====

export {
  useJournalAnalytics,
  useJournalInsights,
  useJournalTrends,
  useExportJournalData,
  useExportStatus,
  usePerformanceMetrics,
} from './analytics'

// ===== TYPES AND INTERFACES =====

export type {
  // Core entry types
  JournalEntry,
  JournalEntryView,
  JournalComment,
  OptimisticJournalEntry,
  OptimisticJournalComment,
  
  // Entry components
  JournalLocation,
  JournalSymptom,
  JournalEvidence,
  JournalSource,
  SymptomCategory,
  JournalEntryType,
  
  // Privacy and access
  JournalPrivacyLevel,
  BadgeType,
  JournalNotificationType,
  JournalNotification,
  
  // Feed and search
  JournalFeedType,
  JournalFeedFilters,
  JournalSortOrder,
  JournalSearchParams,
  JournalSearchResult,
  JournalFeedPage,
  
  // Analytics
  JournalAnalytics,
  
  // Export and backup
  JournalExportRequest,
  JournalBackupMetadata,
  
  // Error handling
  JournalError,
  JournalErrorType,
  
  // Input types for mutations
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  DeleteJournalEntryInput,
} from './types'

// ===== CONSTANTS AND CONFIGURATION =====

export {
  JOURNAL_QUERY_KEYS,
  JOURNAL_STALE_TIME,
  JOURNAL_GC_TIME,
  JOURNAL_PAGE_SIZES,
  JOURNAL_RETRY_CONFIG,
  JOURNAL_REFETCH_INTERVALS,
  OPTIMISTIC_TIMEOUTS,
  JOURNAL_ERROR_MESSAGES,
  JOURNAL_FEATURES,
  HIPAA_SETTINGS,
  CACHE_INVALIDATION_PATTERNS,
  PERFORMANCE_THRESHOLDS,
  SECURITY_THRESHOLDS,
  ANALYTICS_PERIODS,
  EXPORT_FORMATS,
  PRIVACY_ACCESS_MATRIX,
  SECURITY_QUERY_KEYS,
} from './constants'

// ===== UTILITY FUNCTIONS =====

export {
  createJournalError,
  validateJournalEntry,
  generateOptimisticEntry,
} from './utils'

// ===== CACHE MANAGEMENT =====

export {
  JournalQueryCache,
  JournalCacheInvalidator,
  JournalCachePersistence,
} from './cache'

// ===== ENHANCED TYPES FOR PRIVACY MANAGEMENT =====

export type {
  JournalPrivacySettings,
  PermissionCheckResult,
  AccessRequest,
} from './privacy'

// ===== ENHANCED TYPES FOR ANALYTICS =====

export type {
  EnhancedJournalAnalytics,
  ExportStatus,
} from './analytics'

// ===== HOOK CATEGORIES FOR ORGANIZED IMPORTS =====

/**
 * Core journal entry management hooks
 * 
 * These hooks provide basic CRUD operations for journal entries with
 * security validation and optimistic updates.
 */
export const JournalCrudHooks = {
  useJournalEntry,
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useDeleteJournalEntry,
  useDuplicateJournalEntry,
} as const

/**
 * Feed and discovery hooks
 * 
 * These hooks provide access to various journal feeds with privacy
 * filtering and infinite scroll pagination.
 */
export const JournalFeedHooks = {
  useJournalFeed,
  useJournalSearch,
  useJournalActivity,
  usePrefetchNextFeedPage,
} as const

/**
 * Privacy and security management hooks
 * 
 * These hooks manage privacy settings, access control, and HIPAA
 * compliance features.
 */
export const JournalPrivacyHooks = {
  useJournalPrivacySettings,
  useUpdatePrivacySettings,
  useJournalPermissions,
  useUserBadges,
  useRequestEntryAccess,
  useAccessRequests,
  useRespondToAccessRequest,
  useValidateHIPAACompliance,
} as const

/**
 * Analytics and insights hooks
 * 
 * These hooks provide data analysis, trends, and export functionality
 * with privacy protection.
 */
export const JournalAnalyticsHooks = {
  useJournalAnalytics,
  useJournalInsights,
  useJournalTrends,
  useExportJournalData,
  useExportStatus,
  usePerformanceMetrics,
} as const

// ===== INTEGRATION HELPERS =====

/**
 * Helper function to initialize journal state management
 * 
 * @param queryClient - React Query client instance
 * @param options - Configuration options
 */
export function initializeJournalState(queryClient: any, options?: {
  enableOfflineSync?: boolean
  enableRealTimeUpdates?: boolean
  enableAnalytics?: boolean
  privacyLevel?: 'basic' | 'enhanced' | 'hipaa'
}) {
  // Initialize cache with journal-specific configurations
  const cacheInvalidator = new JournalCacheInvalidator(queryClient)
  
  // Set up performance monitoring
  if (options?.enableAnalytics) {
    // TODO: Initialize performance monitoring
  }
  
  // Configure privacy settings
  const privacyConfig = {
    enableEncryption: options?.privacyLevel === 'hipaa',
    enableAuditLogging: options?.privacyLevel !== 'basic',
    enableAccessControl: true,
  }
  
  return {
    cacheInvalidator,
    privacyConfig,
    isInitialized: true,
  }
}

/**
 * Helper function to check if journal features are available
 */
export function getJournalFeatureAvailability() {
  return {
    crud: true,
    feeds: true,
    search: true,
    privacy: true,
    analytics: JOURNAL_FEATURES.ADVANCED_ANALYTICS,
    export: JOURNAL_FEATURES.EXPORT_FUNCTIONALITY,
    encryption: JOURNAL_FEATURES.EVIDENCE_ENCRYPTION,
    hipaaCompliance: JOURNAL_FEATURES.HIPAA_COMPLIANCE,
    realTimeUpdates: JOURNAL_FEATURES.REAL_TIME_UPDATES,
    communityFeeds: JOURNAL_FEATURES.COMMUNITY_FEEDS,
    anonymousPosting: JOURNAL_FEATURES.ANONYMOUS_POSTING,
  }
}

/**
 * Hook to get journal system status and health
 */
export function useJournalSystemStatus() {
  return useQuery({
    queryKey: ['journal-system-status'],
    queryFn: async () => {
      const features = getJournalFeatureAvailability()
      const performance = await import('./analytics').then(m => 
        m.usePerformanceMetrics().data
      )
      
      return {
        features,
        performance,
        status: 'healthy',
        lastCheck: new Date().toISOString(),
      }
    },
    staleTime: JOURNAL_STALE_TIME.ANALYTICS,
    refetchInterval: STALE.MINUTES.FIVE,
  })
}

// ===== DOCUMENTATION AND EXAMPLES =====

/**
 * Example usage patterns for common journal operations
 */
export const JournalExamples = {
  /**
   * Basic journal entry creation
   */
  createBasicEntry: `
    const createMutation = useCreateJournalEntry()
    
    const handleSubmit = async (data) => {
      try {
        await createMutation.mutateAsync({
          text: data.description,
          entryType: 'real_time',
          privacyLevel: 'private',
          symptoms: data.symptoms,
          location: data.location,
        })
      } catch (error) {
        console.error('Failed to create entry:', error.userMessage)
      }
    }
  `,
  
  /**
   * Privacy-aware feed loading
   */
  loadPersonalFeed: `
    const feedQuery = useJournalFeed('personal', {
      privacyLevels: ['private', 'contacts'],
      dateRange: {
        start: startOfMonth(new Date()).toISOString(),
        end: new Date().toISOString(),
      },
    })
    
    const {
      data,
      fetchNextPage,
      hasNextPage,
      isLoading,
      error,
    } = feedQuery
  `,
  
  /**
   * HIPAA-compliant medical entry
   */
  createMedicalEntry: `
    const validateCompliance = useValidateHIPAACompliance()
    const createMutation = useCreateJournalEntry()
    
    const handleMedicalEntry = async (data) => {
      // Validate HIPAA compliance first
      const compliance = await validateCompliance({
        ...data,
        isPHI: true,
      })
      
      if (!compliance.isCompliant) {
        alert('Entry requires additional privacy protection')
        return
      }
      
      await createMutation.mutateAsync({
        ...data,
        privacyLevel: 'private',
        isPHI: true,
        requiresBadgeAccess: ['medical'],
      })
    }
  `,
  
  /**
   * Analytics dashboard
   */
  analyticsView: `
    const analytics = useJournalAnalytics('MONTH', {
      includePredictions: true,
      includeCorrelations: true,
      privacyLevel: 'detailed',
    })
    
    const insights = useJournalInsights()
    const trends = useJournalTrends('WEEK', 'symptoms')
    
    if (analytics.isLoading) return <LoadingSpinner />
    
    return (
      <div>
        <QualityOfLifeScore score={analytics.data?.qualityOfLifeScore} />
        <SymptomTrends data={trends.data} />
        <RecentInsights insights={insights.data} />
      </div>
    )
  `,
}

/**
 * Performance optimization tips
 */
export const JournalOptimizationTips = {
  /**
   * Use prefetching for better UX
   */
  prefetching: `
    const prefetchNext = usePrefetchNextFeedPage()
    
    // Prefetch next page when user scrolls to 80%
    const handleScroll = useCallback((scrollPosition) => {
      if (scrollPosition > 0.8 && hasNextPage) {
        prefetchNext('personal', currentCursor)
      }
    }, [prefetchNext, hasNextPage, currentCursor])
  `,
  
  /**
   * Optimize cache usage
   */
  caching: `
    // Use specific query keys for better cache management
    const personalEntries = useJournalFeed('personal', filters)
    const communityEntries = useJournalFeed('community', filters)
    
    // Enable background refetching for active feeds only
    const activeTab = useActiveTab()
    const shouldRefetch = activeTab === 'journal'
  `,
  
  /**
   * Handle privacy efficiently
   */
  privacy: `
    // Check permissions before rendering
    const permissions = useJournalPermissions(entryId)
    
    if (!permissions.data?.hasAccess) {
      return <AccessDeniedMessage reason={permissions.data?.reason} />
    }
    
    return <JournalEntryView entry={entry} />
  `,
}

// Re-export commonly used hooks from other modules for convenience
export {useAgent, useSession} from '#/state/session'
export {logger} from '#/logger'
export {STALE} from '#/state/queries'