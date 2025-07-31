import {useState, useCallback, useEffect} from 'react'
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native'

import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'
import {type NavigationProp} from '@react-navigation/native'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText, ButtonIcon} from '#/components/Button'
import {Text} from '#/components/Typography'
import * as Layout from '#/components/Layout'
import * as Dialog from '#/components/Dialog'
import {SourceCreationForm} from '#/components/SourceCreationForm'
import {MagnifyingGlass_Filled_Stroke2_Corner0_Rounded as Search} from '#/components/icons/MagnifyingGlass'
import {PlusLarge_Stroke2_Corner0_Rounded as Plus} from '#/components/icons/Plus'
import {
  ChevronTop_Stroke2_Corner0_Rounded as ArrowUp,
  ChevronBottom_Stroke2_Corner0_Rounded as ArrowDown,
} from '#/components/icons/Chevron'
import {type AllNavigatorParams} from '#/lib/routes/types'
import {useSourcesAPI, type Source} from '#/lib/api/sources'
import {cleanError} from '#/lib/strings/errors'
import {logger} from '#/logger'

interface SourcesListProps {
  onSourcePress?: (source: Source) => void
  onCreateSource?: () => void
}

export function SourcesList({onSourcePress, onCreateSource}: SourcesListProps) {
  const {_} = useLingui()
  const t = useTheme()
  const navigation = useNavigation<NavigationProp<AllNavigatorParams>>()

  const sourcesAPI = useSourcesAPI()
  const createSourceDialogControl = Dialog.useDialogControl()

  const [sources, setSources] = useState<Source[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBadgeFilter, setSelectedBadgeFilter] = useState<string | null>(null)
  const [selectedRankFilter, setSelectedRankFilter] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | undefined>()

  // Load sources on mount and when filters change
  useEffect(() => {
    loadSources(true)
  }, [searchQuery, selectedBadgeFilter, selectedRankFilter])

  const loadSources = useCallback(async (reset = false) => {
    if (reset) {
      setIsLoading(true)
      setCursor(undefined)
    }

    try {
      const response = await sourcesAPI.list({
        search: searchQuery || undefined,
        badgeType: selectedBadgeFilter || undefined,
        rank: selectedRankFilter || undefined,
        cursor: reset ? undefined : cursor,
        limit: 20,
      })

      if (reset) {
        setSources(response.sources)
      } else {
        setSources(prev => [...prev, ...response.sources])
      }
      
      setCursor(response.cursor)
    } catch (error) {
      logger.error('Failed to load sources', {message: cleanError(error)})
      Alert.alert(_(msg`Error`), _(msg`Failed to load sources`))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [sourcesAPI, searchQuery, selectedBadgeFilter, selectedRankFilter, cursor, _])

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    loadSources(true)
  }, [loadSources])

  const handleLoadMore = useCallback(() => {
    if (cursor && !isLoading) {
      loadSources(false)
    }
  }, [cursor, isLoading, loadSources])

  const handleVote = useCallback(async (source: Source, vote: 'up' | 'down') => {
    try {
      const response = await sourcesAPI.vote({
        sourceId: source.id,
        vote,
      })

      // Update the source in the list
      setSources(prev => 
        prev.map(s => s.id === source.id ? response.source : s)
      )
    } catch (error) {
      logger.error('Failed to vote on source', {message: cleanError(error)})
      Alert.alert(_(msg`Error`), _(msg`Failed to vote on source`))
    }
  }, [sourcesAPI, _])

  const handleCreateSource = useCallback(() => {
    if (onCreateSource) {
      onCreateSource()
    } else {
      createSourceDialogControl.open()
    }
  }, [onCreateSource, createSourceDialogControl])

  const handleSourceCreated = useCallback(() => {
    // Refresh the sources list after creating a new source
    loadSources(true)
  }, [loadSources])

  const getRankColor = (rank: Source['rank']) => {
    switch (rank) {
      case 'trusted': return '#22c55e'
      case 'vetted': return '#3b82f6'
      case 'slightly_vetted': return '#8b5cf6'
      case 'debated': return '#f59e0b'
      case 'debunked': return '#ef4444'
      case 'new': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const badgeTypes = ['havana', 'gangstalked', 'targeted', 'whistleblower', 'retaliation']
  const ranks = ['trusted', 'vetted', 'slightly_vetted', 'debated', 'new', 'debunked']

  const renderSourceItem = ({item}: {item: Source}) => (
    <TouchableOpacity
      style={[
        a.p_lg,
        styles.sourceCard,
        {backgroundColor: t.palette.white},
      ]}
      onPress={() => {
        if (onSourcePress) {
          onSourcePress(item)
        } else {
          navigation.navigate('SourceDetail', {id: item.id})
        }
      }}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={_(msg`View details for ${item.name}`)}
      accessibilityHint={_(msg`Opens source details screen`)}>
      
      {/* Header */}
      <View style={[a.flex_row, a.align_center, a.justify_between, a.mb_sm]}>
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          {/* Rank Badge */}
          <View
            style={[
              a.px_sm,
              a.py_xs,
              a.rounded_sm,
              {backgroundColor: getRankColor(item.rank)},
            ]}>
            <Text style={[a.text_xs, a.font_bold, {color: 'white'}]}>
              {item.rank.replace('_', ' ').toUpperCase()}
            </Text>
          </View>

          {/* Badge Type */}
          {item.badgeType && (
            <View
              style={[
                a.px_sm,
                a.py_xs,
                a.rounded_sm,
                {backgroundColor: '#e5e7eb'},
              ]}>
              <Text style={[a.text_xs, a.font_bold, {color: '#6b7280'}]}>
                #{item.badgeType}
              </Text>
            </View>
          )}
        </View>

        {/* Vote Counts */}
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          <Button
            variant="ghost"
            size="small"
            onPress={() => handleVote(item, 'up')}
            label={_(msg`Upvote ${item.name} (${item.upvotes} votes)`)}>
            <ButtonIcon icon={ArrowUp} />
            <ButtonText style={[a.text_sm, {color: '#22c55e'}]}>
              {item.upvotes}
            </ButtonText>
          </Button>
          <Button
            variant="ghost"
            size="small"
            onPress={() => handleVote(item, 'down')}
            label={_(msg`Downvote ${item.name} (${item.downvotes} votes)`)}>
            <ButtonIcon icon={ArrowDown} />
            <ButtonText style={[a.text_sm, {color: '#ef4444'}]}>
              {item.downvotes}
            </ButtonText>
          </Button>
        </View>
      </View>

      {/* Source Name */}
      <Text style={[a.text_lg, a.font_bold, a.mb_sm, {color: t.palette.contrast_900}]}>
        {item.name}
      </Text>

      {/* URL */}
      {item.url && (
        <Text style={[a.text_sm, a.mb_sm, {color: t.palette.contrast_600}]} numberOfLines={2}>
          {item.url}
        </Text>
      )}

      {/* Created Date */}
      <Text style={[a.text_xs, {color: t.palette.contrast_500}]}>
        <Trans>Created: {new Date(item.createdAt).toLocaleDateString()}</Trans>
      </Text>
    </TouchableOpacity>
  )

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={[a.text_lg, a.font_bold, a.text_center, a.mb_md]}>
        <Trans>No Sources Found</Trans>
      </Text>
      <Text style={[a.text_md, a.text_center, {color: t.palette.contrast_600}, a.mb_lg]}>
        <Trans>No sources match your current filters. Try adjusting your search or filters, or add a new source.</Trans>
      </Text>
      <Button
        variant="solid"
        color="primary"
        size="large"
        onPress={handleCreateSource}
        label={_(msg`Add First Source`)}>
        <ButtonIcon icon={Plus} />
        <ButtonText>
          <Trans>Add First Source</Trans>
        </ButtonText>
      </Button>
    </View>
  )

  return (
    <Layout.Screen testID="SourcesScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Sources</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot>
          <Button
            variant="solid"
            color="primary"
            size="small"
            onPress={handleCreateSource}
            label={_(msg`Add Source`)}>
            <ButtonIcon icon={Plus} />
          </Button>
        </Layout.Header.Slot>
      </Layout.Header.Outer>

      <Layout.Content style={{backgroundColor: t.palette.contrast_25}}>

        {/* Search */}
        <View style={[styles.searchContainer, {backgroundColor: t.palette.contrast_50}]}>
          <Search size="md" fill={t.palette.contrast_400} />
          <TextInput
            style={[styles.searchInput, {color: t.palette.contrast_800}]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={_(msg`Search sources...`)}
            placeholderTextColor={t.palette.contrast_400}
            accessibilityLabel={_(msg`Search sources`)}
            accessibilityHint={_(msg`Enter text to search sources by name or URL`)}
          />
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <Text style={[a.text_sm, a.font_bold, a.mb_xs, {color: t.palette.contrast_800}]}>
            <Trans>Badge Type</Trans>
          </Text>
          <View style={styles.filterRow}>
            <Button
              variant={selectedBadgeFilter === null ? 'solid' : 'outline'}
              color="primary"
              size="small"
              onPress={() => setSelectedBadgeFilter(null)}
              label={_(msg`Show all badge types`)}>
              <ButtonText>
                <Trans>All</Trans>
              </ButtonText>
            </Button>
            {badgeTypes.map(badge => (
              <Button
                key={badge}
                variant={selectedBadgeFilter === badge ? 'solid' : 'outline'}
                color="primary"
                size="small"
                onPress={() => setSelectedBadgeFilter(badge)}
                label={_(msg`Filter by ${badge} badge type`)}>
                <ButtonText>
                  {badge}
                </ButtonText>
              </Button>
            ))}
          </View>
        </View>

        <View style={styles.filtersContainer}>
          <Text style={[a.text_sm, a.font_bold, a.mb_xs, {color: t.palette.contrast_800}]}>
            <Trans>Rank</Trans>
          </Text>
          <View style={styles.filterRow}>
            <Button
              variant={selectedRankFilter === null ? 'solid' : 'outline'}
              color="primary"
              size="small"
              onPress={() => setSelectedRankFilter(null)}
              label={_(msg`Show all ranks`)}>
              <ButtonText>
                <Trans>All</Trans>
              </ButtonText>
            </Button>
            {ranks.map(rank => (
              <Button
                key={rank}
                variant={selectedRankFilter === rank ? 'solid' : 'outline'}
                color="primary"
                size="small"
                onPress={() => setSelectedRankFilter(rank)}
                label={_(msg`Filter by ${rank.replace('_', ' ')} rank`)}>
                <ButtonText>
                  {rank.replace('_', ' ')}
                </ButtonText>
              </Button>
            ))}
          </View>
        </View>

      {/* Sources List */}
      <FlatList
        data={sources}
        renderItem={renderSourceItem}
        keyExtractor={item => item.id}
        style={[a.flex_1]}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={t.palette.primary_500}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          isLoading ? (
            <View style={[a.p_lg, a.align_center]}>
              <Text style={[a.text_md, {color: t.palette.contrast_600}]}>
                <Trans>Loading sources...</Trans>
              </Text>
            </View>
          ) : renderEmptyState()
        }
        ListFooterComponent={
          cursor && !isLoading ? (
            <View style={[a.p_md, a.align_center]}>
              <Button
                variant="outline"
                size="small"
                onPress={handleLoadMore}
                label={_(msg`Load more sources`)}>
                <ButtonText>
                  <Trans>Load More</Trans>
                </ButtonText>
              </Button>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
        accessibilityLabel={_(msg`Sources list`)}
        accessibilityHint={_(msg`Scrollable list of sources. Tap on a source to view details.`)}
      />
      </Layout.Content>

      {/* Source Creation Modal */}
      <SourceCreationForm
        control={createSourceDialogControl}
        onSourceCreated={handleSourceCreated}
      />
    </Layout.Screen>
  )
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  filtersContainer: {
    marginBottom: 8,
    marginHorizontal: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  listContent: {
    padding: 16,
  },
  sourceCard: {
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
}) 