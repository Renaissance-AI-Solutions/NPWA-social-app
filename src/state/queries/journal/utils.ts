import {nanoid} from 'nanoid'

import type {
  JournalError,
  JournalErrorType,
  CreateJournalEntryInput,
  OptimisticJournalEntry,
  JournalEntry,
  JournalPrivacyLevel,
  BadgeType,
} from './types'
import {
  JOURNAL_ERROR_MESSAGES,
  PRIVACY_ACCESS_MATRIX,
  PERFORMANCE_THRESHOLDS,
} from './constants'
import {JOURNAL_API_CONFIG} from '#/env'
import {QueryClient} from '@tanstack/react-query'

/**
 * Creates a standardized JournalError with consistent structure
 */
export function createJournalError(
  type: JournalErrorType,
  userMessage: string,
  details?: Record<string, any>
): JournalError {
  const error = new Error(userMessage) as JournalError
  error.type = type
  error.userMessage = userMessage
  error.retryable = isRetryableError(type)
  error.privacyRelated = isPrivacyRelatedError(type)
  error.details = details
  
  return error
}

/**
 * Determines if an error type is retryable (enhanced for AT Protocol)
 */
function isRetryableError(type: JournalErrorType): boolean {
  const retryableTypes: JournalErrorType[] = [
    'network_error',
    'server_error',
    'evidence_upload_failed',
    'encryption_failed',
    'rate_limit_exceeded', // Added for AT Protocol rate limiting
  ]
  return retryableTypes.includes(type)
}

/**
 * Determines if an error is privacy-related and should be handled carefully
 */
function isPrivacyRelatedError(type: JournalErrorType): boolean {
  const privacyTypes: JournalErrorType[] = [
    'permission_denied',
    'privacy_violation',
    'hipaa_compliance_required',
    'badge_verification_required',
  ]
  return privacyTypes.includes(type)
}

/**
 * Maps AT Protocol errors to JournalError types with context-aware handling
 */
export function mapAtProtocolError(atpError: any, context?: string): JournalError {
  const errorCode = atpError?.status || atpError?.code || 'unknown'
  const errorMessage = atpError?.message || atpError?.error || 'Unknown error'
  
  // AT Protocol specific error mappings
  switch (errorCode) {
    case 401:
    case 'Unauthorized':
    case 'InvalidToken':
      return createJournalError(
        'permission_denied', 
        'Authentication required. Please log in again.',
        { atpError, context, authRequired: true }
      )
    
    case 403:
    case 'Forbidden':
      return createJournalError(
        'permission_denied',
        'You do not have permission to perform this action.',
        { atpError, context }
      )
    
    case 404:
    case 'NotFound':
      return createJournalError(
        'network_error',
        context === 'entry' ? 'Journal entry not found.' : 'Resource not found.',
        { atpError, context }
      )
    
    case 409:
    case 'Conflict':
      return createJournalError(
        'server_error',
        'This entry has been modified by another client. Please refresh and try again.',
        { atpError, context, requiresRefresh: true }
      )
    
    case 413:
    case 'PayloadTooLarge':
      return createJournalError(
        'content_too_large',
        'Entry content or evidence files are too large.',
        { atpError, context }
      )
    
    case 429:
    case 'RateLimitExceeded':
      return createJournalError(
        'rate_limit_exceeded',
        'Too many requests. Please wait a moment before trying again.',
        { atpError, context, retryAfter: atpError?.retryAfter }
      )
    
    case 500:
    case 502:
    case 503:
    case 'InternalServerError':
    case 'BadGateway':
    case 'ServiceUnavailable':
      return createJournalError(
        'server_error',
        'Server error. Please try again later.',
        { atpError, context }
      )
    
    case 'NetworkError':
    case 'TimeoutError':
    case 'NETWORK_ERROR':
      return createJournalError(
        'network_error',
        'Network error. Please check your connection and try again.',
        { atpError, context }
      )
    
    // Journal-specific XRPC errors
    case 'JournalPrivacyViolation':
      return createJournalError(
        'privacy_violation',
        'Access denied due to privacy settings.',
        { atpError, context }
      )
    
    case 'JournalBadgeRequired':
      return createJournalError(
        'badge_verification_required',
        'Verified community badge required to access this content.',
        { atpError, context }
      )
    
    case 'JournalHIPAARequired':
      return createJournalError(
        'hipaa_compliance_required',
        'This medical information requires HIPAA-compliant handling.',
        { atpError, context }
      )
    
    default:
      // Generic error with AT Protocol context
      return createJournalError(
        'server_error',
        errorMessage || 'An unexpected error occurred.',
        { atpError, context, errorCode }
      )
  }
}

/**
 * Enhanced retry logic with AT Protocol specific considerations
 */
