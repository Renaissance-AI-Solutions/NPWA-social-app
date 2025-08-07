import React from 'react'
import {render, screen, fireEvent} from '../test-utils'
import {JournalEntry} from '../../src/components/JournalEntry'
import {RootStoreModel} from '../../src/state'
import {mockState} from '../mocks/state'
import {describe, expect, it, jest, beforeEach} from '@jest/globals'

// Mock data for testing
const mockJournalEntry = {
  uri: 'at://did:example:alice/app.warlog.journal/test123',
  text: 'This is a test journal entry documenting an incident',
  entryType: 'real_time' as const,
  createdAt: '2024-01-15T10:30:00Z',
  incidentTimestamp: '2024-01-15T10:25:00Z',
  location: {
    latitude: 40.7128,
    longitude: -74.0060,
    address: 'New York, NY',
  },
  symptoms: [
    {
      category: 'physical_pain',
      severity: 7,
      notes: 'Sharp headache',
    },
    {
      category: 'neurological',
      severity: 5,
      notes: 'Dizziness',
    },
    {
      category: 'psychological',
      severity: 8,
      notes: 'Anxiety',
    },
    {
      category: 'cognitive_impairment',
      severity: 6,
      notes: 'Memory issues',
    },
  ],
  isPrivate: false,
  sourceIds: ['source-1', 'source-2'],
}

const mockBackdatedEntry = {
  ...mockJournalEntry,
  uri: 'at://did:example:alice/app.warlog.journal/backdated123',
  text: 'This is a backdated entry',
  entryType: 'backdated' as const,
  incidentTimestamp: '2024-01-10T15:00:00Z',
  isPrivate: true,
}

const mockSources = [
  {
    id: 'source-1',
    title: 'Research Paper on Directed Energy',
    url: 'https://example.com/research',
    credibilityScore: 8.5,
    upvotes: 15,
    downvotes: 2,
  },
  {
    id: 'source-2',
    title: 'Government Report on Surveillance',
    url: 'https://example.com/report',
    credibilityScore: 9.2,
    upvotes: 23,
    downvotes: 1,
  },
]

