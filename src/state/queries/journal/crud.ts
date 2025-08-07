import {useCallback} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {AtUri} from '@atproto/api'

import {useAgent, useSession} from '#/state/session'
import {logger} from '#/logger'
import * as Toast from '#/view/com/util/Toast'
import {cleanError} from '#/lib/strings/errors'
import {JOURNAL_API_CONFIG} from '#/env'

import type {
  JournalEntry,
  JournalEntryView,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  DeleteJournalEntryInput,
  JournalError,
  OptimisticJournalEntry,
} from './types'
import {
  JOURNAL_QUERY_KEYS,
  JOURNAL_STALE_TIME,
  JOURNAL_GC_TIME,
  JOURNAL_RETRY_CONFIG,
  JOURNAL_ERROR_MESSAGES,
  CACHE_INVALIDATION_PATTERNS,
  OPTIMISTIC_TIMEOUTS,
} from './constants'
import {createJournalError, validateJournalEntry, generateOptimisticEntry, mapAtProtocolError} from './utils'

// ===== QUERY HOOKS =====

/**
 * Hook to fetch a single journal entry by ID
 */
export function useJournalEntry(entryId: string | undefined, options?: {
  enabled?: boolean
}) {
  const agent = useAgent()
  
  return useQuery({
    queryKey: JOURNAL_QUERY_KEYS.entry(entryId || ''),
    queryFn: async (): Promise<JournalEntry> => {
      if (!entryId) {
        throw createJournalError('NETWORK_ERROR', 'Entry ID is required')
      }

      try {
        // Use AT Protocol XRPC call for journal entry retrieval
        const response = await agent.call(
          JOURNAL_API_CONFIG.JOURNAL_ENDPOINTS.GET_ENTRY,
          'get',
          {
            id: entryId,
          }
        )
        
        if (!response.success) {
          throw createJournalError('SERVER_ERROR', 'Failed to fetch journal entry')
        }

        return response.data as JournalEntry
      } catch (error) {
        logger.error('Failed to fetch journal entry', {entryId, error})
        
        // Use AT Protocol error mapping for consistent error handling
        throw mapAtProtocolError(error, 'entry')
      }
    },
    enabled: !!entryId && (options?.enabled !== false),
    staleTime: JOURNAL_STALE_TIME.ENTRY,
    gcTime: JOURNAL_GC_TIME.ENTRY,
    ...JOURNAL_RETRY_CONFIG.DEFAULT,
  })
}

/**
 * Hook to fetch a journal entry by AT Protocol URI
 */
export function useJournalEntryByUri(uri: string | undefined, options?: {
  enabled?: boolean
}) {
  const agent = useAgent()
  
  return useQuery({
    queryKey: JOURNAL_QUERY_KEYS.entryByUri(uri || ''),
    queryFn: async (): Promise<JournalEntry> => {
      if (!uri) {
        throw createJournalError('NETWORK_ERROR', 'Entry URI is required')
      }

      try {
        const atUri = new AtUri(uri)
        const response = await agent.call(
          JOURNAL_API_CONFIG.JOURNAL_ENDPOINTS.GET_ENTRY,
          'get',
          {
            did: atUri.hostname,
            rkey: atUri.rkey,
          }
        )
        
        if (!response.success) {
          throw createJournalError('SERVER_ERROR', 'Failed to fetch journal entry')
        }

        return response.data as JournalEntry
      } catch (error) {
        logger.error('Failed to fetch journal entry by URI', {uri, error})
        throw mapAtProtocolError(error, 'entry')
      }
    },
    enabled: !!uri && (options?.enabled !== false),
    staleTime: JOURNAL_STALE_TIME.ENTRY,
    gcTime: JOURNAL_GC_TIME.ENTRY,
    ...JOURNAL_RETRY_CONFIG.DEFAULT,
  })
}

/**
 * Hook to get a journal entry synchronously from cache
 */
export function useGetJournalEntry() {
  const queryClient = useQueryClient()
  
  return useCallback((entryId: string): JournalEntry | undefined => {
    return queryClient.getQueryData(JOURNAL_QUERY_KEYS.entry(entryId))
  }, [queryClient])
}

// ===== MUTATION HOOKS =====

/**
 * Hook to create a new journal entry with optimistic updates
 */
