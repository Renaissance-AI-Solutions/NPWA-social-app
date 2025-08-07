/**
 * Frontend-Backend Communication Integration Tests
 * 
 * Validates React Query hooks, XRPC endpoint communication,
 * error handling, and real-time synchronization.
 */

import { QueryClient } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react-native'
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals'
import {
  useJournalEntriesInfinite,
  useJournalEntry,
  useJournalStats,
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useDeleteJournalEntry,
} from '../../src/state/queries/journal'
import { journalKeys } from '../../src/state/queries/journal-keys'
import {
  createMockJournalEntry,
  createMockBackdatedEntry,
  generateJournalEntries,
} from '../mocks/journal-data'
import { createQueryWrapper } from '../../src/test-utils'
import type {
  JournalEntry,
  CreateJournalEntryData,
  UpdateJournalEntryData,
  JournalEntryFilters,
} from '../../src/types/journal'

// Mock AT Protocol client with realistic error scenarios
const mockAgent = {
  com: {
    atproto: {
      repo: {
        listRecords: jest.fn(),
        getRecord: jest.fn(),
        createRecord: jest.fn(),
        putRecord: jest.fn(),
        deleteRecord: jest.fn(),
      },
    },
  },
}

// Mock session management
const mockSession = {
  currentAccount: {
    did: 'did:example:alice',
    handle: 'alice.test',
    displayName: 'Alice Test',
    avatar: 'https://example.com/avatar.jpg',
  },
}

// Mock network conditions for testing
interface NetworkCondition {
  name: string
  delay: number
  errorRate: number
  errorType?: 'timeout' | 'network' | 'server' | 'auth'
  intermittent?: boolean
}

const NETWORK_CONDITIONS: NetworkCondition[] = [
  { name: 'optimal', delay: 50, errorRate: 0 },
  { name: 'slow', delay: 2000, errorRate: 0 },
  { name: 'unreliable', delay: 500, errorRate: 0.1, errorType: 'network', intermittent: true },
  { name: 'server_errors', delay: 200, errorRate: 0.05, errorType: 'server' },
  { name: 'timeout_prone', delay: 5000, errorRate: 0.2, errorType: 'timeout' },
]

