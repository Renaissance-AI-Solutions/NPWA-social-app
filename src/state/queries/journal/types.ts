import type {AppBskyActorDefs} from '@atproto/api'

// Privacy levels for journal entries
export type JournalPrivacyLevel = 'private' | 'contacts' | 'badge_community' | 'public' | 'anonymous'

// Badge types for community access control
export type BadgeType = 'havana' | 'gangstalked' | 'targeted' | 'whistleblower' | 'retaliation'

// Entry types based on timing
export type JournalEntryType = 'real_time' | 'backdated'

// Symptom categories for structured incident reporting
export type SymptomCategory = 
  | 'physical_pain' 
  | 'neurological' 
  | 'psychological' 
  | 'sleep_disruption' 
  | 'cognitive_impairment' 
  | 'sensory_anomaly' 
  | 'technology_interference' 
  | 'surveillance_indication' 
  | 'other'

// Location data structure
export interface JournalLocation {
  latitude: number
  longitude: number
  accuracy?: number
  address?: string
  city?: string
  state?: string
  country?: string
  isApproximate?: boolean // For privacy protection
}

// Symptom tracking structure
export interface JournalSymptom {
  id: string
  category: SymptomCategory
  subcategory?: string
  severity: number // 1-10 scale
  duration?: string
  onset?: string // "sudden", "gradual", "intermittent"
  notes?: string
  relatedSymptoms?: string[] // IDs of related symptoms
}

// Evidence attachment structure
export interface JournalEvidence {
  id: string
  uri: string
  type: 'image' | 'video' | 'audio' | 'document'
  filename: string
  size?: number
  mimeType?: string
  description?: string
  capturedAt?: string
  isEncrypted: boolean
  encryptionKey?: string // For client-side encryption
}

// Source citation structure (integrates with sources system)
export interface JournalSource {
  id: string
  sourceId: string // References sources table
  relevance: 'high' | 'medium' | 'low'
  notes?: string
  quotedText?: string
  pageNumber?: number
}

// Main journal entry structure
export interface JournalEntry {
  id: string
  uri: string // AT Protocol URI
  cid: string // Content ID for AT Protocol
  did: string // Author DID
  
  // Content
  text: string
  title?: string
  entryType: JournalEntryType
  
  // Timestamps
  createdAt: string
  updatedAt?: string
  incidentTimestamp?: string // When the actual incident occurred
  
  // Location and context
  location?: JournalLocation
  weather?: string
  environment?: string // "home", "work", "public", "vehicle", etc.
  
  // Structured data
  symptoms: JournalSymptom[]
  evidence: JournalEvidence[]
  sources: JournalSource[]
  tags: string[]
  
  // Privacy and access control
  privacyLevel: JournalPrivacyLevel
  allowComments: boolean
  allowSharing: boolean
  requiresBadgeAccess?: BadgeType[] // Which badge types can access
  triggerWarnings?: string[] // Content warnings
  
  // Engagement metrics
  viewCount?: number
  commentCount?: number
  shareCount?: number
  supportReactionCount?: number
  
  // Moderation and safety
  isDeleted: boolean
  isHidden: boolean
  reportCount?: number
  moderationNotes?: string
  
  // HIPAA compliance fields
  isPHI: boolean // Contains protected health information
  encryptionLevel?: 'none' | 'standard' | 'medical' // Encryption requirements
  accessLogRequired: boolean
  
  // AT Protocol fields
  indexedAt?: string
  via?: string // Posted via which client
  langs?: string[] // Language codes
  
  // User interaction state
  viewer?: {
    canEdit: boolean
    canDelete: boolean
    canComment: boolean
    canShare: boolean
    hasAccess: boolean
    viewedAt?: string
  }
}

// Condensed entry for feed views
export interface JournalEntryView {
  id: string
  uri: string
  cid: string
  author: AppBskyActorDefs.ProfileViewBasic
  
  text: string
  title?: string
  entryType: JournalEntryType
  createdAt: string
  incidentTimestamp?: string
  
  privacyLevel: JournalPrivacyLevel
  symptomCount: number
  evidenceCount: number
  sourceCount: number
  tags: string[]
  
  engagement: {
    commentCount: number
    shareCount: number
    supportReactionCount: number
  }
  
  viewer?: {
    canView: boolean
    canComment: boolean
    hasAccess: boolean
  }
  
  // Preview data (truncated for privacy)
  locationPreview?: string // City/state only
  triggerWarnings?: string[]
}

// Feed filtering and sorting options
export interface JournalFeedFilters {
  privacyLevels?: JournalPrivacyLevel[]
  badgeTypes?: BadgeType[]
  symptomCategories?: SymptomCategory[]
  dateRange?: {
    start: string
    end: string
  }
  location?: {
    latitude: number
    longitude: number
    radiusKm: number
  }
  tags?: string[]
  hasEvidence?: boolean
  hasSources?: boolean
  minSeverity?: number
  maxSeverity?: number
  authorDids?: string[]
  excludeAuthorDids?: string[]
}

export type JournalSortOrder = 
  | 'newest' 
  | 'oldest' 
  | 'incident_time' 
  | 'severity' 
  | 'engagement' 
  | 'relevance'

// Search parameters
export interface JournalSearchParams {
  query?: string
  filters?: JournalFeedFilters
  sortBy?: JournalSortOrder
  limit?: number
  cursor?: string
}