export function useCreateJournalEntry() {
  const agent = useAgent()
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()
  
  return useMutation<JournalEntry, JournalError, CreateJournalEntryInput>({
    mutationFn: async (input: CreateJournalEntryInput): Promise<JournalEntry> => {
      if (!currentAccount) {
        throw createJournalError('PERMISSION_DENIED', 'Must be logged in to create journal entries')
      }

      // Validate input
      const validationError = validateJournalEntry(input)
      if (validationError) {
        throw validationError
      }

      try {
        // Use AT Protocol XRPC call for journal entry creation
        const response = await agent.call(
          JOURNAL_API_CONFIG.JOURNAL_ENDPOINTS.CREATE_ENTRY,
          'post',
          {
            repo: currentAccount.did,
            record: {
              $type: 'xyz.tisocial.journal',
              ...input,
              createdAt: new Date().toISOString(),
            },
          }
        )

        if (!response.success) {
          throw createJournalError('SERVER_ERROR', 'Failed to create journal entry')
        }

        const newEntry: JournalEntry = {
          id: response.uri,
          uri: response.uri,
          cid: response.cid,
          did: currentAccount.did,
          ...input,
          createdAt: new Date().toISOString(),
          symptoms: input.symptoms || [],
          evidence: input.evidence || [],
          sources: [],
          tags: input.tags || [],
          isDeleted: false,
          isHidden: false,
          isPHI: input.isPHI || false,
          accessLogRequired: input.isPHI || false,
          viewer: {
            canEdit: true,
            canDelete: true,
            canComment: input.allowComments !== false,
            canShare: input.allowSharing !== false,
            hasAccess: true,
          },
        }

        return newEntry
      } catch (error) {
        logger.error('Failed to create journal entry', {input, error})
        
        if (error instanceof JournalError) {
          throw error
        }
        
        throw createJournalError('SERVER_ERROR', JOURNAL_ERROR_MESSAGES.SERVER_ERROR)
      }
    },
    onMutate: async (input) => {
      // Generate optimistic entry for immediate UI feedback
      if (!currentAccount) return

      const optimisticEntry = generateOptimisticEntry(input, currentAccount.did)
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({queryKey: [JOURNAL_QUERY_KEYS.JOURNAL_FEED]})
      
      // Optimistically update feed caches
      queryClient.setQueriesData<any>(
        {queryKey: [JOURNAL_QUERY_KEYS.JOURNAL_FEED]},
        (oldData) => {
          if (!oldData?.pages) return oldData
          
          const newPages = [...oldData.pages]
          if (newPages[0]?.entries) {
            newPages[0] = {
              ...newPages[0],
              entries: [optimisticEntry, ...newPages[0].entries],
            }
          }
          
          return {
            ...oldData,
            pages: newPages,
          }
        }
      )

      return {optimisticEntry}
    },
    onSuccess: (newEntry, variables, context) => {
      // Update optimistic entry with real data
      if (context?.optimisticEntry) {
        queryClient.setQueryData(
          JOURNAL_QUERY_KEYS.entry(newEntry.id),
          newEntry
        )
      }

      // Invalidate relevant caches
      CACHE_INVALIDATION_PATTERNS.ON_CREATE_ENTRY.forEach(pattern => {
        queryClient.invalidateQueries({queryKey: [pattern]})
      })

      Toast.show('Journal entry created successfully')
      logger.metric('journal:create:success', {
        entryType: variables.entryType,
        privacyLevel: variables.privacyLevel,
        hasSymptoms: (variables.symptoms?.length || 0) > 0,
        hasEvidence: (variables.evidence?.length || 0) > 0,
      })
    },
    onError: (error, variables, context) => {
      // Rollback optimistic updates
      if (context?.optimisticEntry) {
        queryClient.setQueriesData<any>(
          {queryKey: [JOURNAL_QUERY_KEYS.JOURNAL_FEED]},
          (oldData) => {
            if (!oldData?.pages) return oldData
            
            const newPages = oldData.pages.map((page: any) => ({
              ...page,
              entries: page.entries?.filter((entry: any) => 
                entry._tempId !== context.optimisticEntry._tempId
              ) || [],
            }))
            
            return {
              ...oldData,
              pages: newPages,
            }
          }
        )
      }

      Toast.show(error.userMessage || JOURNAL_ERROR_MESSAGES.UNKNOWN_ERROR)
      logger.error('Failed to create journal entry', {variables, error})
    },
    ...JOURNAL_RETRY_CONFIG.DEFAULT,
  })
}

