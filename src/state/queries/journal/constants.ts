import type {
  JournalFeedType,
  JournalFeedFilters,
  JournalSearchParams,
  JournalPrivacyLevel,
  BadgeType,
} from './types'

// Query key roots for consistent caching
export const JOURNAL_QUERY_KEYS = {
  // Root keys
  JOURNAL: 'journal',
  JOURNAL_ENTRY: 'journal-entry',
  JOURNAL_FEED: 'journal-feed', 
  JOURNAL_SEARCH: 'journal-search',
  JOURNAL_COMMENTS: 'journal-comments',
  JOURNAL_ANALYTICS: 'journal-analytics',
  JOURNAL_NOTIFICATIONS: 'journal-notifications',
  JOURNAL_PRIVACY: 'journal-privacy',
  JOURNAL_EXPORT: 'journal-export',
  
  // Specific query constructors
  entry: (id: string) => [JOURNAL_QUERY_KEYS.JOURNAL_ENTRY, id] as const,
  entryByUri: (uri: string) => [JOURNAL_QUERY_KEYS.JOURNAL_ENTRY, 'uri', uri] as const,
  
  feed: (type: JournalFeedType, filters?: JournalFeedFilters) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_FEED, type, filters] as const,
  
  personalFeed: (userId: string, filters?: JournalFeedFilters) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_FEED, 'personal', userId, filters] as const,
  
  communityFeed: (badgeType: BadgeType, filters?: JournalFeedFilters) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_FEED, 'community', badgeType, filters] as const,
  
  search: (userId: string, params: JournalSearchParams) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_SEARCH, userId, params] as const,
  
  comments: (entryId: string) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_COMMENTS, entryId] as const,
  
  analytics: (userId: string, period: string) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_ANALYTICS, userId, period] as const,
  
  notifications: (userId: string, type?: string) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_NOTIFICATIONS, userId, type] as const,
  
  privacySettings: (userId: string) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_PRIVACY, userId] as const,
  
  exportStatus: (requestId: string) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_EXPORT, requestId] as const,
  
  // Enhanced query keys for security integration
  permissions: (userId: string, resource?: string) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_PRIVACY, 'permissions', userId, resource] as const,
  
  userBadges: (userId: string) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_PRIVACY, 'badges', userId] as const,
  
  accessRequests: (userId: string) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_PRIVACY, 'access-requests', userId] as const,
  
  activity: (userId: string, timeframe: string) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_ANALYTICS, 'activity', userId, timeframe] as const,
  
  trends: (userId: string, period: string) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_ANALYTICS, 'trends', userId, period] as const,
  
  insights: (userId: string) => 
    [JOURNAL_QUERY_KEYS.JOURNAL_ANALYTICS, 'insights', userId] as const,
} as const

// Stale time constants (from existing pattern)
export const JOURNAL_STALE_TIME = {
  ENTRY: 5 * 60 * 1000,          // 5 minutes - entries change infrequently
  FEED: 2 * 60 * 1000,           // 2 minutes - feeds should be relatively fresh
  SEARCH: 5 * 60 * 1000,         // 5 minutes - search results can be cached longer
  COMMENTS: 1 * 60 * 1000,       // 1 minute - comments change more frequently
  ANALYTICS: 15 * 60 * 1000,     // 15 minutes - analytics don't need real-time updates
  NOTIFICATIONS: 30 * 1000,      // 30 seconds - notifications should be fresh
  PRIVACY: 60 * 60 * 1000,       // 1 hour - privacy settings change rarely
  EXPORT: 10 * 1000,             // 10 seconds - export status needs frequent updates
} as const

// Cache time constants (how long to keep unused data)
export const JOURNAL_GC_TIME = {
  ENTRY: 30 * 60 * 1000,         // 30 minutes
  FEED: 15 * 60 * 1000,          // 15 minutes  
  SEARCH: 10 * 60 * 1000,        // 10 minutes
  COMMENTS: 5 * 60 * 1000,       // 5 minutes
  ANALYTICS: 60 * 60 * 1000,     // 1 hour
  NOTIFICATIONS: 5 * 60 * 1000,  // 5 minutes
  PRIVACY: 60 * 60 * 1000,       // 1 hour
  EXPORT: 1 * 60 * 1000,         // 1 minute
} as const

// Default pagination limits
export const JOURNAL_PAGE_SIZES = {
  FEED: 20,
  SEARCH: 15,
  COMMENTS: 50,
  NOTIFICATIONS: 25,
} as const

