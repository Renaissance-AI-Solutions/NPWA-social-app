/**
 * Cross-Package Type Compatibility Tests for Journal System
 * 
 * Validates TypeScript type generation from lexicon schemas,
 * frontend-backend type consistency, and cross-platform compatibility.
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import {
  AppBskyFeedDefs,
  AtpAgent,
  ComAtprotoRepoCreateRecord,
  ComAtprotoRepoGetRecord,
} from '@atproto/api'
import type {
  JournalEntry,
  CreateJournalEntryData,
  UpdateJournalEntryData,
  JournalEntryFilters,
  JournalStats,
} from '../../src/types/journal'
import {
  createMockJournalEntry,
  createMockBackdatedEntry,
  generateJournalEntries,
} from '../mocks/journal-data'

// Mock the generated lexicon types to test compatibility
interface MockAppWarlogJournal {
  $type: 'app.warlog.journal'
  text: string
  entryType: 'real_time' | 'backdated'
  privacyLevel: 'public' | 'community' | 'private' | 'medical' | 'legal' | 'anonymous'
  classification: 'unclassified' | 'sensitive' | 'phi' | 'legal_evidence' | 'whistleblower'
  content: {
    text: string
    isEncrypted: boolean
    encryptionLevel: 'none' | 'standard' | 'enhanced' | 'quantum_resistant'
    encryptionMetadata?: {
      algorithm: string
      keyId: string
      iv: string
      salt: string
      signature: string
    }
  }
  createdAt: string
  incidentTimestamp?: string
  accessControlList?: string[]
  communityBadges?: string[]
  location?: {
    encrypted: boolean
    data: string
    accuracy?: number
    address?: string
  }
  symptoms?: {
    encrypted: boolean
    data: string
    count: number
  }
  evidenceUris?: string[]
  sourceIds?: string[]
  tags?: string[]
  legalHoldStatus?: boolean
  anonymousMode?: boolean
  sourceProtection?: boolean
  accessCount?: number
}

// Type compatibility mapping
type LexiconToFrontendMapping = {
  'app.warlog.journal': JournalEntry
}

describe('Journal Type Compatibility', () => {
  describe('Lexicon to Frontend Type Mapping', () => {
    it('validates basic type structure compatibility', () => {
      const mockLexiconEntry: MockAppWarlogJournal = {
        $type: 'app.warlog.journal',
        text: 'Test journal entry',
        entryType: 'real_time',
        privacyLevel: 'public',
        classification: 'unclassified',
        content: {
          text: 'Test journal entry',
          isEncrypted: false,
          encryptionLevel: 'none',
        },
        createdAt: new Date().toISOString(),
      }

      const frontendEntry = createMockJournalEntry({
        text: mockLexiconEntry.text,
        entryType: mockLexiconEntry.entryType,
        privacyLevel: mockLexiconEntry.privacyLevel,
        isPrivate: mockLexiconEntry.privacyLevel !== 'public',
      })

      // Verify structural compatibility
      expect(typeof frontendEntry.text).toBe('string')
      expect(typeof frontendEntry.entryType).toBe('string')
      expect(typeof frontendEntry.createdAt).toBe('string')
      expect(typeof frontendEntry.uri).toBe('string')
      expect(typeof frontendEntry.cid).toBe('string')
      
      // Verify enum compatibility
      expect(['real_time', 'backdated']).toContain(frontendEntry.entryType)
      expect(['public', 'community', 'private', 'medical', 'legal', 'anonymous'])
        .toContain(mockLexiconEntry.privacyLevel)
    })

    it('validates encrypted content type compatibility', () => {
      const encryptedLexiconEntry: MockAppWarlogJournal = {
        $type: 'app.warlog.journal',
        text: 'Encrypted test entry',
        entryType: 'real_time',
        privacyLevel: 'medical',
        classification: 'phi',
        content: {
          text: 'Encrypted test entry',
          isEncrypted: true,
          encryptionLevel: 'enhanced',
          encryptionMetadata: {
            algorithm: 'AES-256-CBC',
            keyId: 'test-key-123',
            iv: 'test-iv-123',
            salt: 'test-salt-123',
            signature: 'test-signature-123',
          },
        },
        symptoms: {
          encrypted: true,
          data: 'encrypted-symptoms-data',
          count: 3,
        },
        createdAt: new Date().toISOString(),
      }

      const frontendEntry = createMockJournalEntry({
        text: encryptedLexiconEntry.text,
        entryType: encryptedLexiconEntry.entryType,
        privacyLevel: encryptedLexiconEntry.privacyLevel,
        isPrivate: true,
        isEncrypted: true,
      })

      // Verify encryption metadata compatibility
      expect(encryptedLexiconEntry.content.isEncrypted).toBe(true)
      expect(encryptedLexiconEntry.content.encryptionMetadata).toBeDefined()
      expect(encryptedLexiconEntry.symptoms?.encrypted).toBe(true)
      
      // Frontend should handle encrypted state
      expect(frontendEntry.isEncrypted).toBe(true)
      expect(frontendEntry.isPrivate).toBe(true)
    })

    it('validates backdated entry type compatibility', () => {
      const backdatedLexiconEntry: MockAppWarlogJournal = {
        $type: 'app.warlog.journal',
        text: 'Backdated incident report',
        entryType: 'backdated',
        privacyLevel: 'private',
        classification: 'sensitive',
        content: {
          text: 'Backdated incident report',
          isEncrypted: true,
          encryptionLevel: 'standard',
        },
        createdAt: new Date().toISOString(),
        incidentTimestamp: new Date(Date.now() - 86400000).toISOString(),
      }

      const frontendEntry = createMockBackdatedEntry({
        text: backdatedLexiconEntry.text,
        incidentDate: new Date(backdatedLexiconEntry.incidentTimestamp!),
      })

      // Verify backdated entry compatibility
      expect(frontendEntry.entryType).toBe('backdated')
      expect(frontendEntry.incidentDate).toBeInstanceOf(Date)
      expect(frontendEntry.incidentDate?.getTime()).toBeLessThan(Date.now())
      expect(backdatedLexiconEntry.entryType).toBe('backdated')
      expect(backdatedLexiconEntry.incidentTimestamp).toBeDefined()
    })

    it('validates array field type compatibility', () => {
      const complexLexiconEntry: MockAppWarlogJournal = {
        $type: 'app.warlog.journal',
        text: 'Complex entry with arrays',
        entryType: 'real_time',
        privacyLevel: 'legal',
        classification: 'legal_evidence',
        content: {
          text: 'Complex entry with arrays',
          isEncrypted: true,
          encryptionLevel: 'enhanced',
        },
        accessControlList: ['did:example:user1', 'did:example:user2'],
        communityBadges: ['havana', 'gangstalked'],
        evidenceUris: [
          'at://did:example:evidence/app.warlog.document/doc1',
          'at://did:example:evidence/app.warlog.document/doc2',
        ],
        sourceIds: ['source-1', 'source-2'],
        tags: ['legal', 'evidence', 'harassment'],
        createdAt: new Date().toISOString(),
      }

      const frontendEntry = createMockJournalEntry({
        text: complexLexiconEntry.text,
        entryType: complexLexiconEntry.entryType,
        privacyLevel: complexLexiconEntry.privacyLevel,
        evidenceUris: complexLexiconEntry.evidenceUris,
        sourceIds: complexLexiconEntry.sourceIds,
        tags: complexLexiconEntry.tags,
      })

      // Verify array field compatibility
      expect(Array.isArray(complexLexiconEntry.accessControlList)).toBe(true)
      expect(Array.isArray(complexLexiconEntry.evidenceUris)).toBe(true)
      expect(Array.isArray(complexLexiconEntry.sourceIds)).toBe(true)
      expect(Array.isArray(complexLexiconEntry.tags)).toBe(true)
      
      expect(Array.isArray(frontendEntry.evidenceUris)).toBe(true)
      expect(Array.isArray(frontendEntry.sourceIds)).toBe(true)
      expect(Array.isArray(frontendEntry.tags)).toBe(true)
      
      // Verify array content types
      complexLexiconEntry.evidenceUris?.forEach(uri => {
        expect(typeof uri).toBe('string')
        expect(uri).toMatch(/^at:\/\/|^https?:\/\//)
      })
      
      frontendEntry.evidenceUris?.forEach(uri => {
        expect(typeof uri).toBe('string')
      })
    })
  })

  describe('CRUD Operation Type Compatibility', () => {
    it('validates CreateJournalEntryData type compatibility', () => {
      const createData: CreateJournalEntryData = {
        text: 'New journal entry',
        entryType: 'real_time',
        isPrivate: false,
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
        symptoms: [
          { id: '1', name: 'Headache', severity: 3 },
          { id: '2', name: 'Nausea', severity: 2 },
        ],
        evidenceUris: ['at://did:example:evidence/app.warlog.document/evidence1'],
        sourceIds: ['source-news-001'],
        tags: ['harassment', 'surveillance'],
        incidentDate: new Date(),
      }

      // Verify all required fields are present
      expect(typeof createData.text).toBe('string')
      expect(['real_time', 'backdated']).toContain(createData.entryType)
      expect(typeof createData.isPrivate).toBe('boolean')
      
      // Verify optional fields have correct types
      if (createData.location) {
        expect(typeof createData.location.latitude).toBe('number')
        expect(typeof createData.location.longitude).toBe('number')
      }
      
      if (createData.symptoms) {
        expect(Array.isArray(createData.symptoms)).toBe(true)
        createData.symptoms.forEach(symptom => {
          expect(typeof symptom.id).toBe('string')
          expect(typeof symptom.name).toBe('string')
          expect(typeof symptom.severity).toBe('number')
        })
      }
    })

    it('validates UpdateJournalEntryData type compatibility', () => {
      const updateData: UpdateJournalEntryData = {
        uri: 'at://did:example:alice/app.warlog.journal/test123',
        text: 'Updated journal entry text',
        isPrivate: true,
        tags: ['updated', 'harassment'],
        evidenceUris: [
          'at://did:example:evidence/app.warlog.document/new-evidence',
        ],
      }

      // Verify required update fields
      expect(typeof updateData.uri).toBe('string')
      expect(updateData.uri).toMatch(/^at:\/\//)
      
      // Verify optional update fields
      if (updateData.text) {
        expect(typeof updateData.text).toBe('string')
      }
      
      if (updateData.isPrivate !== undefined) {
        expect(typeof updateData.isPrivate).toBe('boolean')
      }
      
      if (updateData.tags) {
        expect(Array.isArray(updateData.tags)).toBe(true)
        updateData.tags.forEach(tag => {
          expect(typeof tag).toBe('string')
        })
      }
    })

    it('validates JournalEntryFilters type compatibility', () => {
      const filters: JournalEntryFilters = {
        entryType: 'real_time',
        privacy: 'private',
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
        tags: ['harassment', 'surveillance'],
        hasLocation: true,
        hasSymptoms: true,
        hasEvidence: true,
        searchText: 'incident report',
      }

      // Verify filter field types
      if (filters.entryType) {
        expect(['real_time', 'backdated']).toContain(filters.entryType)
      }
      
      if (filters.privacy) {
        expect(['public', 'private', 'community', 'medical', 'legal'])
          .toContain(filters.privacy)
      }
      
      if (filters.dateRange) {
        expect(filters.dateRange.start).toBeInstanceOf(Date)
        expect(filters.dateRange.end).toBeInstanceOf(Date)
      }
      
      if (filters.tags) {
        expect(Array.isArray(filters.tags)).toBe(true)
        filters.tags.forEach(tag => {
          expect(typeof tag).toBe('string')
        })
      }
      
      if (filters.hasLocation !== undefined) {
        expect(typeof filters.hasLocation).toBe('boolean')
      }
    })

    it('validates JournalStats type compatibility', () => {
      const stats: JournalStats = {
        totalEntries: 42,
        publicEntries: 15,
        privateEntries: 20,
        communityEntries: 5,
        medicalEntries: 2,
        realTimeEntries: 35,
        backdatedEntries: 7,
        entriesWithLocation: 30,
        entriesWithSymptoms: 12,
        entriesWithEvidence: 8,
        totalSymptoms: 45,
        averageEntriesPerWeek: 2.5,
        encryptedEntries: 25,
        tagDistribution: {
          harassment: 20,
          surveillance: 15,
          medical: 8,
          legal: 5,
        },
        privacyDistribution: {
          public: 15,
          private: 20,
          community: 5,
          medical: 2,
        },
        weeklyTrend: [
          { week: '2024-W01', count: 3 },
          { week: '2024-W02', count: 5 },
          { week: '2024-W03', count: 2 },
        ],
      }

      // Verify numeric statistics
      expect(typeof stats.totalEntries).toBe('number')
      expect(typeof stats.publicEntries).toBe('number')
      expect(typeof stats.privateEntries).toBe('number')
      expect(typeof stats.realTimeEntries).toBe('number')
      expect(typeof stats.backdatedEntries).toBe('number')
      
      // Verify calculated statistics
      expect(typeof stats.averageEntriesPerWeek).toBe('number')
      expect(stats.averageEntriesPerWeek).toBeGreaterThan(0)
      
      // Verify distribution objects
      expect(typeof stats.tagDistribution).toBe('object')
      Object.entries(stats.tagDistribution).forEach(([tag, count]) => {
        expect(typeof tag).toBe('string')
        expect(typeof count).toBe('number')
      })
      
      expect(typeof stats.privacyDistribution).toBe('object')
      Object.entries(stats.privacyDistribution).forEach(([privacy, count]) => {
        expect(typeof privacy).toBe('string')
        expect(typeof count).toBe('number')
      })
      
      // Verify trend array
      expect(Array.isArray(stats.weeklyTrend)).toBe(true)
      stats.weeklyTrend.forEach(trend => {
        expect(typeof trend.week).toBe('string')
        expect(typeof trend.count).toBe('number')
        expect(trend.week).toMatch(/^\d{4}-W\d{2}$/)
      })
    })
  })

  describe('AT Protocol API Compatibility', () => {
    it('validates AT Protocol record structure compatibility', () => {
      const frontendEntry = createMockJournalEntry()
      
      // Transform frontend entry to AT Protocol record format
      const atProtoRecord: ComAtprotoRepoCreateRecord.InputSchema = {
        repo: 'did:example:alice',
        collection: 'app.warlog.journal',
        record: {
          $type: 'app.warlog.journal',
          text: frontendEntry.text,
          entryType: frontendEntry.entryType,
          privacyLevel: frontendEntry.isPrivate ? 'private' : 'public',
          classification: frontendEntry.isPrivate ? 'sensitive' : 'unclassified',
          content: {
            text: frontendEntry.text,
            isEncrypted: frontendEntry.isEncrypted || false,
            encryptionLevel: frontendEntry.isEncrypted ? 'standard' : 'none',
          },
          createdAt: frontendEntry.createdAt,
          ...(frontendEntry.incidentDate && {
            incidentTimestamp: frontendEntry.incidentDate.toISOString(),
          }),
          ...(frontendEntry.evidenceUris && {
            evidenceUris: frontendEntry.evidenceUris,
          }),
          ...(frontendEntry.sourceIds && {
            sourceIds: frontendEntry.sourceIds,
          }),
          ...(frontendEntry.tags && {
            tags: frontendEntry.tags,
          }),
        },
      }

      // Verify AT Protocol compatibility
      expect(atProtoRecord.repo).toMatch(/^did:/)
      expect(atProtoRecord.collection).toBe('app.warlog.journal')
      expect(atProtoRecord.record.$type).toBe('app.warlog.journal')
      expect(typeof atProtoRecord.record.text).toBe('string')
      expect(typeof atProtoRecord.record.createdAt).toBe('string')
    })

    it('validates AT Protocol response type compatibility', () => {
      // Mock AT Protocol response
      const atProtoResponse: ComAtprotoRepoGetRecord.OutputSchema = {
        uri: 'at://did:example:alice/app.warlog.journal/test123',
        cid: 'bafkreitestcid123',
        value: {
          $type: 'app.warlog.journal',
          text: 'Test journal entry from AT Proto',
          entryType: 'real_time',
          privacyLevel: 'public',
          classification: 'unclassified',
          content: {
            text: 'Test journal entry from AT Proto',
            isEncrypted: false,
            encryptionLevel: 'none',
          },
          createdAt: new Date().toISOString(),
        } as MockAppWarlogJournal,
      }

      // Transform to frontend type
      const record = atProtoResponse.value as MockAppWarlogJournal
      const frontendEntry: JournalEntry = {
        uri: atProtoResponse.uri,
        cid: atProtoResponse.cid,
        text: record.text,
        entryType: record.entryType,
        createdAt: record.createdAt,
        isPrivate: record.privacyLevel !== 'public',
        isEncrypted: record.content.isEncrypted,
        author: {
          did: 'did:example:alice',
          handle: 'alice.test',
          displayName: 'Alice Test',
        },
        ...(record.incidentTimestamp && {
          incidentDate: new Date(record.incidentTimestamp),
        }),
        ...(record.evidenceUris && {
          evidenceUris: record.evidenceUris,
        }),
        ...(record.sourceIds && {
          sourceIds: record.sourceIds,
        }),
        ...(record.tags && {
          tags: record.tags,
        }),
      }

      // Verify transformation compatibility
      expect(frontendEntry.uri).toBe(atProtoResponse.uri)
      expect(frontendEntry.cid).toBe(atProtoResponse.cid)
      expect(frontendEntry.text).toBe(record.text)
      expect(frontendEntry.entryType).toBe(record.entryType)
      expect(frontendEntry.isPrivate).toBe(record.privacyLevel !== 'public')
      expect(frontendEntry.isEncrypted).toBe(record.content.isEncrypted)
    })
  })

  describe('Cross-Platform Type Consistency', () => {
    it('validates type consistency across web and mobile platforms', () => {
      const entry = createMockJournalEntry()
      
      // Simulate serialization for cross-platform transfer
      const serialized = JSON.stringify(entry)
      const deserialized: JournalEntry = JSON.parse(serialized)
      
      // Verify serialization preserves types
      expect(deserialized.uri).toBe(entry.uri)
      expect(deserialized.text).toBe(entry.text)
      expect(deserialized.entryType).toBe(entry.entryType)
      expect(deserialized.isPrivate).toBe(entry.isPrivate)
      expect(deserialized.isEncrypted).toBe(entry.isEncrypted)
      
      // Verify date handling across platforms
      if (entry.incidentDate) {
        expect(typeof deserialized.createdAt).toBe('string')
        expect(new Date(deserialized.createdAt)).toBeInstanceOf(Date)
      }
      
      // Verify array preservation
      if (entry.tags) {
        expect(Array.isArray(deserialized.tags)).toBe(true)
        expect(deserialized.tags).toEqual(entry.tags)
      }
    })

    it('validates React Native specific type handling', () => {
      // Test types that might behave differently in React Native
      const entry = createMockJournalEntry({
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
        symptoms: [
          { id: '1', name: 'Headache', severity: 3 },
          { id: '2', name: 'Dizziness', severity: 2 },
        ],
      })
      
      // Simulate React Native bridge serialization
      const bridgeData = {
        ...entry,
        createdAt: entry.createdAt,
        incidentDate: entry.incidentDate?.toISOString(),
        location: entry.location ? {
          latitude: String(entry.location.latitude),
          longitude: String(entry.location.longitude),
          accuracy: String(entry.location.accuracy),
        } : undefined,
      }
      
      // Verify type coercion handling
      if (bridgeData.location) {
        expect(typeof bridgeData.location.latitude).toBe('string')
        expect(typeof bridgeData.location.longitude).toBe('string')
        expect(Number(bridgeData.location.latitude)).toBe(entry.location!.latitude)
        expect(Number(bridgeData.location.longitude)).toBe(entry.location!.longitude)
      }
      
      if (bridgeData.incidentDate) {
        expect(typeof bridgeData.incidentDate).toBe('string')
        expect(new Date(bridgeData.incidentDate)).toBeInstanceOf(Date)
      }
    })
  })

  describe('Error Type Compatibility', () => {
    it('validates error response type handling', () => {
      // Mock error responses from different layers
      const atProtoError = {
        error: 'InvalidRequest',
        message: 'Invalid journal entry format',
        details: {
          field: 'privacyLevel',
          reason: 'Unknown privacy level value',
        },
      }
      
      const networkError = {
        name: 'NetworkError',
        message: 'Failed to fetch journal entries',
        code: 'NETWORK_ERROR',
      }
      
      const validationError = {
        name: 'ValidationError',
        message: 'Journal entry validation failed',
        errors: [
          { field: 'text', message: 'Text is required' },
          { field: 'entryType', message: 'Invalid entry type' },
        ],
      }
      
      // Verify error structure compatibility
      expect(typeof atProtoError.error).toBe('string')
      expect(typeof atProtoError.message).toBe('string')
      expect(typeof atProtoError.details).toBe('object')
      
      expect(typeof networkError.name).toBe('string')
      expect(typeof networkError.message).toBe('string')
      expect(typeof networkError.code).toBe('string')
      
      expect(typeof validationError.name).toBe('string')
      expect(typeof validationError.message).toBe('string')
      expect(Array.isArray(validationError.errors)).toBe(true)
      
      validationError.errors.forEach(error => {
        expect(typeof error.field).toBe('string')
        expect(typeof error.message).toBe('string')
      })
    })

    it('validates type guard functions', () => {
      // Type guard for JournalEntry
      const isJournalEntry = (obj: any): obj is JournalEntry => {
        return (
          typeof obj === 'object' &&
          obj !== null &&
          typeof obj.uri === 'string' &&
          typeof obj.cid === 'string' &&
          typeof obj.text === 'string' &&
          typeof obj.entryType === 'string' &&
          typeof obj.createdAt === 'string' &&
          typeof obj.isPrivate === 'boolean' &&
          typeof obj.author === 'object'
        )
      }
      
      const validEntry = createMockJournalEntry()
      const invalidEntry = { uri: 'test', invalid: true }
      
      expect(isJournalEntry(validEntry)).toBe(true)
      expect(isJournalEntry(invalidEntry)).toBe(false)
      expect(isJournalEntry(null)).toBe(false)
      expect(isJournalEntry(undefined)).toBe(false)
      expect(isJournalEntry('string')).toBe(false)
      
      // Type guard for CreateJournalEntryData
      const isCreateJournalEntryData = (obj: any): obj is CreateJournalEntryData => {
        return (
          typeof obj === 'object' &&
          obj !== null &&
          typeof obj.text === 'string' &&
          typeof obj.entryType === 'string' &&
          typeof obj.isPrivate === 'boolean'
        )
      }
      
      const validCreateData: CreateJournalEntryData = {
        text: 'Test entry',
        entryType: 'real_time',
        isPrivate: false,
      }
      
      const invalidCreateData = {
        text: 'Test entry',
        // Missing required fields
      }
      
      expect(isCreateJournalEntryData(validCreateData)).toBe(true)
      expect(isCreateJournalEntryData(invalidCreateData)).toBe(false)
    })
  })

  describe('Performance Type Handling', () => {
    it('validates large dataset type handling', () => {
      const largeEntryList = generateJournalEntries(1000)
      
      // Verify all entries maintain type consistency
      largeEntryList.forEach(entry => {
        expect(typeof entry.uri).toBe('string')
        expect(typeof entry.text).toBe('string')
        expect(typeof entry.entryType).toBe('string')
        expect(typeof entry.createdAt).toBe('string')
        expect(typeof entry.isPrivate).toBe('boolean')
        expect(entry.author).toBeDefined()
        expect(typeof entry.author.did).toBe('string')
      })
      
      // Verify serialization performance with types
      const startTime = Date.now()
      const serialized = JSON.stringify(largeEntryList)
      const deserialized: JournalEntry[] = JSON.parse(serialized)
      const serializationTime = Date.now() - startTime
      
      expect(serializationTime).toBeLessThan(1000) // Under 1 second
      expect(deserialized).toHaveLength(1000)
      expect(deserialized[0]).toEqual(largeEntryList[0])
    })

    it('validates memory efficient type structures', () => {
      // Test that type structures don't create memory leaks
      const entries: JournalEntry[] = []
      
      for (let i = 0; i < 100; i++) {
        const entry = createMockJournalEntry({
          text: `Entry ${i}`,
        })
        entries.push(entry)
      }
      
      // Verify no circular references
      expect(() => JSON.stringify(entries)).not.toThrow()
      
      // Verify shallow vs deep equality
      const entry1 = createMockJournalEntry({ text: 'Test' })
      const entry2 = createMockJournalEntry({ text: 'Test' })
      
      expect(entry1).not.toBe(entry2) // Different references
      expect(entry1.text).toBe(entry2.text) // Same content
      expect(entry1.author).not.toBe(entry2.author) // Different author references
    })
  })
})