/**
 * Hook to update an existing journal entry
 */
export function useUpdateJournalEntry() {
  const agent = useAgent()
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()
  
  return useMutation<JournalEntry, JournalError, UpdateJournalEntryInput>({
    mutationFn: async (input: UpdateJournalEntryInput): Promise<JournalEntry> => {
      if (!currentAccount) {
        throw createJournalError('PERMISSION_DENIED', 'Must be logged in to update journal entries')
      }

      try {
        // Use AT Protocol XRPC call for journal entry update
        const response = await agent.call(
          JOURNAL_API_CONFIG.JOURNAL_ENDPOINTS.UPDATE_ENTRY,
          'post',
          {
            repo: currentAccount.did,
            rkey: new AtUri(input.uri).rkey,
            record: {
              $type: 'xyz.tisocial.journal',
              ...input,
              updatedAt: new Date().toISOString(),
            },
          }
        )

        if (!response.success) {
          throw createJournalError('SERVER_ERROR', 'Failed to update journal entry')
        }

        // Get existing entry and merge with updates
        const existingEntry = queryClient.getQueryData<JournalEntry>(
          JOURNAL_QUERY_KEYS.entry(input.id)
        )

        const updatedEntry: JournalEntry = {
          ...existingEntry!,
          ...input,
          cid: response.cid,
          updatedAt: new Date().toISOString(),
        }

        return updatedEntry
      } catch (error) {
        logger.error('Failed to update journal entry', {input, error})
        
        if (error instanceof JournalError) {
          throw error
        }
        
        throw createJournalError('SERVER_ERROR', JOURNAL_ERROR_MESSAGES.SERVER_ERROR)
      }
    },
    onMutate: async (input) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({queryKey: JOURNAL_QUERY_KEYS.entry(input.id)})
      
      // Optimistically update entry
      const previousEntry = queryClient.getQueryData<JournalEntry>(
        JOURNAL_QUERY_KEYS.entry(input.id)
      )
      
      if (previousEntry) {
        const optimisticEntry = {
          ...previousEntry,
          ...input,
          updatedAt: new Date().toISOString(),
        }
        
        queryClient.setQueryData(
          JOURNAL_QUERY_KEYS.entry(input.id),
          optimisticEntry
        )
      }
      
      return {previousEntry}
    },
    onSuccess: (updatedEntry) => {
      // Update cache with real data
      queryClient.setQueryData(
        JOURNAL_QUERY_KEYS.entry(updatedEntry.id),
        updatedEntry
      )

      // Invalidate relevant caches
      CACHE_INVALIDATION_PATTERNS.ON_UPDATE_ENTRY.forEach(pattern => {
        queryClient.invalidateQueries({queryKey: [pattern]})
      })

      Toast.show('Journal entry updated successfully')
      logger.metric('journal:update:success', {
        entryId: updatedEntry.id,
        privacyLevel: updatedEntry.privacyLevel,
      })
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousEntry) {
        queryClient.setQueryData(
          JOURNAL_QUERY_KEYS.entry(variables.id),
          context.previousEntry
        )
      }

      Toast.show(error.userMessage || JOURNAL_ERROR_MESSAGES.UNKNOWN_ERROR)
      logger.error('Failed to update journal entry', {variables, error})
    },
    ...JOURNAL_RETRY_CONFIG.DEFAULT,
  })
}

/**
 * Hook to delete a journal entry
 */
