# TISocial Journal State Management System

A comprehensive React Query-based state management solution for the TISocial journaling system with integrated security, privacy controls, and HIPAA compliance.

## Overview

This module provides a complete data layer for journal functionality with:

- **Privacy-First Design**: Multi-tier privacy controls with encryption
- **Security Integration**: Badge-based access control and audit logging  
- **HIPAA Compliance**: Medical data protection and compliance validation
- **Performance Optimized**: Intelligent caching and background updates
- **Real-time Features**: Live updates and collaborative functionality
- **Comprehensive Analytics**: Privacy-protected insights and trends

## Architecture

```
journal/
├── crud.ts           # Core CRUD operations with security
├── feeds.ts          # Feed management and infinite scroll
├── privacy.ts        # Privacy controls and permissions
├── analytics.ts      # Analytics and insights
├── types.ts          # TypeScript definitions
├── constants.ts      # Configuration and constants
├── utils.ts          # Utility functions
├── cache.ts          # Cache management
└── index.ts          # Main export file
```

## Quick Start

### Basic Usage

```typescript
import {
  useJournalEntry,
  useCreateJournalEntry,
  useJournalFeed,
  useJournalAnalytics,
} from '#/state/queries/journal'

// Fetch a journal entry
const { data: entry, isLoading, error } = useJournalEntry(entryId)

// Create a new entry
const createMutation = useCreateJournalEntry()
await createMutation.mutateAsync({
  text: "My journal entry content",
  entryType: 'real_time',
  privacyLevel: 'private',
  symptoms: [
    {
      category: 'neurological',
      severity: 6,
      notes: 'Headache started around 2pm'
    }
  ]
})

// Load personal feed
const feedQuery = useJournalFeed('personal', {
  privacyLevels: ['private', 'contacts'],
  limit: 20
})

// Get analytics
const analytics = useJournalAnalytics('MONTH')
```

### Advanced Features

```typescript
// HIPAA-compliant medical entry
const validateCompliance = useValidateHIPAACompliance()
const compliance = await validateCompliance({
  text: medicalNotes,
  symptoms: medicalSymptoms,
  isPHI: true
})

if (compliance.isCompliant) {
  await createMutation.mutateAsync({
    ...entryData,
    isPHI: true,
    privacyLevel: 'private',
    encryptionLevel: 'enhanced'
  })
}

// Community feed with badge verification
const communityFeed = useJournalFeed('community', {
  requiresBadgeAccess: ['gangstalked', 'targeted'],
  sortBy: 'engagement'
})

// Real-time search with privacy filtering
const searchResults = useJournalSearch({
  query: searchTerm,
  filters: {
    symptoms: ['neurological', 'psychological'],
    dateRange: { start, end },
    privacyLevels: ['public', 'badge_community']
  }
})
```

## Privacy Levels

The system supports six privacy levels:

| Level | Description | Access Control |
|-------|-------------|----------------|
| `private` | User only | Owner access only |
| `contacts` | Followed users | Owner + followed users |
| `badge_community` | Badge holders | Owner + users with matching verified badges |
| `public` | Everyone | Public access |
| `anonymous` | Research only | Public but anonymized |
| `medical` | Medical data | Enhanced encryption + audit logging |

## Security Features

### Access Control
- Badge-based community access
- Real-time permission validation
- Access request/approval workflow
- Audit logging for sensitive data

### Encryption
- Client-side encryption for sensitive data
- Multiple encryption levels (none, standard, enhanced, quantum-resistant)
- Automatic encryption based on content classification
- Secure key management

### HIPAA Compliance
- PHI data identification and protection
- Enhanced audit logging
- Breach notification assessment
- Compliance validation tools

## Hook Categories

### CRUD Operations
- `useJournalEntry(id)` - Fetch single entry
- `useCreateJournalEntry()` - Create new entry
- `useUpdateJournalEntry()` - Update existing entry
- `useDeleteJournalEntry()` - Delete entry
- `useDuplicateJournalEntry()` - Duplicate entry

### Feed Management
- `useJournalFeed(type, filters)` - Infinite scroll feeds
- `useJournalSearch(params)` - Real-time search
- `useJournalActivity(timeframe)` - Activity summaries
- `usePrefetchNextFeedPage()` - Performance optimization

### Privacy & Permissions
- `useJournalPrivacySettings()` - Get privacy settings
- `useUpdatePrivacySettings()` - Update privacy settings
- `useJournalPermissions(entryId)` - Check entry permissions
- `useUserBadges()` - Get user's verified badges
- `useRequestEntryAccess()` - Request access to private entry
- `useAccessRequests()` - Manage access requests

### Analytics & Insights
- `useJournalAnalytics(period)` - Comprehensive analytics
- `useJournalInsights()` - Real-time insights
- `useJournalTrends(period, metric)` - Trend analysis
- `useExportJournalData()` - Data export
- `usePerformanceMetrics()` - System performance

