/**
 * Journal Privacy and Permission Management Hooks
 * 
 * Comprehensive privacy controls for journal entries with:
 * - Multi-level privacy validation
 * - Badge-based access control
 * - HIPAA compliance integration
 * - Real-time permission validation
 * - Privacy settings management
 */

import {useCallback, useMemo} from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import {useAgent, useSession} from '#/state/session'
import {STALE} from '#/state/queries'
import {logger} from '#/logger'

import type {
  JournalEntry,
  JournalPrivacyLevel,
  BadgeType,
  JournalError,
  JournalErrorType,
} from './types'
import {
  JOURNAL_QUERY_KEYS,
  JOURNAL_STALE_TIME,
  JOURNAL_RETRY_CONFIG,
} from './constants'

import {
  PrivacyAccessControlManager,
  HIPAAComplianceManager,
  SecurityEventMonitor,
  SecurityContext,
  PrivacyLevel,
  SecurityClassification,
} from '#/../../NPWA-atproto/packages/pds/src/journal-security'

// Initialize security managers
const accessManager = new PrivacyAccessControlManager()
const hipaaManager = HIPAAComplianceManager.getInstance()
const eventMonitor = new SecurityEventMonitor()

/**
 * Privacy settings for journal entries
 */
export interface JournalPrivacySettings {
  defaultPrivacy: JournalPrivacyLevel
  allowPublicSymptoms: boolean
  allowPublicLocation: boolean
  shareWithCommunity: boolean
  enableAnalytics: boolean
  dataRetentionDays?: number
  requireMFAForPHI: boolean
  autoEncryptSymptoms: boolean
  allowLocationSharing: boolean
  communityBadgeAccess: BadgeType[]
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  hasAccess: boolean
  reason?: string
  requiredPermissions?: string[]
  requiredBadges?: BadgeType[]
  requiresUpgrade?: boolean
  canRequest?: boolean
}

/**
 * Access request for private entries
 */
export interface AccessRequest {
  id: string
  entryId: string
  requesterId: string
  requesterHandle: string
  requesterDisplayName?: string
  message?: string
  status: 'pending' | 'approved' | 'denied'
  createdAt: string
  expiresAt?: string
}

/**
 * Create security context from session
 */