export function useDeleteJournalEntry() {
  const agent = useAgent()
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()
  
  return useMutation<void, JournalError, DeleteJournalEntryInput>({
    mutationFn: async (input: DeleteJournalEntryInput): Promise<void> => {
      if (!currentAccount) {
        throw createJournalError('PERMISSION_DENIED', 'Must be logged in to delete journal entries')
      }

      try {
        // Use AT Protocol XRPC call for journal entry deletion
        if (input.permanent) {
          await agent.call(
            JOURNAL_API_CONFIG.JOURNAL_ENDPOINTS.DELETE_ENTRY,
            'post',
            {
              repo: currentAccount.did,
              rkey: new AtUri(input.uri).rkey,
              permanent: true,
            }
          )
        } else {
          // Soft delete - mark as deleted
          await agent.call(
            JOURNAL_API_CONFIG.JOURNAL_ENDPOINTS.UPDATE_ENTRY,
            'post',
            {
              repo: currentAccount.did,
              rkey: new AtUri(input.uri).rkey,
              record: {
                $type: 'xyz.tisocial.journal',
                isDeleted: true,
                deletedAt: new Date().toISOString(),
              },
            }
          )
        }
      } catch (error) {
        logger.error('Failed to delete journal entry', {input, error})
        
        if (error instanceof JournalError) {
          throw error
        }
        
        throw createJournalError('SERVER_ERROR', JOURNAL_ERROR_MESSAGES.SERVER_ERROR)
      }
    },
    onMutate: async (input) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({queryKey: JOURNAL_QUERY_KEYS.entry(input.id)})
      
      // Optimistically mark as deleted
      const previousEntry = queryClient.getQueryData<JournalEntry>(
        JOURNAL_QUERY_KEYS.entry(input.id)
      )
      
      if (previousEntry) {
        queryClient.setQueryData(
          JOURNAL_QUERY_KEYS.entry(input.id),
          {
            ...previousEntry,
            isDeleted: true,
            deletedAt: new Date().toISOString(),
          }
        )
      }
      
      return {previousEntry}
    },
    onSuccess: (_, variables) => {
      if (variables.permanent) {
        // Remove from cache completely
        queryClient.removeQueries({queryKey: JOURNAL_QUERY_KEYS.entry(variables.id)})
      }

      // Invalidate relevant caches
      CACHE_INVALIDATION_PATTERNS.ON_DELETE_ENTRY.forEach(pattern => {
        queryClient.invalidateQueries({queryKey: [pattern]})
      })

      Toast.show('Journal entry deleted successfully')
      logger.metric('journal:delete:success', {
        entryId: variables.id,
        permanent: variables.permanent,
      })
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousEntry) {
        queryClient.setQueryData(
          JOURNAL_QUERY_KEYS.entry(variables.id),
          context.previousEntry
        )
      }

      Toast.show(error.userMessage || JOURNAL_ERROR_MESSAGES.UNKNOWN_ERROR)
      logger.error('Failed to delete journal entry', {variables, error})
    },
    ...JOURNAL_RETRY_CONFIG.CRITICAL, // No retries for deletion
  })
}

/**
 * Hook to duplicate/copy a journal entry
 */
export function useDuplicateJournalEntry() {
  const createMutation = useCreateJournalEntry()
  const getEntry = useGetJournalEntry()
  
  return useMutation<JournalEntry, JournalError, {entryId: string; modifications?: Partial<CreateJournalEntryInput>}>({
    mutationFn: async ({entryId, modifications = {}}): Promise<JournalEntry> => {
      const originalEntry = getEntry(entryId)
      if (!originalEntry) {
        throw createJournalError('NETWORK_ERROR', 'Original entry not found')
      }

      const duplicateInput: CreateJournalEntryInput = {
        text: originalEntry.text,
        title: originalEntry.title ? `Copy of ${originalEntry.title}` : undefined,
        entryType: 'real_time', // Always create as real-time entry
        location: originalEntry.location,
        symptoms: originalEntry.symptoms.map(s => ({
          category: s.category,
          subcategory: s.subcategory,
          severity: s.severity,
          duration: s.duration,
          onset: s.onset,
          notes: s.notes,
        })),
        evidence: [], // Don't copy evidence for privacy/storage reasons
        sourceIds: originalEntry.sources.map(s => s.sourceId),
        tags: [...originalEntry.tags],
        privacyLevel: originalEntry.privacyLevel,
        allowComments: originalEntry.allowComments,
        allowSharing: originalEntry.allowSharing,
        requiresBadgeAccess: originalEntry.requiresBadgeAccess,
        triggerWarnings: originalEntry.triggerWarnings,
        isPHI: originalEntry.isPHI,
        ...modifications,
      }

      return createMutation.mutateAsync(duplicateInput)
    },
    onSuccess: () => {
      Toast.show('Journal entry duplicated successfully')
      logger.metric('journal:duplicate:success')
    },
    onError: (error) => {
      Toast.show(error.userMessage || 'Failed to duplicate journal entry')
      logger.error('Failed to duplicate journal entry', {error})
    },
  })
}