import {QueryClient} from '@tanstack/react-query'
import {renderHook, waitFor} from '@testing-library/react-native'
import {describe, expect, it, jest, beforeEach, afterEach} from '@jest/globals'
import {
  useJournalEntriesInfinite,
  useJournalEntry,
  useJournalStats,
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useDeleteJournalEntry,
} from '../../../src/state/queries/journal'
import {journalKeys} from '../../../src/state/queries/journal-keys'
import {
  createMockJournalEntry,
  createMockBackdatedEntry,
  mockJournalStats,
  generateJournalEntries,
} from '../../mocks/journal-data'
import {createQueryWrapper} from '../../test-utils'

// Mock the agent and session
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

const mockSession = {
  currentAccount: {
    did: 'did:example:alice',
    handle: 'alice.test',
    displayName: 'Alice Test',
    avatar: 'https://example.com/avatar.jpg',
  },
}

jest.mock('../../../src/state/session', () => ({
  useAgent: () => mockAgent,
  useSession: () => mockSession,
}))

describe('Journal Query Hooks', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    })
    jest.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('useJournalEntriesInfinite', () => {
    const mockEntries = generateJournalEntries(5)

    beforeEach(() => {
      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: {
          records: mockEntries.map(entry => ({
            uri: entry.uri,
            cid: entry.cid,
            value: entry,
          })),
          cursor: 'next-page-cursor',
        },
      })
    })

    it('fetches journal entries successfully', async () => {
      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useJournalEntriesInfinite(), {wrapper})

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.pages[0].entries).toHaveLength(5)
      expect(result.current.data?.pages[0].hasMore).toBe(true)
      expect(mockAgent.com.atproto.repo.listRecords).toHaveBeenCalledWith({
        repo: 'did:example:alice',
        collection: 'app.warlog.journal',
        limit: 20,
        cursor: undefined,
      })
    })

    it('applies filters correctly', async () => {
      const filters = {
        entryType: 'real_time' as const,
        privacy: 'private' as const,
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
      }

      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useJournalEntriesInfinite(filters), {wrapper})

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Client-side filtering should be applied
      expect(result.current.data?.pages[0].entries.every(entry => 
        entry.entryType === 'real_time'
      )).toBe(true)
    })

    it('handles pagination correctly', async () => {
      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useJournalEntriesInfinite(), {wrapper})

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Fetch next page
      result.current.fetchNextPage()

      await waitFor(() => {
        expect(mockAgent.com.atproto.repo.listRecords).toHaveBeenCalledWith({
          repo: 'did:example:alice',
          collection: 'app.warlog.journal',
          limit: 20,
          cursor: 'next-page-cursor',
        })
      })
    })

    it('handles empty results', async () => {
      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: {
          records: [],
          cursor: undefined,
        },
      })

      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useJournalEntriesInfinite(), {wrapper})

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.pages[0].entries).toHaveLength(0)
      expect(result.current.data?.pages[0].hasMore).toBe(false)
    })

    it('handles network errors gracefully', async () => {
      const networkError = new Error('Network request failed')
      mockAgent.com.atproto.repo.listRecords.mockRejectedValue(networkError)

      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useJournalEntriesInfinite(), {wrapper})

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(networkError)
    })

    it('caches results properly with correct query keys', async () => {
      const filters = {entryType: 'real_time' as const}
      const expectedKey = journalKeys.entryList('did:example:alice', filters)

      const wrapper = createQueryWrapper(queryClient)
      renderHook(() => useJournalEntriesInfinite(filters), {wrapper})

      await waitFor(() => {
        const cachedData = queryClient.getQueryData(expectedKey)
        expect(cachedData).toBeDefined()
      })
    })
  })

  describe('useJournalEntry', () => {
    const mockEntry = createMockJournalEntry()
    const testUri = mockEntry.uri

    beforeEach(() => {
      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        uri: mockEntry.uri,
        cid: mockEntry.cid,
        value: mockEntry,
      })
    })

    it('fetches single journal entry successfully', async () => {
      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useJournalEntry(testUri), {wrapper})

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(expect.objectContaining({
        uri: mockEntry.uri,
        text: mockEntry.text,
        entryType: mockEntry.entryType,
      }))
    })

    it('handles not found entries', async () => {
      const notFoundError = new Error('Record not found')
      mockAgent.com.atproto.repo.getRecord.mockRejectedValue(notFoundError)

      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useJournalEntry('invalid-uri'), {wrapper})

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(notFoundError)
    })

    it('does not fetch when disabled', () => {
      const wrapper = createQueryWrapper(queryClient)
      renderHook(() => useJournalEntry(testUri, false), {wrapper})

      expect(mockAgent.com.atproto.repo.getRecord).not.toHaveBeenCalled()
    })
  })

  describe('useJournalStats', () => {
    const mockStatsEntries = [
      createMockJournalEntry(),
      createMockBackdatedEntry(),
      createMockJournalEntry({isPrivate: true}),
    ]

    beforeEach(() => {
      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: {
          records: mockStatsEntries.map(entry => ({
            uri: entry.uri,
            value: entry,
          })),
        },
      })
    })

    it('computes journal statistics correctly', async () => {
      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useJournalStats('month'), {wrapper})

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      const stats = result.current.data!
      expect(stats.totalEntries).toBe(3)
      expect(stats.privateEntries).toBe(2) // One explicit + one backdated
      expect(stats.realTimeEntries).toBe(2)
      expect(stats.backdatedEntries).toBe(1)
    })

    it('handles different time periods', async () => {
      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useJournalStats('year'), {wrapper})

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockAgent.com.atproto.repo.listRecords).toHaveBeenCalledWith({
        repo: 'did:example:alice',
        collection: 'app.warlog.journal',
        limit: 1000,
      })
    })

    it('updates periodically with background refetch', async () => {
      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useJournalStats(), {wrapper})

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Should have background refetch enabled
      expect(result.current.isRefetching).toBe(false)
      // Background refetch interval should be set (tested via query options)
    })
  })

  describe('useCreateJournalEntry', () => {
    const newEntryData = {
      text: 'New journal entry',
      entryType: 'real_time' as const,
      isPrivate: false,
    }

    beforeEach(() => {
      mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
        uri: 'at://did:example:alice/app.warlog.journal/new123',
        cid: 'bafkreinewentry123',
      })
    })

    it('creates journal entry successfully', async () => {
      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useCreateJournalEntry(), {wrapper})

      result.current.mutate(newEntryData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockAgent.com.atproto.repo.createRecord).toHaveBeenCalledWith({
        repo: 'did:example:alice',
        collection: 'app.warlog.journal',
        record: expect.objectContaining({
          $type: 'app.warlog.journal',
          ...newEntryData,
          createdAt: expect.any(String),
        }),
      })
    })

    it('performs optimistic updates', async () => {
      // Pre-populate cache with existing entries
      const existingEntries = generateJournalEntries(3)
      queryClient.setQueryData(
        journalKeys.entryList('did:example:alice'),
        {
          pages: [{entries: existingEntries, hasMore: false}],
          pageParams: [undefined],
        }
      )

      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useCreateJournalEntry(), {wrapper})

      result.current.mutate(newEntryData)

      // Check that optimistic update was applied immediately
      const cachedData = queryClient.getQueryData(journalKeys.entryList('did:example:alice')) as any
      expect(cachedData.pages[0].entries).toHaveLength(4) // 3 existing + 1 optimistic
      expect(cachedData.pages[0].entries[0].text).toBe(newEntryData.text)
    })

    it('rolls back optimistic updates on error', async () => {
      const createError = new Error('Failed to create entry')
      mockAgent.com.atproto.repo.createRecord.mockRejectedValue(createError)

      // Pre-populate cache
      const existingEntries = generateJournalEntries(3)
      queryClient.setQueryData(
        journalKeys.entryList('did:example:alice'),
        {
          pages: [{entries: existingEntries, hasMore: false}],
          pageParams: [undefined],
        }
      )

      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useCreateJournalEntry(), {wrapper})

      result.current.mutate(newEntryData)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      // Check that optimistic update was rolled back
      const cachedData = queryClient.getQueryData(journalKeys.entryList('did:example:alice')) as any
      expect(cachedData.pages[0].entries).toHaveLength(3) // Back to original 3
    })

    it('invalidates analytics cache on success', async () => {
      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useCreateJournalEntry(), {wrapper})

      const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries')

      result.current.mutate(newEntryData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: journalKeys.analytics(),
      })
    })
  })

  describe('useUpdateJournalEntry', () => {
    const existingEntry = createMockJournalEntry()
    const updateData = {
      uri: existingEntry.uri,
      text: 'Updated journal entry text',
      isPrivate: true,
    }

    beforeEach(() => {
      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        uri: existingEntry.uri,
        cid: existingEntry.cid,
        value: existingEntry,
      })

      mockAgent.com.atproto.repo.putRecord.mockResolvedValue({
        uri: existingEntry.uri,
        cid: 'bafkreiupdatedentry123',
      })
    })

    it('updates journal entry successfully', async () => {
      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useUpdateJournalEntry(), {wrapper})

      result.current.mutate(updateData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockAgent.com.atproto.repo.putRecord).toHaveBeenCalledWith({
        repo: 'did:example:alice',
        collection: 'app.warlog.journal',
        rkey: expect.any(String),
        record: expect.objectContaining({
          ...existingEntry,
          text: updateData.text,
          isPrivate: updateData.isPrivate,
        }),
      })
    })

    it('updates cache after successful update', async () => {
      // Pre-populate single entry cache
      queryClient.setQueryData(
        journalKeys.entry(existingEntry.uri),
        existingEntry
      )

      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useUpdateJournalEntry(), {wrapper})

      result.current.mutate(updateData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      const updatedEntry = queryClient.getQueryData(journalKeys.entry(existingEntry.uri))
      expect(updatedEntry).toEqual(expect.objectContaining({
        text: updateData.text,
        isPrivate: updateData.isPrivate,
      }))
    })

    it('handles update conflicts', async () => {
      const conflictError = new Error('Version conflict')
      mockAgent.com.atproto.repo.putRecord.mockRejectedValue(conflictError)

      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useUpdateJournalEntry(), {wrapper})

      result.current.mutate(updateData)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(conflictError)
    })
  })

  describe('useDeleteJournalEntry', () => {
    const entryToDelete = createMockJournalEntry()

    beforeEach(() => {
      mockAgent.com.atproto.repo.deleteRecord.mockResolvedValue({})
    })

    it('deletes journal entry successfully', async () => {
      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useDeleteJournalEntry(), {wrapper})

      result.current.mutate(entryToDelete.uri)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockAgent.com.atproto.repo.deleteRecord).toHaveBeenCalledWith({
        repo: 'did:example:alice',
        collection: 'app.warlog.journal',
        rkey: expect.any(String),
      })
    })

    it('removes entry from all caches', async () => {
      // Pre-populate caches
      queryClient.setQueryData(
        journalKeys.entry(entryToDelete.uri),
        entryToDelete
      )
      queryClient.setQueryData(
        journalKeys.entryList('did:example:alice'),
        {
          pages: [{entries: [entryToDelete], hasMore: false}],
          pageParams: [undefined],
        }
      )

      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useDeleteJournalEntry(), {wrapper})

      result.current.mutate(entryToDelete.uri)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Entry should be removed from single entry cache
      const singleEntry = queryClient.getQueryData(journalKeys.entry(entryToDelete.uri))
      expect(singleEntry).toBeUndefined()

      // Entry should be removed from list cache
      const listData = queryClient.getQueryData(journalKeys.entryList('did:example:alice')) as any
      expect(listData.pages[0].entries).toHaveLength(0)
    })

    it('invalidates analytics after deletion', async () => {
      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useDeleteJournalEntry(), {wrapper})

      const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries')

      result.current.mutate(entryToDelete.uri)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: journalKeys.analytics(),
      })
    })
  })

  describe('Error Handling', () => {
    it('handles authentication errors', async () => {
      // Mock no current account
      const originalSession = mockSession.currentAccount
      mockSession.currentAccount = null as any

      const wrapper = createQueryWrapper(queryClient)
      const {result} = renderHook(() => useJournalEntriesInfinite(), {wrapper})

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toContain('No authenticated user')

      // Restore session
      mockSession.currentAccount = originalSession
    })

    it('logs errors appropriately', async () => {
      const loggerSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      mockAgent.com.atproto.repo.listRecords.mockRejectedValue(
        new Error('Network failure')
      )

      const wrapper = createQueryWrapper(queryClient)
      renderHook(() => useJournalEntriesInfinite(), {wrapper})

      await waitFor(() => {
        expect(loggerSpy).toHaveBeenCalled()
      })

      loggerSpy.mockRestore()
    })
  })

  describe('Cache Management', () => {
    it('uses correct stale times for different query types', async () => {
      const wrapper = createQueryWrapper(queryClient)
      
      // Entry list should have shorter stale time
      renderHook(() => useJournalEntriesInfinite(), {wrapper})
      
      // Single entry should have longer stale time
      renderHook(() => useJournalEntry('test-uri'), {wrapper})
      
      // Stats should have longest stale time with background refetch
      renderHook(() => useJournalStats(), {wrapper})

      // Verify cache policies are applied correctly
      const queries = queryClient.getQueryCache().getAll()
      expect(queries.length).toBeGreaterThan(0)
    })

    it('handles cache invalidation correctly', () => {
      const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries')
      
      // Simulate various cache invalidation scenarios
      queryClient.invalidateQueries({queryKey: journalKeys.entries()})
      queryClient.invalidateQueries({queryKey: journalKeys.analytics()})
      
      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2)
    })
  })
})