export function shouldRetryAtProtocolError(error: JournalError, attemptCount: number): boolean {
  // Never retry privacy or permission errors
  if (error.privacyRelated) {
    return false
  }
  
  // Check max retry attempts
  if (attemptCount >= JOURNAL_API_CONFIG.RETRY_ATTEMPTS) {
    return false
  }
  
  // AT Protocol specific retry logic
  const details = error.details
  
  // Retry rate limits with exponential backoff
  if (error.type === 'rate_limit_exceeded') {
    return attemptCount < 2 // Limit rate limit retries
  }
  
  // Retry server errors
  if (error.type === 'server_error') {
    const errorCode = details?.atpError?.status || details?.errorCode
    return [500, 502, 503, 504].includes(errorCode)
  }
  
  // Retry network errors
  if (error.type === 'network_error') {
    return true
  }
  
  // Use base retryable logic for other errors
  return error.retryable
}

/**
 * Calculate retry delay with exponential backoff for AT Protocol errors
 */
export function calculateRetryDelay(error: JournalError, attemptCount: number): number {
  const baseDelay = JOURNAL_API_CONFIG.RETRY_DELAY
  
  // Rate limit errors should respect retry-after header
  if (error.type === 'rate_limit_exceeded' && error.details?.retryAfter) {
    return Math.max(error.details.retryAfter * 1000, baseDelay)
  }
  
  // Exponential backoff: baseDelay * 2^attemptCount
  const exponentialDelay = baseDelay * Math.pow(2, attemptCount - 1)
  
  // Cap at 30 seconds
  return Math.min(exponentialDelay, 30000)
}

/**
 * Validates journal entry input before submission
 */
export function validateJournalEntry(input: CreateJournalEntryInput): JournalError | null {
  // Text content validation
  if (!input.text?.trim()) {
    return createJournalError('content_too_large', 'Journal entry text cannot be empty')
  }
  
  if (input.text.length > 10000) { // 10k character limit
    return createJournalError('content_too_large', JOURNAL_ERROR_MESSAGES.CONTENT_TOO_LARGE)
  }
  
  // Title validation
  if (input.title && input.title.length > 200) {
    return createJournalError('content_too_large', 'Title cannot exceed 200 characters')
  }
  
  // Privacy level validation
  if (!['private', 'contacts', 'badge_community', 'public', 'anonymous'].includes(input.privacyLevel)) {
    return createJournalError('privacy_violation', 'Invalid privacy level')
  }
  
  // Badge access validation
  if (input.privacyLevel === 'badge_community' && (!input.requiresBadgeAccess || input.requiresBadgeAccess.length === 0)) {
    return createJournalError('badge_verification_required', 'Badge community entries must specify required badges')
  }
  
  // Symptom validation
  if (input.symptoms) {
    for (const symptom of input.symptoms) {
      if (symptom.severity < 1 || symptom.severity > 10) {
        return createJournalError('content_too_large', 'Symptom severity must be between 1 and 10')
      }
    }
  }
  
  // Evidence validation
  if (input.evidence && input.evidence.length > 20) {
    return createJournalError('evidence_upload_failed', 'Cannot attach more than 20 evidence files')
  }
  
  // Tags validation
  if (input.tags && input.tags.length > 50) {
    return createJournalError('content_too_large', 'Cannot add more than 50 tags')
  }
  
  // Location validation
  if (input.location) {
    if (input.location.latitude < -90 || input.location.latitude > 90) {
      return createJournalError('content_too_large', 'Invalid latitude coordinate')
    }
    if (input.location.longitude < -180 || input.location.longitude > 180) {
      return createJournalError('content_too_large', 'Invalid longitude coordinate')
    }
  }
  
  // PHI validation
  if (input.isPHI && input.privacyLevel === 'public') {
    return createJournalError('hipaa_compliance_required', 'Medical information cannot be posted publicly')
  }
  
  return null
}

/**
 * Generates an optimistic journal entry for immediate UI feedback
 */
export function generateOptimisticEntry(
  input: CreateJournalEntryInput,
  userDid: string
): OptimisticJournalEntry {
  const tempId = nanoid()
  const timestamp = new Date().toISOString()
  
  return {
    _optimistic: true,
    _tempId: tempId,
    id: tempId,
    uri: `at://${userDid}/app.warlog.journal/${tempId}`,
    cid: `optimistic-${tempId}`,
    did: userDid,
    
    // Content from input
    text: input.text,
    title: input.title,
    entryType: input.entryType,
    
    // Timestamps
    createdAt: timestamp,
    incidentTimestamp: input.incidentTimestamp,
    
    // Location and context
    location: input.location,
    
    // Structured data
    symptoms: input.symptoms?.map(s => ({
      ...s,
      id: nanoid(),
    })) || [],
    evidence: input.evidence?.map(e => ({
      ...e,
      id: nanoid(),
    })) || [],
    sources: [], // Sources will be resolved after creation
    tags: input.tags || [],
    
    // Privacy and access control
    privacyLevel: input.privacyLevel,
    allowComments: input.allowComments !== false,
    allowSharing: input.allowSharing !== false,
    requiresBadgeAccess: input.requiresBadgeAccess,
    triggerWarnings: input.triggerWarnings,
    
    // Default values
    viewCount: 0,
    commentCount: 0,
    shareCount: 0,
    supportReactionCount: 0,
    isDeleted: false,
    isHidden: false,
    isPHI: input.isPHI || false,
    accessLogRequired: input.isPHI || false,
    
    // Viewer permissions (optimistic - user can interact with their own entry)
    viewer: {
      canEdit: true,
      canDelete: true,
      canComment: input.allowComments !== false,
      canShare: input.allowSharing !== false,
      hasAccess: true,
    },
  }
}

