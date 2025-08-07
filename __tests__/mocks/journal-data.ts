import {JournalEntry, JournalDraft} from '../../src/state/queries/journal'
import {type Source} from '../../src/components/SourcePicker'

/**
 * Test data factory for journal entries
 * Provides consistent, realistic test data with proper typing
 */

export const createMockJournalEntry = (overrides?: Partial<JournalEntry>): JournalEntry => ({
  uri: 'at://did:example:alice/app.warlog.journal/test123',
  cid: 'bafkreicidcfexample123',
  text: 'Test journal entry documenting an incident with detailed observations',
  entryType: 'real_time',
  createdAt: '2024-01-15T10:30:00Z',
  incidentTimestamp: '2024-01-15T10:25:00Z',
  location: {
    latitude: 40.7128,
    longitude: -74.0060,
    accuracy: 10,
    address: 'New York, NY, USA',
  },
  symptoms: [
    {
      category: 'physical_pain',
      severity: 7,
      notes: 'Sharp headache in temporal region',
    },
    {
      category: 'neurological',
      severity: 5,
      notes: 'Dizziness and vertigo symptoms',
    },
  ],
  tags: ['incident', 'surveillance', 'directed_energy'],
  sourceIds: ['source-1', 'source-2'],
  isPrivate: false,
  author: {
    did: 'did:example:alice',
    handle: 'alice.test',
    displayName: 'Alice Test',
    avatar: 'https://example.com/avatar.jpg',
  },
  indexedAt: '2024-01-15T10:30:05Z',
  ...overrides,
})

export const createMockBackdatedEntry = (overrides?: Partial<JournalEntry>): JournalEntry =>
  createMockJournalEntry({
    uri: 'at://did:example:alice/app.warlog.journal/backdated123',
    text: 'Backdated entry recounting previous incident',
    entryType: 'backdated',
    createdAt: '2024-01-20T09:00:00Z',
    incidentTimestamp: '2024-01-10T15:30:00Z',
    isPrivate: true,
    ...overrides,
  })

export const createMockPrivateEntry = (overrides?: Partial<JournalEntry>): JournalEntry =>
  createMockJournalEntry({
    uri: 'at://did:example:alice/app.warlog.journal/private123',
    text: 'Private journal entry with sensitive information',
    isPrivate: true,
    ...overrides,
  })

export const createMockMinimalEntry = (overrides?: Partial<JournalEntry>): JournalEntry => ({
  uri: 'at://did:example:alice/app.warlog.journal/minimal123',
  cid: 'bafkreiminimalcidexample',
  text: 'Minimal entry with required fields only',
  entryType: 'real_time',
  createdAt: '2024-01-15T10:30:00Z',
  isPrivate: false,
  author: {
    did: 'did:example:alice',
    handle: 'alice.test',
  },
  ...overrides,
})

export const createMockJournalDraft = (overrides?: Partial<JournalDraft>): JournalDraft => ({
  id: 'draft-123',
  text: 'Draft journal entry in progress',
  entryType: 'real_time',
  isPrivate: false,
  lastSaved: '2024-01-15T10:30:00Z',
  ...overrides,
})

export const createMockSource = (overrides?: Partial<Source>): Source => ({
  id: 'source-1',
  title: 'Research Paper on Directed Energy Weapons',
  url: 'https://example.com/research-paper',
  credibilityScore: 8.5,
  upvotes: 15,
  downvotes: 2,
  author: 'Dr. Example Researcher',
  publishedAt: '2023-12-01T00:00:00Z',
  sourceType: 'academic',
  tags: ['directed_energy', 'weapons', 'research'],
  ...overrides,
})

export const createMockSources = (count: number = 3): Source[] =>
  Array.from({length: count}, (_, index) =>
    createMockSource({
      id: `source-${index + 1}`,
      title: `Test Source ${index + 1}`,
      credibilityScore: 7 + Math.random() * 3, // Random score between 7-10
      upvotes: Math.floor(Math.random() * 50),
      downvotes: Math.floor(Math.random() * 10),
    })
  )