## Data Types

### Core Types

```typescript
interface JournalEntry {
  id: string
  uri: string
  cid: string
  did: string
  
  // Content
  text: string
  title?: string
  entryType: 'real_time' | 'backdated'
  
  // Timestamps
  createdAt: string
  updatedAt?: string
  incidentTimestamp?: string
  
  // Structured data
  symptoms: JournalSymptom[]
  evidence: JournalEvidence[]
  sources: JournalSource[]
  location?: JournalLocation
  tags: string[]
  
  // Privacy & access
  privacyLevel: JournalPrivacyLevel
  allowComments: boolean
  allowSharing: boolean
  requiresBadgeAccess?: BadgeType[]
  
  // Security
  isPHI: boolean
  encryptionLevel?: 'none' | 'standard' | 'enhanced'
  accessLogRequired: boolean
  
  // User interaction
  viewer?: {
    canEdit: boolean
    canDelete: boolean
    canComment: boolean
    canShare: boolean
    hasAccess: boolean
  }
}
```

### Symptom Tracking

```typescript
interface JournalSymptom {
  id: string
  category: SymptomCategory
  subcategory?: string
  severity: number // 1-10 scale
  duration?: string
  onset?: 'sudden' | 'gradual' | 'intermittent'
  notes?: string
  relatedSymptoms?: string[]
}

type SymptomCategory = 
  | 'physical_pain'
  | 'neurological'
  | 'psychological' 
  | 'sleep_disruption'
  | 'cognitive_impairment'
  | 'sensory_anomaly'
  | 'technology_interference'
  | 'surveillance_indication'
  | 'other'
```

## Performance Optimization

### Caching Strategy
- Smart query key organization
- Hierarchical cache invalidation
- Background refetching for active data
- Selective cache updates

### Loading Optimization
- Optimistic updates with rollback
- Infinite scroll pagination
- Prefetching for better UX
- Stale-while-revalidate patterns

### Memory Management
- Automatic garbage collection
- Cache size monitoring
- Memory usage alerts
- Query deduplication

## Error Handling

The system provides comprehensive error handling with user-friendly messages:

```typescript
interface JournalError extends Error {
  type: JournalErrorType
  retryable: boolean
  privacyRelated: boolean
  userMessage: string
  details?: any
}

type JournalErrorType =
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
```

## Configuration

### Performance Tuning

```typescript
// Stale times for different data types
export const JOURNAL_STALE_TIME = {
  ENTRY: 5 * 60 * 1000,        // 5 minutes
  FEED: 2 * 60 * 1000,         // 2 minutes
  ANALYTICS: 15 * 60 * 1000,    // 15 minutes
  PRIVACY: 60 * 60 * 1000,      // 1 hour
}

// Cache retention times
export const JOURNAL_GC_TIME = {
  ENTRY: 30 * 60 * 1000,       // 30 minutes
  FEED: 15 * 60 * 1000,        // 15 minutes
  SEARCH: 10 * 60 * 1000,      // 10 minutes
}
```

### Security Settings

```typescript
// HIPAA compliance configuration
export const HIPAA_SETTINGS = {
  REQUIRE_ENCRYPTION: ['medical', 'high'],
  REQUIRE_ACCESS_LOG: true,
  MAX_PHI_RETENTION_DAYS: 2555, // 7 years
  REQUIRE_CONSENT: true,
  AUDIT_ALL_ACCESS: true,
}

// Security thresholds
export const SECURITY_THRESHOLDS = {
  MAX_FAILED_ACCESS_ATTEMPTS: 5,
  MAX_BULK_ACCESS_COUNT: 50,
  PHI_ACCESS_ALERT_THRESHOLD: 10,
  RATE_LIMIT_MAX_REQUESTS: 100,
}
```

## Integration Examples

### React Component Integration

```tsx
import React from 'react'
import {
  useJournalFeed,
  useCreateJournalEntry,
  JournalPrivacyLevel,
} from '#/state/queries/journal'

export function JournalFeedView() {
  const feedQuery = useJournalFeed('personal')
  const createMutation = useCreateJournalEntry()
  
  if (feedQuery.isLoading) {
    return <JournalFeedSkeleton />
  }
  
  if (feedQuery.error) {
    return <ErrorMessage error={feedQuery.error} />
  }
  
  return (
    <div>
      <JournalComposer onSubmit={createMutation.mutateAsync} />
      <InfiniteScrollFeed
        pages={feedQuery.data?.pages}
        fetchNextPage={feedQuery.fetchNextPage}
        hasNextPage={feedQuery.hasNextPage}
      />
    </div>
  )
}
```

### Privacy-Aware Components