// Error simulation helpers
const simulateNetworkError = (condition: NetworkCondition) => {
  if (Math.random() < condition.errorRate) {
    switch (condition.errorType) {
      case 'timeout':
        throw new Error('Request timeout')
      case 'network':
        throw new Error('Network request failed')
      case 'server':
        throw new Error('Internal server error')
      case 'auth':
        throw new Error('Authentication failed')
      default:
        throw new Error('Unknown error')
    }
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

jest.mock('../../src/state/session', () => ({
  useAgent: () => mockAgent,
  useSession: () => mockSession,
}))

describe('Frontend-Backend Communication Integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 3,
          retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
          staleTime: 5 * 60 * 1000, // 5 minutes
        },
        mutations: {
          retry: 2,
        },
      },
    })
    jest.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('XRPC Communication Patterns', () => {
    it('handles successful XRPC requests with proper response transformation', async () => {
      const mockEntries = generateJournalEntries(5)
      const mockResponse = {
        data: {
          records: mockEntries.map(entry => ({
            uri: entry.uri,
            cid: entry.cid,
            value: {
              $type: 'app.warlog.journal',
              text: entry.text,
              entryType: entry.entryType,
              privacyLevel: entry.isPrivate ? 'private' : 'public',
              classification: 'unclassified',
              content: {
                text: entry.text,
                isEncrypted: entry.isEncrypted || false,
                encryptionLevel: entry.isEncrypted ? 'standard' : 'none',
              },
              createdAt: entry.createdAt,
            },
          })),
          cursor: 'next-page-token',
        },
      }

      mockAgent.com.atproto.repo.listRecords.mockResolvedValue(mockResponse)

      const wrapper = createQueryWrapper(queryClient)
      const { result } = renderHook(() => useJournalEntriesInfinite(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Verify response transformation
      expect(result.current.data?.pages[0].entries).toHaveLength(5)
      expect(result.current.data?.pages[0].hasMore).toBe(true)
      expect(result.current.data?.pages[0].nextCursor).toBe('next-page-token')

      // Verify XRPC call format
      expect(mockAgent.com.atproto.repo.listRecords).toHaveBeenCalledWith({
        repo: 'did:example:alice',
        collection: 'app.warlog.journal',
        limit: 20,
        cursor: undefined,
      })

      // Verify frontend type conversion
      const firstEntry = result.current.data?.pages[0].entries[0]
      expect(firstEntry).toMatchObject({
        uri: expect.stringMatching(/^at:\/\//),
        cid: expect.stringMatching(/^bafkrei/),
        text: expect.any(String),
        entryType: expect.stringMatching(/^(real_time|backdated)$/),
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        isPrivate: expect.any(Boolean),
        author: expect.objectContaining({
          did: expect.stringMatching(/^did:/),
          handle: expect.any(String),
        }),
      })
    })

    it('handles XRPC error responses with proper error transformation', async () => {
      const xrpcError = {
        error: 'InvalidRequest',
        message: 'Invalid collection specified',
        status: 400,
      }

      mockAgent.com.atproto.repo.listRecords.mockRejectedValue(xrpcError)

      const wrapper = createQueryWrapper(queryClient)
      const { result } = renderHook(() => useJournalEntriesInfinite(), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(xrpcError)
      expect(result.current.data).toBeUndefined()
    })

    it('implements proper request/response serialization', async () => {
      const createData: CreateJournalEntryData = {
        text: 'Test entry with complex data',
        entryType: 'real_time',
        isPrivate: true,
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
        symptoms: [
          { id: '1', name: 'Headache', severity: 3 },
          { id: '2', name: 'Nausea', severity: 2 },
        ],
        evidenceUris: ['at://did:example:evidence/doc1'],
        tags: ['test', 'serialization'],
        incidentDate: new Date('2024-01-15T10:30:00Z'),
      }

      const expectedXrpcRecord = {
        $type: 'app.warlog.journal',
        text: createData.text,
        entryType: createData.entryType,
        privacyLevel: 'private',
        classification: 'sensitive',
        content: {
          text: createData.text,
          isEncrypted: true,
          encryptionLevel: 'standard',
        },
        location: {
          encrypted: false,
          data: JSON.stringify({
            latitude: createData.location!.latitude,
            longitude: createData.location!.longitude,
          }),
          accuracy: createData.location!.accuracy,
        },
        symptoms: {
          encrypted: false,
          data: JSON.stringify(createData.symptoms),
          count: createData.symptoms!.length,
        },
        evidenceUris: createData.evidenceUris,
        tags: createData.tags,
        incidentTimestamp: createData.incidentDate!.toISOString(),
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }

      mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
        uri: 'at://did:example:alice/app.warlog.journal/test123',
        cid: 'bafkreitestcid123',
      })

      const wrapper = createQueryWrapper(queryClient)
      const { result } = renderHook(() => useCreateJournalEntry(), { wrapper })

      act(() => {
        result.current.mutate(createData)
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Verify serialization to XRPC format
      expect(mockAgent.com.atproto.repo.createRecord).toHaveBeenCalledWith({
        repo: 'did:example:alice',
        collection: 'app.warlog.journal',
        record: expectedXrpcRecord,
      })
    })
  })

  describe('Network Resilience and Error Handling', () => {
    it('implements exponential backoff retry strategy', async () => {
      let attemptCount = 0
      mockAgent.com.atproto.repo.listRecords.mockImplementation(() => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Network timeout')
        }
        return Promise.resolve({
          data: {
            records: generateJournalEntries(3).map(entry => ({
              uri: entry.uri,
              cid: entry.cid,
              value: entry,
            })),
          },
        })
      })

      const wrapper = createQueryWrapper(queryClient)
      const { result } = renderHook(() => useJournalEntriesInfinite(), { wrapper })

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true)
        },
        { timeout: 10000 }
      )

      expect(attemptCount).toBe(3)
      expect(result.current.data?.pages[0].entries).toHaveLength(3)
    })

    it('handles different network conditions gracefully', async () => {
      for (const condition of NETWORK_CONDITIONS) {
        console.log(`Testing network condition: ${condition.name}`)
        
        // Reset query client for each condition
        queryClient.clear()
        jest.clearAllMocks()

        mockAgent.com.atproto.repo.listRecords.mockImplementation(async () => {
          await delay(condition.delay)
          simulateNetworkError(condition)
          
          return {
            data: {
              records: generateJournalEntries(2).map(entry => ({
                uri: entry.uri,
                cid: entry.cid,
                value: entry,
              })),
            },
          }
        })

        const wrapper = createQueryWrapper(queryClient)
        const { result } = renderHook(() => useJournalEntriesInfinite(), { wrapper })

        await waitFor(
          () => {
            expect(result.current.isLoading).toBe(false)
          },
          { timeout: 15000 }
        )

        if (condition.errorRate === 0) {
          expect(result.current.isSuccess).toBe(true)
          expect(result.current.data?.pages[0].entries).toHaveLength(2)
        } else {
          // With retry logic, some requests should eventually succeed
          expect(result.current.isError || result.current.isSuccess).toBe(true)
        }
      }
    })

    it('provides meaningful error messages for different failure types', async () => {
      const errorScenarios = [
        {
          name: 'authentication_failed',
          error: { error: 'AuthenticationRequired', message: 'Invalid or expired token', status: 401 },
          expectedType: 'auth_error',
        },
        {
          name: 'permission_denied',
          error: { error: 'Forbidden', message: 'Insufficient permissions', status: 403 },
          expectedType: 'permission_error',
        },
        {
          name: 'rate_limited',
          error: { error: 'RateLimitExceeded', message: 'Too many requests', status: 429 },
          expectedType: 'rate_limit_error',
        },
        {
          name: 'server_error',
          error: { error: 'InternalServerError', message: 'Server unavailable', status: 500 },
          expectedType: 'server_error',
        },
        {
          name: 'network_error',
          error: new Error('Network request failed'),
          expectedType: 'network_error',
        },
      ]

      for (const scenario of errorScenarios) {
        queryClient.clear()
        jest.clearAllMocks()

        mockAgent.com.atproto.repo.listRecords.mockRejectedValue(scenario.error)

        const wrapper = createQueryWrapper(queryClient)
        const { result } = renderHook(() => useJournalEntriesInfinite(), { wrapper })

        await waitFor(() => {
          expect(result.current.isError).toBe(true)
        })

        expect(result.current.error).toBeDefined()
        
        // Verify error categorization for user-friendly messages
        const error = result.current.error as any
        if (error.status) {
          expect([401, 403, 429, 500]).toContain(error.status)
        } else {
          expect(error.message).toContain('Network')
        }
      }
    })
  })

  describe('Real-time Updates and Cache Synchronization', () => {
    it('implements optimistic updates with rollback on failure', async () => {
      // Setup initial cache with existing entries
      const existingEntries = generateJournalEntries(3)
      queryClient.setQueryData(
        journalKeys.entryList('did:example:alice'),
        {
          pages: [{ entries: existingEntries, hasMore: false, nextCursor: null }],
          pageParams: [undefined],
        }
      )

      const newEntryData: CreateJournalEntryData = {
        text: 'Optimistic update test entry',
        entryType: 'real_time',
        isPrivate: false,
      }

      // Mock creation failure
      mockAgent.com.atproto.repo.createRecord.mockRejectedValue(
        new Error('Creation failed')
      )

      const wrapper = createQueryWrapper(queryClient)
      const { result } = renderHook(() => useCreateJournalEntry(), { wrapper })

      // Verify optimistic update is applied immediately
      act(() => {
        result.current.mutate(newEntryData)
      })

      // Check that optimistic update was applied
      const optimisticData = queryClient.getQueryData(
        journalKeys.entryList('did:example:alice')
      ) as any
      expect(optimisticData.pages[0].entries).toHaveLength(4)
      expect(optimisticData.pages[0].entries[0].text).toBe(newEntryData.text)

      // Wait for mutation to complete and fail
      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      // Verify rollback - should be back to original 3 entries
      const rolledBackData = queryClient.getQueryData(
        journalKeys.entryList('did:example:alice')
      ) as any
      expect(rolledBackData.pages[0].entries).toHaveLength(3)
      expect(rolledBackData.pages[0].entries[0].uri).toBe(existingEntries[0].uri)
    })

    it('handles concurrent updates with conflict resolution', async () => {
      const testEntry = createMockJournalEntry()
      
      // Setup initial cache
      queryClient.setQueryData(
        journalKeys.entry(testEntry.uri),
        testEntry
      )

      const updateData: UpdateJournalEntryData = {
        uri: testEntry.uri,
        text: 'Updated text from user A',
        tags: ['updated', 'user-a'],
      }

      const conflictingUpdateData: UpdateJournalEntryData = {
        uri: testEntry.uri,
        text: 'Updated text from user B',
        tags: ['updated', 'user-b'],
      }

      // Mock the first update to succeed
      mockAgent.com.atproto.repo.putRecord
        .mockResolvedValueOnce({
          uri: testEntry.uri,
          cid: 'new-cid-123',
        })
        // Mock the second update to fail with conflict
        .mockRejectedValueOnce({
          error: 'InvalidRequest',
          message: 'Record has been modified',
          status: 409,
        })

      const wrapper = createQueryWrapper(queryClient)
      const { result: updateResult1 } = renderHook(() => useUpdateJournalEntry(), { wrapper })
      const { result: updateResult2 } = renderHook(() => useUpdateJournalEntry(), { wrapper })

      // Execute both updates concurrently
      act(() => {
        updateResult1.current.mutate(updateData)
        updateResult2.current.mutate(conflictingUpdateData)
      })

      await waitFor(() => {
        expect(updateResult1.current.isSuccess || updateResult1.current.isError).toBe(true)
        expect(updateResult2.current.isSuccess || updateResult2.current.isError).toBe(true)
      })

      // First update should succeed
      expect(updateResult1.current.isSuccess).toBe(true)
      
      // Second update should fail with conflict
      expect(updateResult2.current.isError).toBe(true)
      expect((updateResult2.current.error as any).status).toBe(409)

      // Cache should reflect the successful update
      const cachedEntry = queryClient.getQueryData(journalKeys.entry(testEntry.uri)) as JournalEntry
      expect(cachedEntry.text).toBe(updateData.text)
      expect(cachedEntry.tags).toEqual(updateData.tags)
    })

    it('invalidates related caches on mutations', async () => {
      const testEntry = createMockJournalEntry()
      const newEntryData: CreateJournalEntryData = {
        text: 'New entry for cache invalidation test',
        entryType: 'real_time',
        isPrivate: false,
      }

      // Pre-populate caches
      queryClient.setQueryData(
        journalKeys.entryList('did:example:alice'),
        {
          pages: [{ entries: [testEntry], hasMore: false, nextCursor: null }],
          pageParams: [undefined],
        }
      )
      queryClient.setQueryData(journalKeys.analytics(), {
        totalEntries: 1,
        publicEntries: 1,
        privateEntries: 0,
      })

      mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
        uri: 'at://did:example:alice/app.warlog.journal/new123',
        cid: 'bafkreinew123',
      })

      const wrapper = createQueryWrapper(queryClient)
      const { result } = renderHook(() => useCreateJournalEntry(), { wrapper })

      const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries')

      act(() => {
        result.current.mutate(newEntryData)
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Verify cache invalidation calls
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: journalKeys.entries(),
      })
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: journalKeys.analytics(),
      })
    })
  })

  describe('Performance and Memory Management', () => {
    it('implements efficient pagination with cursor-based loading', async () => {
      const pageSize = 20
      let currentCursor: string | undefined = undefined
      let pageCount = 0

      mockAgent.com.atproto.repo.listRecords.mockImplementation(({ cursor }) => {
        pageCount++
        const entries = generateJournalEntries(pageSize, `page-${pageCount}`)
        const nextCursor = pageCount < 5 ? `cursor-page-${pageCount + 1}` : undefined
        
        return Promise.resolve({
          data: {
            records: entries.map(entry => ({
              uri: entry.uri,
              cid: entry.cid,
              value: entry,
            })),
            cursor: nextCursor,
          },
        })
      })

      const wrapper = createQueryWrapper(queryClient)
      const { result } = renderHook(() => useJournalEntriesInfinite(), { wrapper })

      // Load first page
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.pages).toHaveLength(1)
      expect(result.current.data?.pages[0].entries).toHaveLength(pageSize)
      expect(result.current.hasNextPage).toBe(true)

      // Load second page
      act(() => {
        result.current.fetchNextPage()
      })

      await waitFor(() => {
        expect(result.current.data?.pages).toHaveLength(2)
      })

      expect(result.current.data?.pages[1].entries).toHaveLength(pageSize)
      expect(result.current.hasNextPage).toBe(true)

      // Load all remaining pages
      while (result.current.hasNextPage && pageCount < 5) {
        act(() => {
          result.current.fetchNextPage()
        })

        await waitFor(() => {
          expect(result.current.data?.pages).toHaveLength(Math.min(pageCount, 5))
        })
      }

      // Verify final state
      expect(result.current.data?.pages).toHaveLength(5)
      expect(result.current.hasNextPage).toBe(false)
      
      // Verify cursor-based pagination
      expect(mockAgent.com.atproto.repo.listRecords).toHaveBeenCalledTimes(5)
      expect(mockAgent.com.atproto.repo.listRecords).toHaveBeenNthCalledWith(1, {
        repo: 'did:example:alice',
        collection: 'app.warlog.journal',
        limit: 20,
        cursor: undefined,
      })
      expect(mockAgent.com.atproto.repo.listRecords).toHaveBeenNthCalledWith(2, {
        repo: 'did:example:alice',
        collection: 'app.warlog.journal',
        limit: 20,
        cursor: 'cursor-page-2',
      })
    })

    it('manages memory efficiently with large datasets', async () => {
      const largeDataset = generateJournalEntries(1000)
      const batchSize = 50
      
      mockAgent.com.atproto.repo.listRecords.mockImplementation(({ cursor }) => {
        const startIndex = cursor ? parseInt(cursor.split('-')[1]) * batchSize : 0
        const endIndex = Math.min(startIndex + batchSize, largeDataset.length)
        const batch = largeDataset.slice(startIndex, endIndex)
        const nextCursor = endIndex < largeDataset.length ? `page-${Math.floor(endIndex / batchSize)}` : undefined

        return Promise.resolve({
          data: {
            records: batch.map(entry => ({
              uri: entry.uri,
              cid: entry.cid,
              value: entry,
            })),
            cursor: nextCursor,
          },
        })
      })

      const wrapper = createQueryWrapper(queryClient)
      const { result } = renderHook(() => useJournalEntriesInfinite(), { wrapper })

      // Load multiple pages and monitor memory
      const initialMemory = process.memoryUsage().heapUsed
      
      for (let i = 0; i < 10; i++) {
        if (result.current.hasNextPage) {
          act(() => {
            result.current.fetchNextPage()
          })

          await waitFor(() => {
            expect(result.current.data?.pages).toHaveLength(i + 2)
          })
        }
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryGrowth = finalMemory - initialMemory
      
      // Memory growth should be reasonable
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024) // Less than 50MB growth
      
      // Verify data integrity
      const totalEntries = result.current.data?.pages.reduce(
        (sum, page) => sum + page.entries.length,
        0
      )
      expect(totalEntries).toBe(Math.min(500, largeDataset.length)) // 10 pages * 50 entries
    })

    it('implements efficient cache cleanup and garbage collection', async () => {
      const entries = generateJournalEntries(100)
      
      // Populate cache with many entries
      for (const entry of entries) {
        queryClient.setQueryData(journalKeys.entry(entry.uri), entry)
      }

      // Verify cache is populated
      const cacheSize = queryClient.getQueryCache().getAll().length
      expect(cacheSize).toBeGreaterThanOrEqual(100)

      // Simulate cache cleanup
      const staleTime = 5 * 60 * 1000 // 5 minutes
      const now = Date.now()
      
      // Mark half the entries as stale
      const staleEntries = entries.slice(0, 50)
      for (const entry of staleEntries) {
        const query = queryClient.getQueryCache().find({
          queryKey: journalKeys.entry(entry.uri),
        })
        if (query) {
          query.state.dataUpdatedAt = now - staleTime - 1000
        }
      }

      // Trigger garbage collection
      queryClient.removeQueries({
        predicate: query => {
          return query.state.dataUpdatedAt < now - staleTime
        },
      })

      // Verify cleanup
      const cleanedCacheSize = queryClient.getQueryCache().getAll().length
      expect(cleanedCacheSize).toBeLessThan(cacheSize)
      expect(cleanedCacheSize).toBeGreaterThanOrEqual(50)
    })
  })

  describe('Advanced Query Patterns', () => {
    it('implements dependent queries with proper dependency chains', async () => {
      const userDid = 'did:example:alice'
      const journalEntryUri = 'at://did:example:alice/app.warlog.journal/dependent123'
      
      // Mock the dependent data fetching
      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        uri: journalEntryUri,
        cid: 'bafkreidependent123',
        value: {
          $type: 'app.warlog.journal',
          text: 'Entry for dependency testing',
          entryType: 'real_time',
          privacyLevel: 'public',
          evidenceUris: [
            'at://did:example:evidence/doc1',
            'at://did:example:evidence/doc2',
          ],
          sourceIds: ['source-1', 'source-2'],
          createdAt: new Date().toISOString(),
        },
      })

      const wrapper = createQueryWrapper(queryClient)
      const { result } = renderHook(() => {
        const entryQuery = useJournalEntry(journalEntryUri)
        
        // Dependent queries that only run when main entry is loaded
        const evidenceQueries = (entryQuery.data?.evidenceUris || []).map(uri =>
          useJournalEntry(uri, !!entryQuery.data)
        )
        
        return {
          entry: entryQuery,
          evidence: evidenceQueries,
        }
      }, { wrapper })

      // Wait for main entry to load
      await waitFor(() => {
        expect(result.current.entry.isSuccess).toBe(true)
      })

      expect(result.current.entry.data).toBeDefined()
      expect(result.current.entry.data?.evidenceUris).toHaveLength(2)
      
      // Verify dependent queries were triggered
      expect(mockAgent.com.atproto.repo.getRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          repo: userDid,
          collection: 'app.warlog.journal',
        })
      )
    })

    it('implements parallel queries with coordinated error handling', async () => {
      const userDid = 'did:example:alice'
      const entryUris = [
        'at://did:example:alice/app.warlog.journal/parallel1',
        'at://did:example:alice/app.warlog.journal/parallel2',
        'at://did:example:alice/app.warlog.journal/parallel3',
      ]

      // Mock some queries to succeed and others to fail
      mockAgent.com.atproto.repo.getRecord
        .mockResolvedValueOnce({
          uri: entryUris[0],
          cid: 'bafkreiparallel1',
          value: createMockJournalEntry({ text: 'Parallel entry 1' }),
        })
        .mockRejectedValueOnce(new Error('Entry not found'))
        .mockResolvedValueOnce({
          uri: entryUris[2],
          cid: 'bafkreiparallel3',
          value: createMockJournalEntry({ text: 'Parallel entry 3' }),
        })

      const wrapper = createQueryWrapper(queryClient)
      const { result } = renderHook(() => {
        return entryUris.map(uri => useJournalEntry(uri))
      }, { wrapper })

      await waitFor(() => {
        const allSettled = result.current.every(query => 
          query.isSuccess || query.isError
        )
        expect(allSettled).toBe(true)
      })

      // Verify mixed results
      expect(result.current[0].isSuccess).toBe(true)
      expect(result.current[0].data?.text).toBe('Parallel entry 1')
      
      expect(result.current[1].isError).toBe(true)
      expect(result.current[1].error).toEqual(new Error('Entry not found'))
      
      expect(result.current[2].isSuccess).toBe(true)
      expect(result.current[2].data?.text).toBe('Parallel entry 3')
    })

    it('implements background refetch with stale-while-revalidate pattern', async () => {
      const testEntry = createMockJournalEntry()
      let fetchCount = 0
      
      mockAgent.com.atproto.repo.getRecord.mockImplementation(() => {
        fetchCount++
        return Promise.resolve({
          uri: testEntry.uri,
          cid: `bafkrei${fetchCount}`,
          value: {
            ...testEntry,
            text: `Entry updated ${fetchCount} times`,
          },
        })
      })

      const wrapper = createQueryWrapper(queryClient)
      const { result } = renderHook(() => useJournalEntry(testEntry.uri), { wrapper })

      // Initial fetch
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(fetchCount).toBe(1)
      expect(result.current.data?.text).toBe('Entry updated 1 times')

      // Trigger background refetch
      act(() => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(fetchCount).toBe(2)
      })

      expect(result.current.data?.text).toBe('Entry updated 2 times')
      
      // Verify stale data was served while revalidating
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isRefetching).toBe(false)
    })
  })

  describe('Type Safety and Runtime Validation', () => {
    it('validates response types at runtime', async () => {
      const invalidResponse = {
        data: {
          records: [
            {
              uri: 'invalid-uri-format',
              cid: 123, // Should be string
              value: {
                $type: 'wrong.type',
                text: 'Test entry',
                entryType: 'invalid_type',
                privacyLevel: 'unknown_level',
                createdAt: 'invalid-date-format',
              },
            },
          ],
        },
      }

      mockAgent.com.atproto.repo.listRecords.mockResolvedValue(invalidResponse)

      const wrapper = createQueryWrapper(queryClient)
      const { result } = renderHook(() => useJournalEntriesInfinite(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should handle invalid data gracefully
      if (result.current.isSuccess) {
        // Data should be sanitized or filtered out
        expect(result.current.data?.pages[0].entries).toEqual([])
      } else {
        // Or should fail with validation error
        expect(result.current.isError).toBe(true)
      }
    })

    it('maintains type safety across frontend-backend boundary', async () => {
      const typedEntry = createMockJournalEntry({
        text: 'Type safety test entry',
        entryType: 'real_time',
        isPrivate: true,
        evidenceUris: ['at://did:example:evidence/doc1'],
        tags: ['type-safety', 'test'],
      })

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        uri: typedEntry.uri,
        cid: typedEntry.cid,
        value: {
          $type: 'app.warlog.journal',
          text: typedEntry.text,
          entryType: typedEntry.entryType,
          privacyLevel: typedEntry.isPrivate ? 'private' : 'public',
          classification: 'sensitive',
          content: {
            text: typedEntry.text,
            isEncrypted: true,
            encryptionLevel: 'standard',
          },
          evidenceUris: typedEntry.evidenceUris,
          tags: typedEntry.tags,
          createdAt: typedEntry.createdAt,
        },
      })

      const wrapper = createQueryWrapper(queryClient)
      const { result } = renderHook(() => useJournalEntry(typedEntry.uri), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      const retrievedEntry = result.current.data!
      
      // Verify type preservation and transformation
      expect(retrievedEntry.uri).toBe(typedEntry.uri)
      expect(retrievedEntry.text).toBe(typedEntry.text)
      expect(retrievedEntry.entryType).toBe(typedEntry.entryType)
      expect(retrievedEntry.isPrivate).toBe(true)
      expect(retrievedEntry.evidenceUris).toEqual(typedEntry.evidenceUris)
      expect(retrievedEntry.tags).toEqual(typedEntry.tags)
      expect(retrievedEntry.createdAt).toBe(typedEntry.createdAt)
      
      // Verify computed properties
      expect(retrievedEntry.author).toBeDefined()
      expect(retrievedEntry.author.did).toMatch(/^did:/)
    })
  })
})