// Retry configuration
export const JOURNAL_RETRY_CONFIG = {
  DEFAULT: {
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  },
  PRIVACY_SENSITIVE: {
    retry: 1, // Less aggressive retry for privacy-sensitive operations
    retryDelay: 2000,
  },
  BACKGROUND: {
    retry: 5,
    retryDelay: (attemptIndex: number) => Math.min(500 * 2 ** attemptIndex, 10000),
  },
  CRITICAL: {
    retry: 0, // No retries for critical operations like deletion
    retryDelay: 0,
  },
} as const

// Enhanced query key roots for security integration
export const SECURITY_QUERY_KEYS = {
  ACCESS_REQUESTS: 'journal-access-requests',
  USER_BADGES: 'user-badges',
  PERMISSIONS: 'journal-permissions',
  HIPAA_AUDIT: 'hipaa-audit',
  SECURITY_EVENTS: 'security-events',
} as const

// Privacy level access matrix
export const PRIVACY_ACCESS_MATRIX: Record<JournalPrivacyLevel, {
  canView: (viewerBadges?: BadgeType[], isFollowed?: boolean, isAuthor?: boolean) => boolean
  canComment: (viewerBadges?: BadgeType[], isFollowed?: boolean, isAuthor?: boolean) => boolean
  canShare: (viewerBadges?: BadgeType[], isFollowed?: boolean, isAuthor?: boolean) => boolean
}> = {
  private: {
    canView: (_, __, isAuthor) => isAuthor === true,
    canComment: () => false,
    canShare: () => false,
  },
  contacts: {
    canView: (_, isFollowed, isAuthor) => isAuthor === true || isFollowed === true,
    canComment: (_, isFollowed, isAuthor) => isAuthor === true || isFollowed === true,
    canShare: () => false,
  },
  badge_community: {
    canView: (viewerBadges, isFollowed, isAuthor) => 
      isAuthor === true || isFollowed === true || (viewerBadges && viewerBadges.length > 0),
    canComment: (viewerBadges, isFollowed, isAuthor) => 
      isAuthor === true || isFollowed === true || (viewerBadges && viewerBadges.length > 0),
    canShare: (viewerBadges, isFollowed, isAuthor) => 
      isAuthor === true || isFollowed === true || (viewerBadges && viewerBadges.length > 0),
  },
  public: {
    canView: () => true,
    canComment: () => true,
    canShare: () => true,
  },
  anonymous: {
    canView: () => true,
    canComment: () => false, // Anonymous entries don't allow comments for safety
    canShare: () => false,   // Anonymous entries can't be shared to protect identity
  },
}

// Background refetch intervals
export const JOURNAL_REFETCH_INTERVALS = {
  ACTIVE_FEED: 60 * 1000,        // 1 minute for active feed tabs
  BACKGROUND_FEED: 5 * 60 * 1000, // 5 minutes for background feeds
  NOTIFICATIONS: 30 * 1000,       // 30 seconds for notifications
  NEVER: false,                   // For data that shouldn't auto-refetch
} as const

// Optimistic update timeouts
export const OPTIMISTIC_TIMEOUTS = {
  CREATE_ENTRY: 10 * 1000,       // 10 seconds to create entry
  UPDATE_ENTRY: 5 * 1000,        // 5 seconds to update entry
  DELETE_ENTRY: 3 * 1000,        // 3 seconds to delete entry
  ADD_COMMENT: 5 * 1000,         // 5 seconds to add comment
  PRIVACY_UPDATE: 2 * 1000,      // 2 seconds to update privacy
} as const

