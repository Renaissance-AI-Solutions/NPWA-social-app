import { useState, useEffect, useCallback } from 'react'
import {
  View,
  TextInput,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native'

import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useRoute, type RouteProp} from '@react-navigation/native'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText, ButtonIcon} from '#/components/Button'
import {Text} from '#/components/Typography'
import * as Layout from '#/components/Layout'
import {PressableScale} from '#/lib/custom-animations/PressableScale'
import {
  ChevronTop_Stroke2_Corner0_Rounded as ArrowUp,
  ChevronBottom_Stroke2_Corner0_Rounded as ArrowDown,
} from '#/components/icons/Chevron'
import {ChainLink_Stroke2_Corner0_Rounded as LinkIcon} from '#/components/icons/ChainLink'
import {type CommonNavigatorParams} from '#/lib/routes/types'
import {useSourcesAPI, type Source, type SourceComment} from '#/lib/api/sources'

// Badge and rank color mappings - now using theme-aware color functions
const getBadgeColors = (t: any) => ({
  havana: t.palette.negative_500,
  gangstalked: t.palette.primary_500,
  targeted: t.palette.primary_600,
  whistleblower: t.palette.positive_500,
  retaliation: t.palette.negative_400,
})

const getRankColors = (t: any) => ({
  new: t.palette.contrast_500,
  debated: t.palette.negative_400,
  debunked: t.palette.negative_600,
  slightly_vetted: t.palette.negative_300,
  vetted: t.palette.positive_500,
  trusted: t.palette.positive_600,
})

const RANK_LABELS = {
  new: 'New',
  debated: 'Debated',
  debunked: 'Debunked',
  slightly_vetted: 'Slightly Vetted',
  vetted: 'Vetted',
  trusted: 'Trusted',
}

type RouteProps = RouteProp<CommonNavigatorParams, 'SourceDetail'>

