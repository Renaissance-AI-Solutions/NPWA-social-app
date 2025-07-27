import React, {useState, useCallback, useEffect} from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Text as TypographyText} from '#/components/Typography'
import {useSourcesAPI, type Source} from '#/lib/api/sources'

interface SourcesListProps {
  onSourcePress?: (source: Source) => void
}

export function SourcesList({onSourcePress}: SourcesListProps) {
  const {_} = useLingui()
  const t = useTheme()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const sourcesAPI = useSourcesAPI()

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
      console.error('Failed to load sources:', error)
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
      console.error('Failed to vote on source:', error)
      Alert.alert(_(msg`Error`), _(msg`Failed to vote on source`))
    }
  }, [sourcesAPI, _])

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
        a.mb_md,
        a.rounded_md,
        {backgroundColor: t.atoms.bg_contrast_25.backgroundColor},
        a.border,
        {borderColor: t.atoms.border_contrast_low.borderColor},
      ]}
      onPress={() => onSourcePress?.(item)}
      activeOpacity={0.7}>
      
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
          <TouchableOpacity
            style={[a.flex_row, a.align_center, a.gap_xs, a.px_sm, a.py_xs]}
            onPress={() => handleVote(item, 'up')}>
            <Text style={[a.text_sm, {color: '#22c55e'}]}>↑</Text>
            <Text style={[a.text_sm, {color: t.atoms.text.color}]}>
              {item.upvotes}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[a.flex_row, a.align_center, a.gap_xs, a.px_sm, a.py_xs]}
            onPress={() => handleVote(item, 'down')}>
            <Text style={[a.text_sm, {color: '#ef4444'}]}>↓</Text>
            <Text style={[a.text_sm, {color: t.atoms.text.color}]}>
              {item.downvotes}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Source Name */}
      <Text style={[a.text_lg, a.font_bold, a.mb_sm, {color: t.atoms.text.color}]}>
        {item.name}
      </Text>

      {/* URL */}
      {item.url && (
        <Text style={[a.text_sm, a.mb_sm, {color: t.atoms.text_contrast_medium.color}]} numberOfLines={2}>
          {item.url}
        </Text>
      )}

      {/* Created Date */}
      <Text style={[a.text_xs, {color: t.atoms.text_contrast_medium.color}]}>
        Created: {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  )

  return (
    <View style={[a.flex_1, {backgroundColor: t.atoms.bg.backgroundColor}]}>
      {/* Header */}
      <View
        style={[
          a.px_lg,
          a.py_md,
          a.border_b,
          {
            borderBottomColor: t.atoms.border_contrast_low.borderColor,
            paddingTop: insets.top + 12,
          },
        ]}>
        <TypographyText style={[a.text_xl, a.font_bold, a.mb_md]}>
          <Trans>Sources</Trans>
        </TypographyText>

        {/* Search */}
        <TextInput
          style={[
            a.p_md,
            a.mb_md,
            a.rounded_md,
            a.border,
            {
              borderColor: t.atoms.border_contrast_low.borderColor,
              backgroundColor: t.atoms.bg_contrast_25.backgroundColor,
              color: t.atoms.text.color,
            },
          ]}
          placeholder={_(msg`Search sources...`)}
          placeholderTextColor={t.atoms.text_contrast_medium.color}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* Badge Type Filter */}
        <View style={[a.mb_sm]}>
          <Text style={[a.text_sm, a.font_bold, a.mb_xs, {color: t.atoms.text.color}]}>
            <Trans>Badge Type</Trans>
          </Text>
          <View style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
            <TouchableOpacity
              style={[
                a.px_sm,
                a.py_xs,
                a.rounded_sm,
                {backgroundColor: selectedBadgeFilter === null ? '#3b82f6' : '#e5e7eb'},
              ]}
              onPress={() => setSelectedBadgeFilter(null)}>
              <Text style={[a.text_xs, a.font_bold, {color: selectedBadgeFilter === null ? 'white' : '#6b7280'}]}>
                All
              </Text>
            </TouchableOpacity>
            {badgeTypes.map(badge => (
              <TouchableOpacity
                key={badge}
                style={[
                  a.px_sm,
                  a.py_xs,
                  a.rounded_sm,
                  {backgroundColor: selectedBadgeFilter === badge ? '#3b82f6' : '#e5e7eb'},
                ]}
                onPress={() => setSelectedBadgeFilter(badge)}>
                <Text style={[a.text_xs, a.font_bold, {color: selectedBadgeFilter === badge ? 'white' : '#6b7280'}]}>
                  {badge}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Rank Filter */}
        <View>
          <Text style={[a.text_sm, a.font_bold, a.mb_xs, {color: t.atoms.text.color}]}>
            <Trans>Rank</Trans>
          </Text>
          <View style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
            <TouchableOpacity
              style={[
                a.px_sm,
                a.py_xs,
                a.rounded_sm,
                {backgroundColor: selectedRankFilter === null ? '#3b82f6' : '#e5e7eb'},
              ]}
              onPress={() => setSelectedRankFilter(null)}>
              <Text style={[a.text_xs, a.font_bold, {color: selectedRankFilter === null ? 'white' : '#6b7280'}]}>
                All
              </Text>
            </TouchableOpacity>
            {ranks.map(rank => (
              <TouchableOpacity
                key={rank}
                style={[
                  a.px_sm,
                  a.py_xs,
                  a.rounded_sm,
                  {backgroundColor: selectedRankFilter === rank ? getRankColor(rank as Source['rank']) : '#e5e7eb'},
                ]}
                onPress={() => setSelectedRankFilter(rank)}>
                <Text style={[a.text_xs, a.font_bold, {color: selectedRankFilter === rank ? 'white' : '#6b7280'}]}>
                  {rank.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Sources List */}
      <FlatList
        data={sources}
        renderItem={renderSourceItem}
        keyExtractor={item => item.id}
        style={[a.flex_1]}
        contentContainerStyle={[a.px_lg, a.py_md]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={t.atoms.text_contrast_medium.color}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={[a.p_lg, a.align_center]}>
            <Text style={[a.text_md, {color: t.atoms.text_contrast_medium.color}]}>
              {isLoading ? <Trans>Loading sources...</Trans> : <Trans>No sources found</Trans>}
            </Text>
          </View>
        }
        ListFooterComponent={
          cursor && !isLoading ? (
            <View style={[a.p_md, a.align_center]}>
              <Button
                variant="outline"
                size="small"
                onPress={handleLoadMore}
                label={_(msg`Load more`)}>
                <ButtonText>
                  <Trans>Load More</Trans>
                </ButtonText>
              </Button>
            </View>
          ) : null
        }
      />
    </View>
  )
} 