// Predefined test scenarios
export const mockJournalEntries = {
  realTime: createMockJournalEntry(),
  backdated: createMockBackdatedEntry(),
  private: createMockPrivateEntry(),
  minimal: createMockMinimalEntry(),
  withSymptoms: createMockJournalEntry({
    symptoms: [
      {category: 'physical_pain', severity: 8, notes: 'Severe headache'},
      {category: 'neurological', severity: 6, notes: 'Memory issues'},
      {category: 'psychological', severity: 9, notes: 'Extreme anxiety'},
      {category: 'sleep_disruption', severity: 7, notes: 'Insomnia'},
      {category: 'cognitive_impairment', severity: 5, notes: 'Concentration problems'},
    ],
  }),
  withoutLocation: createMockJournalEntry({
    location: undefined,
  }),
  longText: createMockJournalEntry({
    text: 'This is a very long journal entry that contains extensive details about the incident. '.repeat(20),
  }),
  multipleAuthors: [
    createMockJournalEntry({
      author: {
        did: 'did:example:alice',
        handle: 'alice.test',
        displayName: 'Alice Test',
      },
    }),
    createMockJournalEntry({
      uri: 'at://did:example:bob/app.warlog.journal/test456',
      author: {
        did: 'did:example:bob',
        handle: 'bob.test',
        displayName: 'Bob Test',
      },
    }),
  ],
}

export const mockJournalStats = {
  totalEntries: 25,
  privateEntries: 12,
  publicEntries: 13,
  realTimeEntries: 18,
  backdatedEntries: 7,
  entriesWithSymptoms: 20,
  entriesWithLocation: 15,
  entriesWithSources: 10,
  avgSymptomsPerEntry: 3.2,
  mostCommonSymptoms: [
    {category: 'physical_pain', count: 18},
    {category: 'psychological', count: 15},
    {category: 'neurological', count: 12},
    {category: 'sleep_disruption', count: 10},
    {category: 'cognitive_impairment', count: 8},
  ],
  timelineCoverage: {
    firstEntry: '2023-06-01T00:00:00Z',
    lastEntry: '2024-01-15T10:30:00Z',
    totalDays: 228,
  },
}

// Helper functions for generating test data
export const generateJournalEntries = (count: number, baseEntry?: Partial<JournalEntry>): JournalEntry[] =>
  Array.from({length: count}, (_, index) =>
    createMockJournalEntry({
      uri: `at://did:example:test/app.warlog.journal/entry${index}`,
      cid: `bafkrei${index.toString().padStart(20, '0')}`,
      text: `Test journal entry ${index + 1}`,
      createdAt: new Date(Date.now() - index * 86400000).toISOString(), // Daily entries going back
      ...baseEntry,
    })
  )

export const generateSymptomVariations = () => [
  {category: 'physical_pain', severity: 8, notes: 'Sharp headache'},
  {category: 'neurological', severity: 6, notes: 'Dizziness'},
  {category: 'psychological', severity: 9, notes: 'Anxiety attack'},
  {category: 'sleep_disruption', severity: 7, notes: 'Insomnia'},
  {category: 'cognitive_impairment', severity: 5, notes: 'Memory fog'},
  {category: 'sensory_anomaly', severity: 4, notes: 'Tinnitus'},
  {category: 'technology_interference', severity: 3, notes: 'Phone disruption'},
  {category: 'surveillance_indication', severity: 6, notes: 'Unusual activity'},
]

// Error scenarios for testing
export const createInvalidJournalEntry = (type: 'missing_required' | 'invalid_dates' | 'malformed_data') => {
  switch (type) {
    case 'missing_required':
      return {
        uri: 'at://did:example:alice/app.warlog.journal/invalid',
        // Missing required fields like text, entryType, createdAt
      }
    case 'invalid_dates':
      return createMockJournalEntry({
        createdAt: 'invalid-date',
        incidentTimestamp: '2024-13-45T25:70:00Z', // Invalid date
      })
    case 'malformed_data':
      return {
        ...createMockJournalEntry(),
        symptoms: 'not-an-array', // Wrong type
        location: 'invalid-location', // Wrong type
      }
    default:
      return createMockJournalEntry()
  }
}