export function SourceDetail() {
  const route = useRoute<RouteProps>()
  const { id: sourceId } = route.params
  const {_} = useLingui()
  const t = useTheme()

  const sourcesAPI = useSourcesAPI()
  const { getById, getComments, vote, addComment } = sourcesAPI

  const [source, setSource] = useState<Source | null>(null)
  const [comments, setComments] = useState<SourceComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isVoting, setIsVoting] = useState(false)
  const [isAddingComment, setIsAddingComment] = useState(false)
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null)

  const fetchSourceDetail = useCallback(async () => {
    try {
      setLoading(true)
      const [sourceData, commentsData] = await Promise.all([
        getById(sourceId),
        getComments(sourceId),
      ])

      setSource(sourceData)
      setComments(commentsData)
    } catch (error) {
      console.error('Error fetching source detail:', error)
      Alert.alert(_(msg`Error`), _(msg`Failed to load source details`))
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [getById, getComments, sourceId])

  useEffect(() => {
    fetchSourceDetail()
  }, [fetchSourceDetail])

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    fetchSourceDetail()
  }, [fetchSourceDetail])

  const handleVote = useCallback(async (voteType: 'up' | 'down') => {
    if (!source || isVoting) return

    try {
      setIsVoting(true)
      const response = await vote({
        sourceId: source.id,
        vote: voteType,
      })

      setSource(response.source)
      setUserVote(voteType)
    } catch (error) {
      console.error('Error voting:', error)
      Alert.alert(_(msg`Error`), _(msg`Failed to submit vote`))
    } finally {
      setIsVoting(false)
    }
  }, [source, vote, isVoting])

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || !source || isAddingComment) return

    try {
      setIsAddingComment(true)
      const newCommentObj = await addComment({
        sourceId: source.id,
        content: newComment.trim(),
      })

      setComments(prev => [newCommentObj, ...prev])
      setNewComment('')
    } catch (error) {
      console.error('Error adding comment:', error)
      Alert.alert(_(msg`Error`), _(msg`Failed to add comment`))
    } finally {
      setIsAddingComment(false)
    }
  }, [newComment, source, addComment, isAddingComment])

  const handleOpenUrl = useCallback(() => {
    if (source?.url) {
      Linking.openURL(source.url).catch(() => {
        Alert.alert(_(msg`Error`), _(msg`Unable to open URL`))
      })
    }
  }, [source?.url])

  const rankColors = getRankColors(t)
  const badgeColors = getBadgeColors(t)

  const getRankColor = (rank: Source['rank']) => {
    return rankColors[rank as keyof typeof rankColors]
  }

  const getBadgeColor = (badgeType: Source['badgeType']) => {
    return badgeType ? badgeColors[badgeType as keyof typeof badgeColors] : t.palette.contrast_400
  }

  return (
    <Layout.Screen testID="SourceDetailScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            {loading ? <Trans>Loading...</Trans> : !source ? <Trans>Source Not Found</Trans> : source.name}
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>

      <Layout.Content
        refreshControl={
          !loading ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={t.atoms.text_contrast_medium.color}
            />
          ) : undefined
        }>

        {loading ? (
          <View style={[a.flex_1, a.justify_center, a.align_center]}>
            <Text style={[a.text_lg, {color: t.atoms.text.color}]}>
              <Trans>Loading...</Trans>
            </Text>
          </View>
        ) : !source ? (
          <View style={[a.flex_1, a.justify_center, a.align_center]}>
            <Text style={[a.text_lg, {color: t.atoms.text.color}]}>
              <Trans>Source not found</Trans>
            </Text>
          </View>
        ) : (
          <>
        {/* Source Info Section */}
        <View style={[a.p_lg, a.border_b, {borderBottomColor: t.atoms.border_contrast_low.borderColor}]}>
          <Text
            style={[a.text_2xl, a.font_bold, a.mb_md, {color: t.atoms.text.color}]}
            accessibilityRole="header">
            {source.name}
          </Text>
        
        <View style={[a.flex_row, a.align_center, a.mb_md, a.gap_sm]}>
          {/* Rank Badge */}
          <View
            style={[
              a.px_md,
              a.py_xs,
              a.rounded_md,
              {backgroundColor: getRankColor(source.rank)},
            ]}>
            <Text style={[a.text_sm, a.font_bold, {color: 'white'}]}>
              {RANK_LABELS[source.rank as keyof typeof RANK_LABELS]}
            </Text>
          </View>
          
          {/* Badge Type */}
          {source.badgeType && (
            <View
              style={[
                a.px_sm,
                a.py_xs,
                a.rounded_sm,
                {backgroundColor: getBadgeColor(source.badgeType)},
              ]}>
              <Text style={[a.text_xs, a.font_bold, {color: 'white'}]}>
                #{source.badgeType}
              </Text>
            </View>
          )}
        </View>

        {source.url && (
          <PressableScale 
            style={[
              a.flex_row,
              a.align_center,
              a.mb_md,
              a.p_md,
              a.rounded_md,
              {backgroundColor: t.atoms.bg_contrast_25.backgroundColor},
            ]}
            onPress={handleOpenUrl}
            accessibilityRole="button"
            accessibilityLabel={_(msg`Open source URL: ${source.url}`)}>
            <LinkIcon size="sm" style={[a.mr_xs, {color: t.palette.primary_500}]} />
            <Text 
              style={[
                a.text_md,
                a.flex_1,
                {color: t.palette.primary_500}
              ]} 
              numberOfLines={2}>
              {source.url}
            </Text>
          </PressableScale>
        )}

        <View style={[a.flex_row, a.justify_center, a.mb_md, a.gap_md]}>
          <Button
            variant={userVote === 'up' ? 'solid' : 'outline'}
            color={userVote === 'up' ? 'primary' : 'primary'}
            size="small"
            onPress={() => handleVote('up')}
            disabled={isVoting}
            label={_(msg`Upvote source (${source.upvotes} votes)`)}
            style={[a.flex_row, a.align_center, a.gap_xs]}>
            <ButtonIcon icon={ArrowUp} />
            <ButtonText>{source.upvotes}</ButtonText>
          </Button>

          <Button
            variant={userVote === 'down' ? 'solid' : 'outline'}
            color={userVote === 'down' ? 'primary' : 'primary'}
            size="small"
            onPress={() => handleVote('down')}
            disabled={isVoting}
            label={_(msg`Downvote source (${source.downvotes} votes)`)}
            style={[a.flex_row, a.align_center, a.gap_xs]}>
            <ButtonIcon icon={ArrowDown} />
            <ButtonText>{source.downvotes}</ButtonText>
          </Button>
        </View>

        <Text style={[a.text_sm, a.text_center, {color: t.atoms.text_contrast_medium.color}]}>
          <Trans>Added on {new Date(source.createdAt).toLocaleDateString()}</Trans>
        </Text>
      </View>

      <View style={[a.p_lg]}>
        <Text
          style={[a.text_xl, a.font_bold, a.mb_lg, {color: t.atoms.text.color}]}
          accessibilityRole="header">
          <Trans>Comments ({comments.length})</Trans>
        </Text>
        
        <View style={[a.mb_lg]}>
          <TextInput
            style={[
              a.border,
              a.rounded_md,
              a.p_md,
              a.text_md,
              a.mb_sm,
              {
                borderColor: t.atoms.border_contrast_medium.borderColor,
                backgroundColor: t.atoms.bg.backgroundColor,
                color: t.atoms.text.color,
                minHeight: 80,
                textAlignVertical: 'top',
              }
            ]}
            placeholder={_(msg`Add a comment...`)}
            placeholderTextColor={t.atoms.text_contrast_medium.color}
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
            accessibilityLabel={_(msg`Comment input field`)}
            accessibilityHint={_(msg`Enter your comment about this source`)}
          />
          <Button
            variant="solid"
            color="primary"
            size="small"
            disabled={!newComment.trim() || isAddingComment}
            onPress={handleAddComment}
            label={_(msg`Post comment`)}
            style={[a.self_end]}>
            <ButtonText>
              <Trans>{isAddingComment ? 'Posting...' : 'Post'}</Trans>
            </ButtonText>
          </Button>
        </View>

        {comments.map(comment => (
          <View 
            key={comment.id} 
            style={[
              a.p_md,
              a.mb_md,
              a.rounded_md,
              {backgroundColor: t.atoms.bg_contrast_25.backgroundColor}
            ]}>
            <View style={[a.flex_row, a.justify_between, a.align_center, a.mb_sm]}>
              <Text style={[a.text_sm, a.font_bold, {color: t.atoms.text.color}]}>
                {comment.author.displayName || comment.author.handle}
              </Text>
              <Text style={[a.text_xs, {color: t.atoms.text_contrast_medium.color}]}>
                {new Date(comment.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Text style={[a.text_md, a.leading_normal, {color: t.atoms.text.color}]}>
              {comment.content}
            </Text>
          </View>
        ))}

        {comments.length === 0 && (
          <Text style={[
            a.text_md,
            a.text_center,
            a.italic,
            a.mt_lg,
            {color: t.atoms.text_contrast_medium.color}
          ]}>
            <Trans>No comments yet. Be the first to share your thoughts!</Trans>
          </Text>
        )}
      </View>
          </>
        )}
      </Layout.Content>
    </Layout.Screen>
  )
}