// Feed types
export type JournalFeedType = 
  | 'personal' // User's own entries
  | 'contacts' // Entries from followed users
  | 'community' // Badge-based community entries
  | 'public' // Public entries
  | 'local' // Geographically nearby entries
  | 'trending' // Popular/trending entries

// Analytics and insights
export interface JournalAnalytics {
  userId: string
  period: 'week' | 'month' | 'quarter' | 'year' | 'all_time'
  
  // Entry statistics
  totalEntries: number
  entriesThisPeriod: number
  averageEntriesPerWeek: number
  
  // Symptom patterns
  topSymptomCategories: Array<{
    category: SymptomCategory
    count: number
    averageSeverity: number
  }>
  
  // Temporal patterns
  mostActiveTimeOfDay: number // Hour of day (0-23)
  mostActiveDayOfWeek: number // 0 = Sunday
  incidentTimeTrends: Array<{
    date: string
    count: number
    averageSeverity: number
  }>
  
  // Location patterns (privacy-protected)
  locationClusters?: Array<{
    city: string
    state: string
    count: number
  }>
  
  // Engagement patterns
  totalViews: number
  totalComments: number
  totalShares: number
  averageEngagementRate: number
  
  // Evidence and documentation
  totalEvidenceItems: number
  evidenceByType: Record<string, number>
  totalSources: number
  mostCitedSources: Array<{
    sourceId: string
    title: string
    citationCount: number
  }>
}

// Comment structure for journal entries
export interface JournalComment {
  id: string
  uri: string
  entryId: string
  parentCommentId?: string // For nested comments
  author: AppBskyActorDefs.ProfileViewBasic
  
  text: string
  createdAt: string
  updatedAt?: string
  
  isSupport: boolean // Support vs general comment
  isModerator: boolean // Comment from community moderator
  isAnonymous: boolean
  
  // Engagement
  likeCount: number
  replyCount: number
  
  // Moderation
  isDeleted: boolean
  isHidden: boolean
  reportCount: number
  
  viewer?: {
    canReply: boolean
    canDelete: boolean
    canReport: boolean
    liked: boolean
  }
}

// Notification types for journal system
export type JournalNotificationType = 
  | 'comment' 
  | 'support_reaction' 
  | 'share' 
  | 'mention' 
  | 'community_response'
  | 'privacy_access_request'
  | 'moderation_action'

export interface JournalNotification {
  id: string
  type: JournalNotificationType
  entryId: string
  entry: JournalEntryView
  actor: AppBskyActorDefs.ProfileViewBasic
  createdAt: string
  isRead: boolean
  
  // Type-specific data
  comment?: JournalComment
  message?: string
  actionRequired?: boolean
}

// Export and backup structures
export interface JournalExportRequest {
  format: 'json' | 'pdf' | 'csv'
  includePrivate: boolean
  includeEvidence: boolean
  dateRange?: {
    start: string
    end: string
  }
  filters?: JournalFeedFilters
}

export interface JournalBackupMetadata {
  userId: string
  createdAt: string
  entryCount: number
  evidenceCount: number
  totalSize: number
  encryptionKey: string
  checksum: string
}

// Error types specific to journal operations
export type JournalErrorType = 
  | 'permission_denied'
  | 'privacy_violation'
  | 'content_too_large'
  | 'evidence_upload_failed'
  | 'hipaa_compliance_required'
  | 'badge_verification_required'
  | 'rate_limit_exceeded'
  | 'encryption_failed'
  | 'network_error'
  | 'server_error'

export interface JournalError extends Error {
  type: JournalErrorType
  code?: string
  retryable: boolean
  privacyRelated: boolean
  userMessage: string
  details?: Record<string, any>
}

// Query result types for React Query
export interface JournalFeedPage {
  entries: JournalEntryView[]
  cursor?: string
  hasMore: boolean
  totalCount?: number
}

export interface JournalSearchResult {
  entries: JournalEntryView[]
  totalCount: number
  facets?: {
    symptomCategories: Array<{category: SymptomCategory; count: number}>
    locations: Array<{city: string; state: string; count: number}>
    dateRanges: Array<{range: string; count: number}>
  }
  cursor?: string
  hasMore: boolean
}

// Mutation input types
export interface CreateJournalEntryInput {
  text: string
  title?: string
  entryType: JournalEntryType
  incidentTimestamp?: string
  location?: JournalLocation
  symptoms?: Omit<JournalSymptom, 'id'>[]
  evidence?: Omit<JournalEvidence, 'id'>[]
  sourceIds?: string[]
  tags?: string[]
  privacyLevel: JournalPrivacyLevel
  allowComments?: boolean
  allowSharing?: boolean
  requiresBadgeAccess?: BadgeType[]
  triggerWarnings?: string[]
  isPHI?: boolean
}

export interface UpdateJournalEntryInput extends Partial<CreateJournalEntryInput> {
  id: string
  uri: string
  cid: string
}

export interface DeleteJournalEntryInput {
  id: string
  uri: string
  permanent?: boolean // Soft delete vs permanent deletion
}

// Optimistic update types
export interface OptimisticJournalEntry extends JournalEntry {
  _optimistic: true
  _tempId: string
}

export interface OptimisticJournalComment extends JournalComment {
  _optimistic: true
  _tempId: string
}