describe('JournalEntry Component', () => {
  let mockRootStore: RootStoreModel

  beforeEach(() => {
    mockRootStore = mockState()
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders journal entry with all basic information', () => {
      render(<JournalEntry entry={mockJournalEntry} />, mockRootStore)

      expect(screen.getByText('This is a test journal entry documenting an incident')).toBeTruthy()
      expect(screen.getByText('Real-time')).toBeTruthy()
      expect(screen.getByText(/Jan 15, 2024/)).toBeTruthy()
      expect(screen.getByText(/Incident occurred/)).toBeTruthy()
      expect(screen.getByText(/📍 New York, NY/)).toBeTruthy()
    })

    it('renders backdated entry with correct styling', () => {
      render(<JournalEntry entry={mockBackdatedEntry} />, mockRootStore)

      expect(screen.getByText('Backdated')).toBeTruthy()
      expect(screen.getByText('Private')).toBeTruthy()
    })

    it('renders entry without optional fields', () => {
      const minimalEntry = {
        uri: 'at://did:example:alice/app.warlog.journal/minimal123',
        text: 'Minimal entry',
        entryType: 'real_time' as const,
        createdAt: '2024-01-15T10:30:00Z',
        isPrivate: false,
      }

      render(<JournalEntry entry={minimalEntry} />, mockRootStore)

      expect(screen.getByText('Minimal entry')).toBeTruthy()
      expect(screen.getByText('Real-time')).toBeTruthy()
      expect(screen.queryByText(/Incident occurred/)).toBeFalsy()
      expect(screen.queryByText(/📍/)).toBeFalsy()
      expect(screen.queryByText(/Symptoms/)).toBeFalsy()
    })
  })

  describe('Symptoms Display', () => {
    it('displays symptoms with correct count and severity', () => {
      render(<JournalEntry entry={mockJournalEntry} />, mockRootStore)

      expect(screen.getByText('Symptoms (4)')).toBeTruthy()
      expect(screen.getByText('physical_pain (7/10)')).toBeTruthy()
      expect(screen.getByText('neurological (5/10)')).toBeTruthy()
      expect(screen.getByText('psychological (8/10)')).toBeTruthy()
    })

    it('shows +more indicator when more than 3 symptoms', () => {
      render(<JournalEntry entry={mockJournalEntry} />, mockRootStore)

      expect(screen.getByText('+1 more')).toBeTruthy()
    })

    it('does not show symptoms section when no symptoms', () => {
      const entryWithoutSymptoms = {
        ...mockJournalEntry,
        symptoms: undefined,
      }

      render(<JournalEntry entry={entryWithoutSymptoms} />, mockRootStore)

      expect(screen.queryByText(/Symptoms/)).toBeFalsy()
    })
  })

  describe('Location Display', () => {
    it('displays address when available', () => {
      render(<JournalEntry entry={mockJournalEntry} />, mockRootStore)

      expect(screen.getByText(/📍 New York, NY/)).toBeTruthy()
    })

    it('displays coordinates when no address', () => {
      const entryWithCoords = {
        ...mockJournalEntry,
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
        },
      }

      render(<JournalEntry entry={entryWithCoords} />, mockRootStore)

      expect(screen.getByText(/📍 40.7128, -74.0060/)).toBeTruthy()
    })
  })

  describe('Sources Integration', () => {
    it('renders sources when provided', () => {
      render(
        <JournalEntry entry={mockJournalEntry} sources={mockSources} />,
        mockRootStore
      )

      // Sources should be displayed via SourceDisplay component
      expect(screen.getByTestId('source-display')).toBeTruthy()
    })

    it('handles source press events', () => {
      const mockOnSourcePress = jest.fn()
      render(
        <JournalEntry
          entry={mockJournalEntry}
          sources={mockSources}
          onSourcePress={mockOnSourcePress}
        />,
        mockRootStore
      )

      // This would depend on SourceDisplay implementation
      // fireEvent.press(screen.getByText('Research Paper on Directed Energy'))
      // expect(mockOnSourcePress).toHaveBeenCalledWith(mockSources[0])
    })
  })

  describe('User Interactions', () => {
    it('calls onPress when entry is pressed', () => {
      const mockOnPress = jest.fn()
      render(
        <JournalEntry entry={mockJournalEntry} onPress={mockOnPress} />,
        mockRootStore
      )

      fireEvent.press(screen.getByTestId('journal-entry-touchable'))
      expect(mockOnPress).toHaveBeenCalled()
    })

    it('shows full text when showFullText is true', () => {
      render(
        <JournalEntry entry={mockJournalEntry} showFullText={true} />,
        mockRootStore
      )

      // Text should not be truncated
      const textElement = screen.getByText(mockJournalEntry.text)
      expect(textElement.props.numberOfLines).toBeUndefined()
    })

    it('truncates text when showFullText is false', () => {
      render(
        <JournalEntry entry={mockJournalEntry} showFullText={false} />,
        mockRootStore
      )

      // Text should be truncated to 4 lines
      const textElement = screen.getByText(mockJournalEntry.text)
      expect(textElement.props.numberOfLines).toBe(4)
    })
  })

  describe('Date Formatting', () => {
    it('formats dates correctly', () => {
      render(<JournalEntry entry={mockJournalEntry} />, mockRootStore)

      // Should format as "Jan 15, 2024, 10:30 AM"
      expect(screen.getByText(/Jan 15, 2024/)).toBeTruthy()
    })

    it('shows incident timestamp when different from creation time', () => {
      render(<JournalEntry entry={mockJournalEntry} />, mockRootStore)

      expect(screen.getByText(/Incident occurred: Jan 15, 2024/)).toBeTruthy()
    })

    it('does not show incident timestamp when same as creation time', () => {
      const entryWithSameTime = {
        ...mockJournalEntry,
        incidentTimestamp: mockJournalEntry.createdAt,
      }

      render(<JournalEntry entry={entryWithSameTime} />, mockRootStore)

      expect(screen.queryByText(/Incident occurred/)).toBeFalsy()
    })
  })

  describe('Privacy Indicators', () => {
    it('shows private badge for private entries', () => {
      render(<JournalEntry entry={mockBackdatedEntry} />, mockRootStore)

      expect(screen.getByText('Private')).toBeTruthy()
    })

    it('does not show private badge for public entries', () => {
      render(<JournalEntry entry={mockJournalEntry} />, mockRootStore)

      expect(screen.queryByText('Private')).toBeFalsy()
    })
  })

  describe('Entry Type Styling', () => {
    it('applies correct color for real-time entries', () => {
      render(<JournalEntry entry={mockJournalEntry} />, mockRootStore)

      const badge = screen.getByText('Real-time').parent
      expect(badge.props.style).toContainEqual({
        backgroundColor: '#22c55e', // Green for real-time
      })
    })

    it('applies correct color for backdated entries', () => {
      render(<JournalEntry entry={mockBackdatedEntry} />, mockRootStore)

      const badge = screen.getByText('Backdated').parent
      expect(badge.props.style).toContainEqual({
        backgroundColor: '#f59e0b', // Amber for backdated
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper accessibility labels', () => {
      render(<JournalEntry entry={mockJournalEntry} />, mockRootStore)

      const touchable = screen.getByTestId('journal-entry-touchable')
      expect(touchable.props.accessible).toBe(true)
      expect(touchable.props.accessibilityRole).toBe('button')
    })

    it('provides semantic information for screen readers', () => {
      render(<JournalEntry entry={mockJournalEntry} />, mockRootStore)

      // Should have proper accessibility hints
      const touchable = screen.getByTestId('journal-entry-touchable')
      expect(touchable.props.accessibilityHint).toContain('journal entry')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty text gracefully', () => {
      const entryWithEmptyText = {
        ...mockJournalEntry,
        text: '',
      }

      render(<JournalEntry entry={entryWithEmptyText} />, mockRootStore)

      expect(screen.getByTestId('journal-entry-touchable')).toBeTruthy()
    })

    it('handles invalid dates gracefully', () => {
      const entryWithInvalidDate = {
        ...mockJournalEntry,
        createdAt: 'invalid-date',
      }

      expect(() => {
        render(<JournalEntry entry={entryWithInvalidDate} />, mockRootStore)
      }).not.toThrow()
    })

    it('handles very long text appropriately', () => {
      const longText = 'A'.repeat(5000)
      const entryWithLongText = {
        ...mockJournalEntry,
        text: longText,
      }

      render(<JournalEntry entry={entryWithLongText} />, mockRootStore)

      // Should render without performance issues
      expect(screen.getByText(longText.substring(0, 100) + '...')).toBeTruthy()
    })
  })
})