/**
 * Checks if a user has access to view a journal entry based on privacy settings
 */
export function canViewJournalEntry(
  entry: JournalEntry | JournalEntryView,
  viewerContext?: {
    did?: string
    badges?: BadgeType[]
    isFollowing?: boolean
  }
): boolean {
  // Author can always view their own entries
  if (viewerContext?.did === entry.did || viewerContext?.did === (entry as any).author?.did) {
    return true
  }
  
  // Check privacy level permissions
  const privacyLevel = entry.privacyLevel
  const accessControl = PRIVACY_ACCESS_MATRIX[privacyLevel]
  
  return accessControl.canView(
    viewerContext?.badges,
    viewerContext?.isFollowing,
    false // Not author since we checked above
  )
}

/**
 * Checks if a user can comment on a journal entry
 */
export function canCommentOnJournalEntry(
  entry: JournalEntry | JournalEntryView,
  viewerContext?: {
    did?: string
    badges?: BadgeType[]
    isFollowing?: boolean
  }
): boolean {
  // Must be able to view first
  if (!canViewJournalEntry(entry, viewerContext)) {
    return false
  }
  
  // Check if comments are allowed
  if ('allowComments' in entry && !entry.allowComments) {
    return false
  }
  
  // Check privacy level permissions
  const privacyLevel = entry.privacyLevel
  const accessControl = PRIVACY_ACCESS_MATRIX[privacyLevel]
  
  const isAuthor = viewerContext?.did === entry.did || viewerContext?.did === (entry as any).author?.did
  
  return accessControl.canComment(
    viewerContext?.badges,
    viewerContext?.isFollowing,
    isAuthor
  )
}

/**
 * Checks if a user can share a journal entry
 */
export function canShareJournalEntry(
  entry: JournalEntry | JournalEntryView,
  viewerContext?: {
    did?: string
    badges?: BadgeType[]
    isFollowing?: boolean
  }
): boolean {
  // Must be able to view first
  if (!canViewJournalEntry(entry, viewerContext)) {
    return false
  }
  
  // Check if sharing is allowed
  if ('allowSharing' in entry && !entry.allowSharing) {
    return false
  }
  
  // Check privacy level permissions
  const privacyLevel = entry.privacyLevel
  const accessControl = PRIVACY_ACCESS_MATRIX[privacyLevel]
  
  const isAuthor = viewerContext?.did === entry.did || viewerContext?.did === (entry as any).author?.did
  
  return accessControl.canShare(
    viewerContext?.badges,
    viewerContext?.isFollowing,
    isAuthor
  )
}

/**
 * Sanitizes journal entry data for display based on privacy level
 */
export function sanitizeJournalEntryForDisplay(
  entry: JournalEntry,
  viewerContext?: {
    did?: string
    badges?: BadgeType[]
    isFollowing?: boolean
  }
): Partial<JournalEntry> {
  // If user can't view, return minimal info
  if (!canViewJournalEntry(entry, viewerContext)) {
    return {
      id: entry.id,
      privacyLevel: entry.privacyLevel,
      isDeleted: entry.isDeleted,
    }
  }
  
  const sanitized = {...entry}
  
  // For anonymous entries, remove identifying information
  if (entry.privacyLevel === 'anonymous') {
    // Remove precise location data
    if (sanitized.location) {
      sanitized.location = {
        ...sanitized.location,
        latitude: Math.round(sanitized.location.latitude * 100) / 100, // Reduce precision
        longitude: Math.round(sanitized.location.longitude * 100) / 100,
        address: undefined, // Remove specific address
        accuracy: undefined,
      }
    }
    
    // Remove evidence that might be identifying
    sanitized.evidence = sanitized.evidence.filter(e => 
      !e.description?.toLowerCase().includes('face') &&
      !e.description?.toLowerCase().includes('identity') &&
      !e.description?.toLowerCase().includes('name')
    )
  }
  
  // For PHI content, ensure proper access controls
  if (entry.isPHI) {
    // Additional sanitization for medical information
    // This would integrate with HIPAA compliance systems
  }
  
  return sanitized
}

