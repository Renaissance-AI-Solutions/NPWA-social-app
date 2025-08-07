/**
 * Hierarchical query key factory for journal-related queries
 * Provides consistent cache invalidation and organization
 */
export const journalKeys = {
  // Root keys for broad invalidation
  all: ['journal'] as const,
  entries: () => [...journalKeys.all, 'entries'] as const,
  feeds: () => [...journalKeys.all, 'feeds'] as const,
  analytics: () => [...journalKeys.all, 'analytics'] as const,
  sources: () => [...journalKeys.all, 'sources'] as const,
  
  // Entry-specific keys
  entry: (uri: string) => [...journalKeys.entries(), 'detail', uri] as const,
  entryList: (did: string, filters?: JournalFilters) => 
    [...journalKeys.entries(), 'list', did, filters] as const,
  entrySearch: (did: string, query: string) => 
    [...journalKeys.entries(), 'search', did, query] as const,
  entryDrafts: (did: string) => 
    [...journalKeys.entries(), 'drafts', did] as const,
  
  // Feed keys with hierarchical invalidation
  timeline: (did: string, privacy: PrivacyLevel) => 
    [...journalKeys.feeds(), 'timeline', did, privacy] as const,
  feed: (did: string, feedType: FeedType, params?: FeedParams) => 
    [...journalKeys.feeds(), feedType, did, params] as const,
  
  // Analytics keys
  stats: (did: string, period: TimePeriod) => 
    [...journalKeys.analytics(), 'stats', did, period] as const,
  trends: (did: string, period: TimePeriod) => 
    [...journalKeys.analytics(), 'trends', did, period] as const,
  insights: (did: string) => 
    [...journalKeys.analytics(), 'insights', did] as const,
  
  // Source-related keys
  entrySources: (entryUri: string) => 
    [...journalKeys.sources(), 'entry', entryUri] as const,
  sourceValidation: (sourceId: string) => 
    [...journalKeys.sources(), 'validation', sourceId] as const,
  
  // Privacy and settings keys
  privacySettings: (did: string) => 
    [...journalKeys.all, 'privacy', did] as const,
  sharing: (did: string) => 
    [...journalKeys.all, 'sharing', did] as const,
  permissions: (did: string, resource?: string) => 
    [...journalKeys.all, 'permissions', did, resource] as const,
  
  // Advanced feature keys
  notifications: (did: string) => 
    [...journalKeys.all, 'notifications', did] as const,
  syncStatus: (did: string) => 
    [...journalKeys.all, 'sync', did] as const,
  backupStatus: (did: string) => 
    [...journalKeys.all, 'backup', did] as const,
} as const

export type JournalFilters = {
  entryType?: 'real_time' | 'backdated' | 'all'
  privacy?: 'public' | 'private' | 'all'
  dateRange?: {start: Date; end: Date}
  symptoms?: string[]
  location?: {radius: number; center: [number, number]}
  tags?: string[]
}

export type PrivacyLevel = 'public' | 'private' | 'friends'
export type FeedType = 'personal' | 'public' | 'community' | 'analytics'
export type TimePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year'
export type FeedParams = {
  limit?: number
  cursor?: string
  includeReplies?: boolean
}