// Error messages for user-facing display
export const JOURNAL_ERROR_MESSAGES = {
  PERMISSION_DENIED: 'You do not have permission to access this journal entry.',
  PRIVACY_VIOLATION: 'This action would violate the privacy settings of the entry.',
  CONTENT_TOO_LARGE: 'The journal entry content is too large. Please reduce the text or remove some evidence files.',
  EVIDENCE_UPLOAD_FAILED: 'Failed to upload evidence files. Please try again.',
  HIPAA_COMPLIANCE_REQUIRED: 'This entry contains medical information and requires additional privacy protection.',
  BADGE_VERIFICATION_REQUIRED: 'You need a verified badge to access this community content.',
  RATE_LIMIT_EXCEEDED: 'You are creating entries too quickly. Please wait a moment before trying again.',
  ENCRYPTION_FAILED: 'Failed to encrypt sensitive content. Please try again.',
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const

// Feature flags for progressive rollout
export const JOURNAL_FEATURES = {
  REAL_TIME_UPDATES: true,
  ADVANCED_ANALYTICS: true,
  COMMUNITY_FEEDS: true,
  EVIDENCE_ENCRYPTION: true,
  EXPORT_FUNCTIONALITY: true,
  LOCATION_TRACKING: true,
  HIPAA_COMPLIANCE: false, // Will be enabled after compliance audit
  ANONYMOUS_POSTING: true,
  COMMENT_THREADING: true,
  PUSH_NOTIFICATIONS: true,
} as const

// HIPAA compliance settings
export const HIPAA_SETTINGS = {
  REQUIRE_ENCRYPTION: ['medical', 'high'] as const,
  REQUIRE_ACCESS_LOG: true,
  MAX_PHI_RETENTION_DAYS: 2555, // 7 years as per HIPAA
  REQUIRE_CONSENT: true,
  AUDIT_ALL_ACCESS: true,
} as const

// Enhanced cache invalidation patterns with security awareness
export const CACHE_INVALIDATION_PATTERNS = {
  // When a journal entry is created
  ON_CREATE_ENTRY: [
    JOURNAL_QUERY_KEYS.JOURNAL_FEED,
    JOURNAL_QUERY_KEYS.JOURNAL_ANALYTICS,
    JOURNAL_QUERY_KEYS.JOURNAL_SEARCH,
  ],
  // When a journal entry is updated
  ON_UPDATE_ENTRY: [
    JOURNAL_QUERY_KEYS.JOURNAL_ENTRY,
    JOURNAL_QUERY_KEYS.JOURNAL_FEED,
    JOURNAL_QUERY_KEYS.JOURNAL_SEARCH,
  ],
  // When a journal entry is deleted
  ON_DELETE_ENTRY: [
    JOURNAL_QUERY_KEYS.JOURNAL_ENTRY,
    JOURNAL_QUERY_KEYS.JOURNAL_FEED,
    JOURNAL_QUERY_KEYS.JOURNAL_ANALYTICS,
    JOURNAL_QUERY_KEYS.JOURNAL_SEARCH,
    JOURNAL_QUERY_KEYS.JOURNAL_COMMENTS,
  ],
  // When privacy settings change
  ON_PRIVACY_CHANGE: [
    JOURNAL_QUERY_KEYS.JOURNAL_FEED,
    JOURNAL_QUERY_KEYS.JOURNAL_SEARCH,
    JOURNAL_QUERY_KEYS.JOURNAL_PRIVACY,
    SECURITY_QUERY_KEYS.PERMISSIONS,
  ],
  // When a comment is added
  ON_COMMENT_ADD: [
    JOURNAL_QUERY_KEYS.JOURNAL_COMMENTS,
    JOURNAL_QUERY_KEYS.JOURNAL_NOTIFICATIONS,
  ],
  // When badge status changes
  ON_BADGE_UPDATE: [
    SECURITY_QUERY_KEYS.USER_BADGES,
    JOURNAL_QUERY_KEYS.JOURNAL_FEED,
    SECURITY_QUERY_KEYS.PERMISSIONS,
  ],
  // When access is granted or denied
  ON_ACCESS_CHANGE: [
    SECURITY_QUERY_KEYS.ACCESS_REQUESTS,
    SECURITY_QUERY_KEYS.PERMISSIONS,
    JOURNAL_QUERY_KEYS.JOURNAL_FEED,
  ],
}

// Performance monitoring thresholds
export const PERFORMANCE_THRESHOLDS = {
  MAX_QUERY_TIME: 5000,          // 5 seconds max query time
  MAX_FEED_SIZE: 1000,           // Max entries in feed cache
  MAX_SEARCH_RESULTS: 500,       // Max search results to cache
  MEMORY_WARNING_SIZE: 50 * 1024 * 1024, // 50MB cache size warning
  MAX_DECRYPTION_TIME: 2000,     // 2 seconds max decryption time
  MAX_ACCESS_CHECK_TIME: 1000,   // 1 second max access check time
} as const

// Security monitoring thresholds
export const SECURITY_THRESHOLDS = {
  MAX_FAILED_ACCESS_ATTEMPTS: 5,  // Max failed access attempts before alert
  MAX_BULK_ACCESS_COUNT: 50,      // Max entries accessed in short time
  SUSPICIOUS_ACCESS_WINDOW: 60000, // 1 minute window for suspicious activity
  PHI_ACCESS_ALERT_THRESHOLD: 10, // Alert after 10 PHI accesses
  RATE_LIMIT_WINDOW: 60000,       // 1 minute rate limit window
  RATE_LIMIT_MAX_REQUESTS: 100,   // Max requests per window
} as const

// Analytics periods
export const ANALYTICS_PERIODS = {
  DAY: 'day',
  WEEK: 'week', 
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
  ALL_TIME: 'all_time',
} as const

// Export formats
export const EXPORT_FORMATS = {
  JSON: 'json',
  PDF: 'pdf',
  CSV: 'csv',
  ENCRYPTED_ZIP: 'encrypted_zip',
} as const