/**
 * Generates a preview of journal entry content for feed display
 */
export function generateJournalEntryPreview(
  entry: JournalEntry,
  maxLength: number = 200
): string {
  const text = entry.text.trim()
  
  if (text.length <= maxLength) {
    return text
  }
  
  // Find a good break point (sentence or paragraph)
  const truncated = text.substring(0, maxLength)
  const lastSentence = truncated.lastIndexOf('. ')
  const lastParagraph = truncated.lastIndexOf('\n')
  
  const breakPoint = Math.max(lastSentence, lastParagraph)
  
  if (breakPoint > maxLength * 0.5) {
    return truncated.substring(0, breakPoint + 1).trim()
  }
  
  // No good break point found, truncate at word boundary
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace).trim() + '...'
  }
  
  return truncated.trim() + '...'
}

/**
 * Calculates a severity score for a journal entry based on symptoms
 */
export function calculateEntrySeverityScore(entry: JournalEntry): number {
  if (!entry.symptoms || entry.symptoms.length === 0) {
    return 0
  }
  
  const totalSeverity = entry.symptoms.reduce((sum, symptom) => sum + symptom.severity, 0)
  const averageSeverity = totalSeverity / entry.symptoms.length
  
  // Weight by number of symptoms (more symptoms = higher concern)
  const symptomCountWeight = Math.min(entry.symptoms.length / 5, 2) // Cap at 2x weight
  
  return Math.min(averageSeverity * symptomCountWeight, 10)
}

/**
 * Formats a journal entry's location for display
 */
export function formatJournalLocation(
  location: JournalEntry['location'],
  privacyLevel: JournalPrivacyLevel
): string {
  if (!location) return ''
  
  // For anonymous entries, show only city/state
  if (privacyLevel === 'anonymous') {
    return [location.city, location.state].filter(Boolean).join(', ')
  }
  
  // For private entries, show full address if available
  if (location.address) {
    return location.address
  }
  
  // Fallback to coordinates
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
}

/**
 * Validates query performance and logs warnings
 */
export function validateQueryPerformance(
  queryKey: readonly unknown[],
  startTime: number,
  dataSize?: number
): void {
  const duration = Date.now() - startTime
  
  if (duration > PERFORMANCE_THRESHOLDS.MAX_QUERY_TIME) {
    console.warn(`Slow journal query detected: ${queryKey.join('/')} took ${duration}ms`)
  }
  
  if (dataSize && dataSize > PERFORMANCE_THRESHOLDS.MEMORY_WARNING_SIZE) {
    console.warn(`Large journal data size: ${queryKey.join('/')} returned ${dataSize} bytes`)
  }
}

/**
 * Debounces function calls for search and other frequent operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    const later = () => {
      timeout = null
      if (!immediate) func(...args)
    }
    
    const callNow = immediate && !timeout
    
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    
    if (callNow) func(...args)
  }
}

/**
 * Creates a stable query key for React Query
 */
export function createStableQueryKey(
  base: readonly unknown[],
  params?: Record<string, any>
): readonly unknown[] {
  if (!params) return base
  
  // Sort object keys for consistent ordering
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = params[key]
      return sorted
    }, {} as Record<string, any>)
  
  return [...base, sortedParams]
}

/**
 * Merges journal entries from multiple sources while avoiding duplicates
 */
export function mergeJournalEntries(
  ...sources: (JournalEntry[] | JournalEntryView[])[]
): (JournalEntry | JournalEntryView)[] {
  const seen = new Set<string>()
  const merged: (JournalEntry | JournalEntryView)[] = []
  
  for (const source of sources) {
    for (const entry of source) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id)
        merged.push(entry)
      }
    }
  }
  
  return merged
}

/**
 * Extracts hashtags from journal entry text
 */
export function extractHashtags(text: string): string[] {
  const hashtags = text.match(/#[\w\u0590-\u05ff]+/g) || []
  return hashtags.map(tag => tag.toLowerCase().substring(1)) // Remove # and lowercase
}

/**
 * Estimates read time for a journal entry
 */
export function estimateJournalReadTime(entry: JournalEntry): number {
  const wordsPerMinute = 200
  const wordCount = entry.text.split(/\s+/).length
  
  // Add time for evidence review
  const evidenceTime = entry.evidence.length * 0.5 // 30 seconds per evidence item
  
  // Add time for symptoms review
  const symptomsTime = entry.symptoms.length * 0.2 // 12 seconds per symptom
  
  const totalMinutes = (wordCount / wordsPerMinute) + evidenceTime + symptomsTime
  
  return Math.max(1, Math.round(totalMinutes)) // Minimum 1 minute
}