```tsx
import { useJournalPermissions } from '#/state/queries/journal'

export function JournalEntryCard({ entry }: { entry: JournalEntry }) {
  const permissions = useJournalPermissions(entry.id)
  
  if (!permissions.data?.hasAccess) {
    return (
      <AccessDeniedCard
        reason={permissions.data?.reason}
        canRequest={permissions.data?.canRequest}
        entryId={entry.id}
      />
    )
  }
  
  return <JournalEntryView entry={entry} />
}
```

### Analytics Dashboard

```tsx
import {
  useJournalAnalytics,
  useJournalTrends,
  ANALYTICS_PERIODS,
} from '#/state/queries/journal'

export function AnalyticsDashboard() {
  const analytics = useJournalAnalytics('MONTH', {
    includePredictions: true,
    includeCorrelations: true,
  })
  
  const symptomTrends = useJournalTrends('WEEK', 'symptoms')
  
  return (
    <div>
      <OverviewStats analytics={analytics.data} />
      <SymptomTrendChart data={symptomTrends.data} />
      <QualityOfLifeScore score={analytics.data?.qualityOfLifeScore} />
      <PredictiveInsights predictions={analytics.data?.predictions} />
    </div>
  )
}
```

## Testing

### Unit Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useJournalEntry } from '#/state/queries/journal'

describe('useJournalEntry', () => {
  it('should fetch journal entry with privacy validation', async () => {
    const queryClient = new QueryClient()
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
    
    const { result } = renderHook(
      () => useJournalEntry('test-entry-id'),
      { wrapper }
    )
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    
    expect(result.current.data).toMatchObject({
      id: 'test-entry-id',
      privacyLevel: 'private',
      viewer: {
        hasAccess: true,
        canEdit: true,
      },
    })
  })
})
```

### Integration Testing

```typescript
import { setupTestEnvironment } from '#/test/utils'
import { JournalTestHarness } from '#/test/journal'

describe('Journal Integration', () => {
  it('should create and retrieve entry with proper privacy controls', async () => {
    const { queryClient, mockApi } = setupTestEnvironment()
    const harness = new JournalTestHarness(queryClient, mockApi)
    
    // Create entry
    const entry = await harness.createEntry({
      text: 'Test entry',
      privacyLevel: 'private',
      isPHI: true,
    })
    
    // Verify creation
    expect(entry.isPHI).toBe(true)
    expect(entry.encryptionLevel).toBe('enhanced')
    
    // Verify access control
    const permissions = await harness.checkPermissions(entry.id)
    expect(permissions.hasAccess).toBe(true)
    expect(permissions.requiredPermissions).toContain('phi:access')
  })
})
```

## Migration Guide

### From Legacy System

If migrating from an existing journal system:

1. **Data Migration**: Use export/import hooks to transfer data
2. **Privacy Upgrade**: Review and update privacy levels
3. **Security Audit**: Validate HIPAA compliance requirements
4. **Performance Testing**: Monitor query performance and cache efficiency

### Version Updates

When updating the journal system:

1. **Check Breaking Changes**: Review changelog for API changes
2. **Update Types**: Ensure TypeScript types are current
3. **Test Privacy Features**: Validate access controls still work
4. **Performance Validation**: Check that optimizations are effective

## Troubleshooting

### Common Issues

**Cache Not Invalidating**
```typescript
// Force cache refresh
queryClient.invalidateQueries({
  queryKey: JOURNAL_QUERY_KEYS.JOURNAL_FEED
})

// Or reset specific entry
queryClient.resetQueries({
  queryKey: JOURNAL_QUERY_KEYS.entry(entryId)
})
```

**Privacy Errors**
```typescript
// Check user permissions
const permissions = useJournalPermissions(entryId)
if (!permissions.data?.hasAccess) {
  console.log('Access denied:', permissions.data?.reason)
}

// Validate HIPAA compliance
const compliance = await validateCompliance(entryData)
if (!compliance.isCompliant) {
  console.log('Compliance violations:', compliance.violations)
}
```

**Performance Issues**
```typescript
// Monitor performance
const metrics = usePerformanceMetrics()
console.log('Cache hit rate:', metrics.data?.cacheHitRate)
console.log('Average query time:', metrics.data?.averageQueryTime)

// Check memory usage
if (metrics.data?.memoryUsage > PERFORMANCE_THRESHOLDS.MEMORY_WARNING_SIZE) {
  queryClient.clear() // Clear cache if needed
}
```

## Contributing

When contributing to the journal state management system:

1. **Follow Security Guidelines**: Ensure all changes maintain security standards
2. **Test Privacy Features**: Thoroughly test access control changes
3. **Document Changes**: Update types and documentation
4. **Performance Impact**: Consider caching and performance implications
5. **HIPAA Compliance**: Ensure medical data handling remains compliant

## License

This module is part of the TISocial project and follows the project's licensing terms.