function createSecurityContext(currentAccount: any): SecurityContext {
  return {
    userDid: currentAccount?.did || '',
    sessionId: currentAccount?.accessJwt || crypto.randomUUID(),
    ipAddress: 'unknown',
    userAgent: 'TISocial-App',
    authLevel: currentAccount?.mfaEnabled ? 'mfa' : 'basic',
    permissions: currentAccount?.permissions || [],
  }
}\n\n/**\n * Hook to get user's journal privacy settings\n */\nexport function useJournalPrivacySettings() {\n  const {currentAccount} = useSession()\n  const agent = useAgent()\n\n  return useQuery<JournalPrivacySettings, JournalError>({\n    queryKey: JOURNAL_QUERY_KEYS.privacySettings(currentAccount?.did || ''),\n    queryFn: async (): Promise<JournalPrivacySettings> => {\n      if (!currentAccount) {\n        throw new Error('Authentication required') as JournalError\n      }\n\n      try {\n        // TODO: Replace with actual API call\n        const response = await agent.com.atproto.repo.getRecord({\n          repo: currentAccount.did,\n          collection: 'app.warlog.settings',\n          rkey: 'privacy',\n        })\n\n        return {\n          defaultPrivacy: response.value.defaultPrivacy || 'private',\n          allowPublicSymptoms: response.value.allowPublicSymptoms || false,\n          allowPublicLocation: response.value.allowPublicLocation || false,\n          shareWithCommunity: response.value.shareWithCommunity || false,\n          enableAnalytics: response.value.enableAnalytics || false,\n          dataRetentionDays: response.value.dataRetentionDays,\n          requireMFAForPHI: response.value.requireMFAForPHI || true,\n          autoEncryptSymptoms: response.value.autoEncryptSymptoms || true,\n          allowLocationSharing: response.value.allowLocationSharing || false,\n          communityBadgeAccess: response.value.communityBadgeAccess || [],\n        }\n      } catch (error: any) {\n        if (error.message?.includes('not found')) {\n          // Return default settings if none exist\n          return {\n            defaultPrivacy: 'private',\n            allowPublicSymptoms: false,\n            allowPublicLocation: false,\n            shareWithCommunity: false,\n            enableAnalytics: false,\n            requireMFAForPHI: true,\n            autoEncryptSymptoms: true,\n            allowLocationSharing: false,\n            communityBadgeAccess: [],\n          }\n        }\n        \n        logger.error('Failed to fetch privacy settings', {\n          error: error.message,\n          userDid: currentAccount.did,\n        })\n        throw error\n      }\n    },\n    enabled: !!currentAccount,\n    staleTime: STALE.MINUTES.THIRTY,\n    refetchOnWindowFocus: false,\n  })\n}\n\n/**\n * Hook to update journal privacy settings\n */\nexport function useUpdatePrivacySettings() {\n  const {currentAccount} = useSession()\n  const agent = useAgent()\n  const queryClient = useQueryClient()\n\n  return useMutation<JournalPrivacySettings, JournalError, Partial<JournalPrivacySettings>>({\n    mutationFn: async (updates): Promise<JournalPrivacySettings> => {\n      if (!currentAccount) {\n        throw new Error('Authentication required') as JournalError\n      }\n\n      try {\n        // Get current settings\n        const currentSettings = queryClient.getQueryData<JournalPrivacySettings>(\n          JOURNAL_QUERY_KEYS.privacySettings(currentAccount.did)\n        ) || {\n          defaultPrivacy: 'private' as JournalPrivacyLevel,\n          allowPublicSymptoms: false,\n          allowPublicLocation: false,\n          shareWithCommunity: false,\n          enableAnalytics: false,\n          requireMFAForPHI: true,\n          autoEncryptSymptoms: true,\n          allowLocationSharing: false,\n          communityBadgeAccess: [],\n        }\n\n        const updatedSettings = {\n          ...currentSettings,\n          ...updates,\n        }\n\n        // Validate privacy settings\n        const validation = validatePrivacySettings(updatedSettings)\n        if (!validation.isValid) {\n          throw new Error(validation.errors.join(', ')) as JournalError\n        }\n\n        // Update via AT Protocol\n        await agent.com.atproto.repo.putRecord({\n          repo: currentAccount.did,\n          collection: 'app.warlog.settings',\n          rkey: 'privacy',\n          record: {\n            $type: 'app.warlog.settings',\n            ...updatedSettings,\n            updatedAt: new Date().toISOString(),\n          },\n        })\n\n        logger.info('Privacy settings updated', {\n          userDid: currentAccount.did,\n          updates: Object.keys(updates),\n        })\n\n        return updatedSettings\n      } catch (error: any) {\n        logger.error('Failed to update privacy settings', {\n          error: error.message,\n          userDid: currentAccount.did,\n        })\n        throw error\n      }\n    },\n    onSuccess: (updatedSettings) => {\n      // Update cache\n      queryClient.setQueryData(\n        JOURNAL_QUERY_KEYS.privacySettings(currentAccount!.did),\n        updatedSettings\n      )\n\n      // Invalidate related caches if privacy defaults changed\n      if ('defaultPrivacy' in updatedSettings) {\n        queryClient.invalidateQueries({\n          queryKey: [JOURNAL_QUERY_KEYS.JOURNAL_FEED],\n        })\n      }\n    },\n  })\n}\n\n/**\n * Hook to check permissions for a specific journal entry\n */\nexport function useJournalPermissions(entryId: string | undefined, enabled: boolean = true) {\n  const {currentAccount} = useSession()\n  \n  return useQuery<PermissionCheckResult, JournalError>({\n    queryKey: JOURNAL_QUERY_KEYS.permissions(currentAccount?.did || '', entryId),\n    queryFn: async (): Promise<PermissionCheckResult> => {\n      if (!currentAccount || !entryId) {\n        return {\n          hasAccess: false,\n          reason: 'Authentication required',\n        }\n      }\n\n      try {\n        const securityContext = createSecurityContext(currentAccount)\n        \n        // Get the journal entry to check permissions for\n        const entry = queryClient.getQueryData<JournalEntry>(\n          JOURNAL_QUERY_KEYS.entry(entryId)\n        )\n\n        if (!entry) {\n          // Entry not in cache, need to fetch or assume no access\n          return {\n            hasAccess: false,\n            reason: 'Entry not found',\n          }\n        }\n\n        // Convert to secure entry format for access check\n        const secureEntry = {\n          uri: entry.uri,\n          author: {\n            did: entry.did,\n            handle: currentAccount.handle,\n            displayName: currentAccount.displayName,\n          },\n          privacyLevel: mapClientPrivacyToSecurity(entry.privacyLevel),\n          classification: entry.isPHI ? SecurityClassification.PHI : SecurityClassification.UNCLASSIFIED,\n          accessControlList: [], // TODO: Get from entry data\n        }\n\n        // Check access using security manager\n        const accessCheck = await accessManager.checkAccess(secureEntry as any, securityContext)\n        \n        // Monitor access attempt\n        eventMonitor.monitorAccess(securityContext, secureEntry as any)\n\n        return {\n          hasAccess: accessCheck.hasAccess,\n          reason: accessCheck.reason,\n          requiredPermissions: accessCheck.requiredPermissions,\n          canRequest: !accessCheck.hasAccess && entry.privacyLevel !== 'public',\n        }\n      } catch (error: any) {\n        logger.error('Failed to check entry permissions', {\n          entryId,\n          error: error.message,\n          userDid: currentAccount.did,\n        })\n\n        return {\n          hasAccess: false,\n          reason: 'Permission check failed',\n        }\n      }\n    },\n    enabled: enabled && !!currentAccount && !!entryId,\n    staleTime: STALE.MINUTES.FIVE,\n    ...JOURNAL_RETRY_CONFIG.DEFAULT,\n  })\n}\n\n/**\n * Hook to check if user has specific badges\n */\nexport function useUserBadges() {\n  const {currentAccount} = useSession()\n  const agent = useAgent()\n\n  return useQuery<Array<{type: BadgeType; verified: boolean; verifiedAt?: string}>, JournalError>({\n    queryKey: JOURNAL_QUERY_KEYS.userBadges(currentAccount?.did || ''),\n    queryFn: async () => {\n      if (!currentAccount) {\n        throw new Error('Authentication required') as JournalError\n      }\n\n      try {\n        // TODO: Replace with actual badge verification API\n        const response = await agent.com.atproto.repo.listRecords({\n          repo: currentAccount.did,\n          collection: 'app.warlog.badges',\n        })\n\n        return response.data.records.map((record: any) => ({\n          type: record.value.badgeType,\n          verified: record.value.verified || false,\n          verifiedAt: record.value.verifiedAt,\n        }))\n      } catch (error: any) {\n        if (error.message?.includes('not found')) {\n          return [] // No badges\n        }\n        \n        logger.error('Failed to fetch user badges', {\n          error: error.message,\n          userDid: currentAccount.did,\n        })\n        throw error\n      }\n    },\n    enabled: !!currentAccount,\n    staleTime: STALE.MINUTES.THIRTY,\n  })\n}\n\n/**\n * Hook to request access to a private entry\n */\nexport function useRequestEntryAccess() {\n  const {currentAccount} = useSession()\n  const agent = useAgent()\n  const queryClient = useQueryClient()\n\n  return useMutation<AccessRequest, JournalError, {entryId: string; message?: string}>({\n    mutationFn: async ({entryId, message}): Promise<AccessRequest> => {\n      if (!currentAccount) {\n        throw new Error('Authentication required') as JournalError\n      }\n\n      try {\n        const accessRequest: AccessRequest = {\n          id: crypto.randomUUID(),\n          entryId,\n          requesterId: currentAccount.did,\n          requesterHandle: currentAccount.handle,\n          requesterDisplayName: currentAccount.displayName,\n          message,\n          status: 'pending',\n          createdAt: new Date().toISOString(),\n          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days\n        }\n\n        // TODO: Send access request via AT Protocol\n        await agent.com.atproto.repo.createRecord({\n          repo: currentAccount.did,\n          collection: 'app.warlog.accessRequest',\n          record: {\n            $type: 'app.warlog.accessRequest',\n            ...accessRequest,\n          },\n        })\n\n        logger.info('Access request sent', {\n          entryId,\n          requesterId: currentAccount.did,\n        })\n\n        return accessRequest\n      } catch (error: any) {\n        logger.error('Failed to send access request', {\n          entryId,\n          error: error.message,\n          userDid: currentAccount.did,\n        })\n        throw error\n      }\n    },\n    onSuccess: () => {\n      // Refresh access requests\n      queryClient.invalidateQueries({\n        queryKey: [JOURNAL_QUERY_KEYS.ACCESS_REQUESTS],\n      })\n    },\n  })\n}\n\n/**\n * Hook to get pending access requests for user's entries\n */\nexport function useAccessRequests() {\n  const {currentAccount} = useSession()\n  const agent = useAgent()\n\n  return useQuery<AccessRequest[], JournalError>({\n    queryKey: JOURNAL_QUERY_KEYS.accessRequests(currentAccount?.did || ''),\n    queryFn: async (): Promise<AccessRequest[]> => {\n      if (!currentAccount) {\n        throw new Error('Authentication required') as JournalError\n      }\n\n      try {\n        // TODO: Fetch access requests for user's entries\n        const response = await agent.com.atproto.repo.listRecords({\n          repo: currentAccount.did,\n          collection: 'app.warlog.accessRequest',\n        })\n\n        return response.data.records\n          .map((record: any) => record.value as AccessRequest)\n          .filter((request: AccessRequest) => request.status === 'pending')\n          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())\n      } catch (error: any) {\n        if (error.message?.includes('not found')) {\n          return []\n        }\n        \n        logger.error('Failed to fetch access requests', {\n          error: error.message,\n          userDid: currentAccount.did,\n        })\n        throw error\n      }\n    },\n    enabled: !!currentAccount,\n    staleTime: STALE.MINUTES.FIVE,\n    refetchInterval: STALE.MINUTES.FIVE,\n  })\n}\n\n/**\n * Hook to respond to access requests\n */\nexport function useRespondToAccessRequest() {\n  const {currentAccount} = useSession()\n  const agent = useAgent()\n  const queryClient = useQueryClient()\n\n  return useMutation<AccessRequest, JournalError, {requestId: string; approve: boolean; message?: string}>({\n    mutationFn: async ({requestId, approve, message}): Promise<AccessRequest> => {\n      if (!currentAccount) {\n        throw new Error('Authentication required') as JournalError\n      }\n\n      try {\n        // Get the access request\n        const accessRequests = queryClient.getQueryData<AccessRequest[]>(\n          JOURNAL_QUERY_KEYS.accessRequests(currentAccount.did)\n        ) || []\n        \n        const request = accessRequests.find(r => r.id === requestId)\n        if (!request) {\n          throw new Error('Access request not found')\n        }\n\n        const updatedRequest: AccessRequest = {\n          ...request,\n          status: approve ? 'approved' : 'denied',\n        }\n\n        // TODO: Update access request status\n        await agent.com.atproto.repo.putRecord({\n          repo: currentAccount.did,\n          collection: 'app.warlog.accessRequest',\n          rkey: requestId,\n          record: {\n            $type: 'app.warlog.accessRequest',\n            ...updatedRequest,\n          },\n        })\n\n        // If approved, add to entry's access control list\n        if (approve) {\n          // TODO: Update entry's access control list\n        }\n\n        logger.info('Access request responded to', {\n          requestId,\n          approve,\n          userDid: currentAccount.did,\n        })\n\n        return updatedRequest\n      } catch (error: any) {\n        logger.error('Failed to respond to access request', {\n          requestId,\n          error: error.message,\n          userDid: currentAccount.did,\n        })\n        throw error\n      }\n    },\n    onSuccess: () => {\n      // Refresh access requests\n      queryClient.invalidateQueries({\n        queryKey: [JOURNAL_QUERY_KEYS.ACCESS_REQUESTS],\n      })\n    },\n  })\n}\n\n/**\n * Hook to validate HIPAA compliance for an entry\n */\nexport function useValidateHIPAACompliance() {\n  return useCallback(async (entry: Partial<JournalEntry>) => {\n    try {\n      // Convert to secure entry format\n      const secureEntry = {\n        uri: entry.uri || '',\n        cid: entry.cid || '',\n        content: {\n          text: entry.text || '',\n          isEncrypted: false,\n          encryptionLevel: 'none' as any,\n        },\n        privacyLevel: mapClientPrivacyToSecurity(entry.privacyLevel),\n        classification: entry.isPHI ? SecurityClassification.PHI : SecurityClassification.UNCLASSIFIED,\n        symptoms: entry.symptoms ? {\n          encrypted: false,\n          data: JSON.stringify(entry.symptoms),\n        } : undefined,\n        location: entry.location ? {\n          encrypted: false,\n          data: JSON.stringify(entry.location),\n        } : undefined,\n      }\n\n      return hipaaManager.validateHIPAACompliance(secureEntry as any)\n    } catch (error: any) {\n      logger.error('HIPAA validation failed', {\n        error: error.message,\n        entryId: entry.id,\n      })\n      \n      return {\n        isCompliant: false,\n        violations: ['Validation error occurred'],\n        recommendations: ['Please try again'],\n      }\n    }\n  }, [])\n}\n\n// Helper functions\n\nfunction mapClientPrivacyToSecurity(privacy: any): PrivacyLevel {\n  switch (privacy) {\n    case 'public': return PrivacyLevel.PUBLIC\n    case 'contacts': return PrivacyLevel.PRIVATE\n    case 'badge_community': return PrivacyLevel.COMMUNITY\n    case 'private': return PrivacyLevel.PRIVATE\n    case 'anonymous': return PrivacyLevel.ANONYMOUS\n    default: return PrivacyLevel.PRIVATE\n  }\n}\n\nfunction validatePrivacySettings(settings: JournalPrivacySettings): {\n  isValid: boolean\n  errors: string[]\n} {\n  const errors: string[] = []\n\n  // Validate default privacy level\n  if (!settings.defaultPrivacy) {\n    errors.push('Default privacy level is required')\n  }\n\n  // Validate medical data settings\n  if (settings.allowPublicSymptoms && !settings.requireMFAForPHI) {\n    errors.push('Multi-factor authentication is required when allowing public symptoms')\n  }\n\n  // Validate data retention\n  if (settings.dataRetentionDays !== undefined) {\n    if (settings.dataRetentionDays < 1 || settings.dataRetentionDays > 365 * 10) {\n      errors.push('Data retention must be between 1 day and 10 years')\n    }\n  }\n\n  return {\n    isValid: errors.length === 0,\n    errors,\n  }\n}"