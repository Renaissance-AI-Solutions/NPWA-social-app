import React, {useState, useCallback} from 'react'
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  TextInput,
} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useQuery} from '@tanstack/react-query'

import {useAgent, useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText, ButtonIcon} from '#/components/Button'
import {Text} from '#/components/Typography'
import {PlusLarge_Stroke2_Corner0_Rounded as Plus} from '#/components/icons/Plus'
import {MagnifyingGlass_Filled_Stroke2_Corner0_Rounded as Search} from '#/components/icons/MagnifyingGlass'
import {cleanError} from '#/lib/strings/errors'
import {logger} from '#/logger'

// Types for journal entries
interface JournalEntry {
  uri: string
  cid: string
  text: string
  entryType: 'real_time' | 'backdated'
  incidentTimestamp?: string
  location?: {
    latitude: number
    longitude: number
    accuracy?: number
    address?: string
  }
  symptoms?: Array<{
    category: string
    severity: number
  }>
  tags?: string[]
  isPrivate: boolean
  createdAt: string
}

interface Props {
  onCreateEntry: () => void
}

export function JournalList({onCreateEntry}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const agent = useAgent()
  const {currentAccount} = useSession()
  const insets = useSafeAreaInsets()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'real_time' | 'backdated'>('all')

  // Fetch journal entries
  const {
    data: journalEntries = [],
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ['journal-entries', currentAccount?.did],
    queryFn: async () => {
      if (!currentAccount) return []
      
      try {
        // Query journal entries from AT Protocol
        const response = await agent.com.atproto.repo.listRecords({
          repo: currentAccount.did,
          collection: 'app.warlog.journal',
          limit: 100,
        })

        return response.data.records.map((record: any) => ({
          uri: record.uri,
          cid: record.cid,
          ...record.value,
        })) as JournalEntry[]
      } catch (err) {
        logger.error('Failed to fetch journal entries', {message: String(err)})
        throw err
      }
    },
    enabled: !!currentAccount,
  })

  // Filter and search entries
  const filteredEntries = journalEntries.filter((entry) => {
    // Filter by type
    if (selectedFilter !== 'all' && entry.entryType !== selectedFilter) {
      return false
    }
    
    // Search in text content
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return (
        entry.text.toLowerCase().includes(query) ||
        entry.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        entry.location?.address?.toLowerCase().includes(query)
      )
    }
    
    return true
  })

  const onRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  const renderEntry = useCallback(({item: entry}: {item: JournalEntry}) => {
    const entryDate = new Date(entry.createdAt)
    const incidentDate = entry.incidentTimestamp 
      ? new Date(entry.incidentTimestamp)
      : null

    return (
      <View style={[styles.entryCard, {backgroundColor: t.palette.white}]}>
        <View style={styles.entryHeader}>
          <View style={styles.entryMeta}>
            <Text style={[a.text_xs, {color: t.palette.contrast_600}]}>
              {entry.entryType === 'real_time' ? (
                <Trans>Real-time</Trans>
              ) : (
                <Trans>Backdated</Trans>
              )}
            </Text>
            {entry.isPrivate && (
              <Text style={[a.text_xs, {color: t.palette.primary_500}]}>
                • <Trans>Private</Trans>
              </Text>
            )}
          </View>
          <Text style={[a.text_xs, {color: t.palette.contrast_500}]}>
            {entryDate.toLocaleDateString()}
          </Text>
        </View>

        <Text style={[a.text_md, a.leading_normal]} numberOfLines={3}>
          {entry.text}
        </Text>

        {entry.location && (
          <Text style={[a.text_xs, {color: t.palette.contrast_600}, a.mt_sm]}>
            📍 {entry.location.address || 
                 `${entry.location.latitude.toFixed(4)}, ${entry.location.longitude.toFixed(4)}`}
          </Text>
        )}

        {entry.symptoms && entry.symptoms.length > 0 && (
          <Text style={[a.text_xs, {color: t.palette.contrast_600}, a.mt_sm]}>
            🩺 {entry.symptoms.length} symptoms recorded
          </Text>
        )}

        {entry.tags && entry.tags.length > 0 && (
          <View style={[styles.tagsContainer, a.mt_sm]}>
            {entry.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={[styles.tag, {backgroundColor: t.palette.contrast_100}]}>
                <Text style={[a.text_xs, {color: t.palette.contrast_700}]}>
                  #{tag}
                </Text>
              </View>
            ))}
            {entry.tags.length > 3 && (
              <Text style={[a.text_xs, {color: t.palette.contrast_500}]}>
                +{entry.tags.length - 3} more
              </Text>
            )}
          </View>
        )}

        {incidentDate && incidentDate.getTime() !== entryDate.getTime() && (
          <Text style={[a.text_xs, {color: t.palette.contrast_500}, a.mt_sm]}>
            Incident: {incidentDate.toLocaleDateString()}
          </Text>
        )}
      </View>
    )
  }, [t, _])

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={[a.text_lg, a.font_bold, a.text_center, a.mb_md]}>
        <Trans>No Journal Entries</Trans>
      </Text>
      <Text style={[a.text_md, a.text_center, {color: t.palette.contrast_600}, a.mb_lg]}>
        <Trans>Start documenting incidents and experiences by creating your first journal entry.</Trans>
      </Text>
      <Button
        variant="solid"
        color="primary"
        size="large"
        onPress={onCreateEntry}
        label={_(msg`Create First Entry`)}>
        <ButtonIcon icon={Plus} />
        <ButtonText>
          <Trans>Create First Entry</Trans>
        </ButtonText>
      </Button>
    </View>
  )

  return (
    <View style={[styles.container, {backgroundColor: t.palette.contrast_25}]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: t.palette.white}]}>
        <View style={styles.headerRow}>
          <Text style={[a.text_xl, a.font_bold]}>
            <Trans>Journal</Trans>
          </Text>
          <Button
            variant="solid"
            color="primary"
            size="small"
            onPress={onCreateEntry}
            label={_(msg`New Entry`)}>
            <ButtonIcon icon={Plus} />
          </Button>
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, {backgroundColor: t.palette.contrast_50}]}>
          <Search size="md" fill={t.palette.contrast_400} />
          <TextInput
            style={[styles.searchInput, {color: t.palette.contrast_800}]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={_(msg`Search entries...`)}
            placeholderTextColor={t.palette.contrast_400}
          />
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <Button
            variant={selectedFilter === 'all' ? 'solid' : 'outline'}
            color="primary"
            size="small"
            onPress={() => setSelectedFilter('all')}
            label={_(msg`All`)}>
            <ButtonText>
              <Trans>All</Trans>
            </ButtonText>
          </Button>
          <Button
            variant={selectedFilter === 'real_time' ? 'solid' : 'outline'}
            color="primary"
            size="small"
            onPress={() => setSelectedFilter('real_time')}
            label={_(msg`Real-time`)}>
            <ButtonText>
              <Trans>Real-time</Trans>
            </ButtonText>
          </Button>
          <Button
            variant={selectedFilter === 'backdated' ? 'solid' : 'outline'}
            color="primary"
            size="small"
            onPress={() => setSelectedFilter('backdated')}
            label={_(msg`Backdated`)}>
            <ButtonText>
              <Trans>Backdated</Trans>
            </ButtonText>
          </Button>
        </View>
      </View>

      {/* Entries List */}
      <FlatList
        data={filteredEntries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.uri}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={onRefresh}
            tintColor={t.palette.primary_500}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  listContent: {
    padding: 16,
  },
  entryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  entryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
}) 