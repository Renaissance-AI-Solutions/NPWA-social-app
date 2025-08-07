import React, {useState, useCallback, useMemo} from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Share,
  Platform,
} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {useNavigation} from '@react-navigation/native'

import {useAgent, useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText, ButtonIcon} from '#/components/Button'
import {Text} from '#/components/Typography'
import {PencilLine_Stroke2_Corner0_Rounded as Edit} from '#/components/icons/Pencil'
import {Trash_Stroke2_Corner0_Rounded as Delete} from '#/components/icons/Trash'
import {ArrowShareRight_Stroke2_Corner2_Rounded as ShareIcon} from '#/components/icons/ArrowShareRight'
import {Clock_Stroke2_Corner0_Rounded as Clock} from '#/components/icons/Clock'
import {Globe_Stroke2_Corner0_Rounded as Globe} from '#/components/icons/Globe'
import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import {Pin_Stroke2_Corner0_Rounded as Location} from '#/components/icons/Pin'
import {Image_Stroke2_Corner0_Rounded as Image} from '#/components/icons/Image'
import {PageText_Stroke2_Corner0_Rounded as Document} from '#/components/icons/PageText'
import {Eye_Stroke2_Corner0_Rounded as Eye} from '#/components/icons/Eye'
import {Group3_Stroke2_Corner0_Rounded as PersonGroup} from '#/components/icons/Group'
import {Shield_Stroke2_Corner0_Rounded as Shield} from '#/components/icons/Shield'
import {SourceDisplay} from '#/components/SourceDisplay'
import {PrivacyControls, type VisibilityLevel} from '#/components/PrivacyControls'
import {logger} from '#/logger'
import {cleanError} from '#/lib/strings/errors'

// Types
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
  sourceIds?: string[]
  evidenceAttachments?: Array<{
    uri: string
    type: 'image' | 'document' | 'audio' | 'video'
    filename: string
    size?: number
    description?: string
  }>
  isPrivate: boolean
  visibility: 'private' | 'contacts' | 'community' | 'public'
  createdAt: string
  updatedAt?: string
}

interface Props {
  entryUri: string
}

export function JournalEntryDetail({entryUri}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const navigation = useNavigation()
  const agent = useAgent()
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()

  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [editedTags, setEditedTags] = useState('')
  const [editedVisibility, setEditedVisibility] = useState<VisibilityLevel>('private')
  const [showEvidenceViewer, setShowEvidenceViewer] = useState(false)
  const [selectedEvidence, setSelectedEvidence] = useState<number>(0)

  // Fetch journal entry
  const {
    data: entry,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['journal-entry', entryUri],
    queryFn: async () => {
      if (!currentAccount) throw new Error('No account')
      
      try {
        const response = await agent.com.atproto.repo.getRecord({
          repo: currentAccount.did,
          collection: 'app.warlog.journal',
          rkey: entryUri.split('/').pop() || '',
        })

        return {
          uri: entryUri,
          cid: response.data.cid,
          ...response.data.value,
        } as JournalEntry
      } catch (err) {
        logger.error('Failed to fetch journal entry', {message: String(err)})
        throw err
      }
    },
    enabled: !!currentAccount && !!entryUri,
  })

  // Delete entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async () => {
      if (!currentAccount || !entry) throw new Error('Missing data')
      
      await agent.com.atproto.repo.deleteRecord({
        repo: currentAccount.did,
        collection: 'app.warlog.journal',
        rkey: entry.uri.split('/').pop() || '',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['journal-entries']})
      navigation.goBack()
    },
    onError: (error) => {
      logger.error('Failed to delete journal entry', {message: String(error)})
      Alert.alert(
        _(msg`Delete Failed`),
        _(msg`Could not delete the journal entry. Please try again.`)
      )
    },
  })

  // Update entry mutation
  const updateEntryMutation = useMutation({
    mutationFn: async ({text, tags, visibility}: {text: string; tags: string[]; visibility?: VisibilityLevel}) => {
      if (!currentAccount || !entry) throw new Error('Missing data')
      
      const updatedEntry = {
        ...entry,
        text,
        tags,
        visibility: visibility || entry.visibility,
        updatedAt: new Date().toISOString(),
      }

      await agent.com.atproto.repo.putRecord({
        repo: currentAccount.did,
        collection: 'app.warlog.journal',
        rkey: entry.uri.split('/').pop() || '',
        record: updatedEntry,
      })

      return updatedEntry
    },
    onSuccess: (updatedEntry) => {
      queryClient.invalidateQueries({queryKey: ['journal-entries']})
      queryClient.setQueryData(['journal-entry', entryUri], updatedEntry)
      setIsEditing(false)
    },
    onError: (error) => {
      logger.error('Failed to update journal entry', {message: String(error)})
      Alert.alert(
        _(msg`Update Failed`),
        _(msg`Could not update the journal entry. Please try again.`)
      )
    },
  })

  const handleEdit = useCallback(() => {
    if (!entry) return
    setEditedText(entry.text)
    setEditedTags(entry.tags?.join(', ') || '')
    setEditedVisibility(entry.visibility as VisibilityLevel)
    setIsEditing(true)
  }, [entry])

  const handleSave = useCallback(() => {
    const tags = editedTags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
    
    updateEntryMutation.mutate({
      text: editedText,
      tags,
      visibility: editedVisibility,
    })
  }, [editedText, editedTags, editedVisibility, updateEntryMutation])

  const handleCancel = useCallback(() => {
    setIsEditing(false)
    setEditedText('')
    setEditedTags('')
    setEditedVisibility('private')
  }, [])

  const handleDelete = useCallback(() => {
    Alert.alert(
      _(msg`Delete Entry`),
      _(msg`Are you sure you want to delete this journal entry? This action cannot be undone.`),
      [
        {
          text: _(msg`Cancel`),
          style: 'cancel',
        },
        {
          text: _(msg`Delete`),
          style: 'destructive',
          onPress: () => deleteEntryMutation.mutate(),
        },
      ]
    )
  }, [_, deleteEntryMutation])

  const handleShare = useCallback(async () => {
    if (!entry) return

    try {
      if (entry.isPrivate) {
        Alert.alert(
          _(msg`Private Entry`),
          _(msg`This is a private entry and cannot be shared.`)
        )
        return
      }

      const shareText = `Journal Entry from ${new Date(entry.createdAt).toLocaleDateString()}\n\n${entry.text}`
      
      await Share.share({
        title: _(msg`Journal Entry`),
        message: shareText,
      })
    } catch (error) {
      logger.error('Failed to share journal entry', {message: String(error)})
    }
  }, [entry, _])

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  const visibilityIcon = useMemo(() => {
    if (!entry) return null
    
    switch (entry.visibility) {
      case 'private':
        return <Lock size="sm" fill={t.palette.contrast_600} />
      case 'contacts':
        return <PersonGroup size="sm" fill={t.palette.primary_600} />
      case 'community':
        return <Shield size="sm" fill={t.palette.secondary_600} />
      case 'public':
        return <Globe size="sm" fill={t.palette.positive_600} />
      default:
        return <Lock size="sm" fill={t.palette.contrast_600} />
    }
  }, [entry, t])
  
  const renderEvidenceViewer = useCallback(() => {
    if (!entry?.evidenceAttachments || entry.evidenceAttachments.length === 0) {
      return null
    }
    
    return (
      <View style={[styles.section, {backgroundColor: t.palette.white}]}>
        <Text style={[a.text_md, a.font_semi_bold, a.mb_sm]}>
          <Trans>Evidence Attachments</Trans>
        </Text>
        <View style={styles.evidenceGrid}>
          {entry.evidenceAttachments.map((evidence, index) => {
            const isImage = evidence.type === 'image'
            const isDocument = evidence.type === 'document'
            
            return (
              <Button
                key={index}
                variant="outline"
                color="secondary"
                size="medium"
                onPress={() => {
                  setSelectedEvidence(index)
                  setShowEvidenceViewer(true)
                }}
                label={evidence.filename}
                style={styles.evidenceItem}>
                <View style={styles.evidenceContent}>
                  <View style={[styles.evidenceIcon, {backgroundColor: t.palette.contrast_100}]}>
                    {isImage ? (
                      <Image size="sm" fill={t.palette.primary_600} />
                    ) : (
                      <Document size="sm" fill={t.palette.secondary_600} />
                    )}
                  </View>
                  <View style={styles.evidenceInfo}>
                    <Text 
                      style={[a.text_sm, a.font_semi_bold, {color: t.palette.contrast_800}]}
                      numberOfLines={1}>
                      {evidence.filename}
                    </Text>
                    <Text style={[a.text_xs, {color: t.palette.contrast_600}]}>
                      {evidence.type.toUpperCase()}
                      {evidence.size && ` • ${(evidence.size / 1024).toFixed(1)}KB`}
                    </Text>
                    {evidence.description && (
                      <Text 
                        style={[a.text_xs, {color: t.palette.contrast_500}]}
                        numberOfLines={2}>
                        {evidence.description}
                      </Text>
                    )}
                  </View>
                </View>
              </Button>
            )
          })}
        </View>
      </View>
    )
  }, [entry, t, _])

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, {backgroundColor: t.palette.contrast_25}]}>
        <Text style={[a.text_lg]}>
          <Trans>Loading entry...</Trans>
        </Text>
      </View>
    )
  }

  if (error || !entry) {
    return (
      <View style={[styles.container, styles.centered, {backgroundColor: t.palette.contrast_25}]}>
        <Text style={[a.text_lg, a.font_bold, a.text_center, a.mb_md]}>
          <Trans>Entry Not Found</Trans>
        </Text>
        <Text style={[a.text_md, a.text_center, {color: t.palette.contrast_600}]}>
          {error ? cleanError(String(error)) : _(msg`This journal entry could not be loaded.`)}
        </Text>
        <Button
          variant="solid"
          color="primary"
          size="large"
          onPress={() => navigation.goBack()}
          label={_(msg`Go Back`)}
          style={a.mt_lg}>
          <ButtonText>
            <Trans>Go Back</Trans>
          </ButtonText>
        </Button>
      </View>
    )
  }

  const entryDate = new Date(entry.createdAt)
  const incidentDate = entry.incidentTimestamp ? new Date(entry.incidentTimestamp) : null
  const isBackdated = incidentDate && incidentDate.getTime() !== entryDate.getTime()

  return (
    <View style={[styles.container, {backgroundColor: t.palette.contrast_25}]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: t.palette.white}]}>
        <View style={styles.headerRow}>
          <Text style={[a.text_lg, a.font_bold]}>
            <Trans>Journal Entry</Trans>
          </Text>
          <View style={styles.headerActions}>
            {!isEditing && (
              <>
                <Button
                  variant="ghost"
                  color="primary"
                  size="small"
                  onPress={handleShare}
                  label={_(msg`Share`)}
                  style={styles.actionButton}>
                  <ButtonIcon icon={ShareIcon} />
                </Button>
                <Button
                  variant="ghost"
                  color="primary"
                  size="small"
                  onPress={handleEdit}
                  label={_(msg`Edit`)}
                  style={styles.actionButton}>
                  <ButtonIcon icon={Edit} />
                </Button>
                <Button
                  variant="ghost"
                  color="negative"
                  size="small"
                  onPress={handleDelete}
                  label={_(msg`Delete`)}
                  style={styles.actionButton}>
                  <ButtonIcon icon={Delete} />
                </Button>
              </>
            )}
            {isEditing && (
              <>
                <Button
                  variant="outline"
                  color="primary"
                  size="small"
                  onPress={handleCancel}
                  label={_(msg`Cancel`)}
                  style={styles.actionButton}>
                  <ButtonText>
                    <Trans>Cancel</Trans>
                  </ButtonText>
                </Button>
                <Button
                  variant="solid"
                  color="primary"
                  size="small"
                  onPress={handleSave}
                  disabled={updateEntryMutation.isPending}
                  label={_(msg`Save`)}
                  style={styles.actionButton}>
                  <ButtonText>
                    <Trans>Save</Trans>
                  </ButtonText>
                </Button>
              </>
            )}
          </View>
        </View>

        {/* Entry Meta */}
        <View style={styles.metaContainer}>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Clock size="sm" fill={t.palette.contrast_600} />
              <Text style={[a.text_xs, {color: t.palette.contrast_600}]}>
                {entry.entryType === 'real_time' ? _(msg`Real-time`) : _(msg`Backdated`)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              {visibilityIcon}
              <Text style={[a.text_xs, {color: t.palette.contrast_600}]}>
                {entry.visibility.charAt(0).toUpperCase() + entry.visibility.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={[a.text_xs, {color: t.palette.contrast_500}]}>
            Created: {formatDate(entry.createdAt)}
          </Text>
          {entry.updatedAt && (
            <Text style={[a.text_xs, {color: t.palette.contrast_500}]}>
              Updated: {formatDate(entry.updatedAt)}
            </Text>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          {/* Entry Text */}
          <View style={[styles.section, {backgroundColor: t.palette.white}]}>
            <Text style={[a.text_md, a.font_semi_bold, a.mb_sm]}>
              <Trans>Entry</Trans>
            </Text>
            {isEditing ? (
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: t.palette.contrast_800,
                    borderColor: t.palette.contrast_200,
                  },
                ]}
                value={editedText}
                onChangeText={setEditedText}
                multiline
                placeholder={_(msg`Write your journal entry...`)}
                placeholderTextColor={t.palette.contrast_400}
                textAlignVertical="top"
              />
            ) : (
              <Text style={[a.text_md, a.leading_normal]}>
                {entry.text}
              </Text>
            )}
          </View>

          {/* Incident Date */}
          {isBackdated && incidentDate && (
            <View style={[styles.section, {backgroundColor: t.palette.white}]}>
              <Text style={[a.text_md, a.font_semi_bold, a.mb_sm]}>
                <Trans>Incident Date</Trans>
              </Text>
              <Text style={[a.text_md, {color: t.palette.contrast_700}]}>
                {formatDate(incidentDate.toISOString())}
              </Text>
            </View>
          )}

          {/* Location */}
          {entry.location && (
            <View style={[styles.section, {backgroundColor: t.palette.white}]}>
              <Text style={[a.text_md, a.font_semi_bold, a.mb_sm]}>
                <Trans>Location</Trans>
              </Text>
              <View style={styles.locationContainer}>
                <Location size="sm" fill={t.palette.contrast_600} />
                <Text style={[a.text_md, {color: t.palette.contrast_700}]}>
                  {entry.location.address || 
                   `${entry.location.latitude.toFixed(6)}, ${entry.location.longitude.toFixed(6)}`}
                </Text>
              </View>
              {entry.location.accuracy && (
                <Text style={[a.text_sm, {color: t.palette.contrast_500}, a.mt_xs]}>
                  Accuracy: {entry.location.accuracy.toFixed(0)}m
                </Text>
              )}
            </View>
          )}

          {/* Symptoms */}
          {entry.symptoms && entry.symptoms.length > 0 && (
            <View style={[styles.section, {backgroundColor: t.palette.white}]}>
              <Text style={[a.text_md, a.font_semi_bold, a.mb_sm]}>
                <Trans>Symptoms</Trans>
              </Text>
              {entry.symptoms.map((symptom, index) => (
                <View key={index} style={styles.symptomItem}>
                  <Text style={[a.text_md, {color: t.palette.contrast_700}]}>
                    {symptom.category}
                  </Text>
                  <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
                    Severity: {symptom.severity}/10
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Privacy & Visibility */}
          <View style={[styles.section, {backgroundColor: t.palette.white}]}>
            <Text style={[a.text_md, a.font_semi_bold, a.mb_sm]}>
              <Trans>Privacy & Visibility</Trans>
            </Text>
            {isEditing ? (
              <PrivacyControls
                visibility={editedVisibility}
                onVisibilityChange={setEditedVisibility}
                showDetailed={true}
                hasBadge={true} // TODO: Check actual badge status
              />
            ) : (
              <View style={styles.visibilityDisplay}>
                <View style={styles.visibilityItem}>
                  {visibilityIcon}
                  <Text style={[a.text_md, {color: t.palette.contrast_700}]}>
                    {entry.visibility.charAt(0).toUpperCase() + entry.visibility.slice(1)}
                  </Text>
                </View>
                <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
                  {entry.visibility === 'private' && _(msg`Only you can see this entry`)}
                  {entry.visibility === 'contacts' && _(msg`Visible to people you follow`)}
                  {entry.visibility === 'community' && _(msg`Visible to badge community`)}
                  {entry.visibility === 'public' && _(msg`Visible to everyone`)}
                </Text>
              </View>
            )}
          </View>
          
          {/* Tags */}
          <View style={[styles.section, {backgroundColor: t.palette.white}]}>
            <Text style={[a.text_md, a.font_semi_bold, a.mb_sm]}>
              <Trans>Tags</Trans>
            </Text>
            {isEditing ? (
              <TextInput
                style={[
                  styles.tagsInput,
                  {
                    color: t.palette.contrast_800,
                    borderColor: t.palette.contrast_200,
                  },
                ]}
                value={editedTags}
                onChangeText={setEditedTags}
                placeholder={_(msg`tag1, tag2, tag3...`)}
                placeholderTextColor={t.palette.contrast_400}
              />
            ) : entry.tags && entry.tags.length > 0 ? (
              <View style={styles.tagsContainer}>
                {entry.tags.map((tag, index) => (
                  <View
                    key={index}
                    style={[styles.tag, {backgroundColor: t.palette.primary_100}]}>
                    <Text style={[a.text_sm, {color: t.palette.primary_700}]}>
                      #{tag}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[a.text_md, {color: t.palette.contrast_500}]}>
                <Trans>No tags</Trans>
              </Text>
            )}
          </View>
          
          {/* Evidence Attachments */}
          {renderEvidenceViewer()}

          {/* Sources */}
          {entry.sourceIds && entry.sourceIds.length > 0 && (
            <View style={[styles.section, {backgroundColor: t.palette.white}]}>
              <Text style={[a.text_md, a.font_semi_bold, a.mb_sm]}>
                <Trans>Sources & Citations</Trans>
              </Text>
              <SourceDisplay sourceIds={entry.sourceIds} />
            </View>
          )}
          
          {/* Entry History */}
          <View style={[styles.section, {backgroundColor: t.palette.white}]}>
            <Text style={[a.text_md, a.font_semi_bold, a.mb_sm]}>
              <Trans>Entry History</Trans>
            </Text>
            <View style={styles.historyItem}>
              <View style={[styles.historyDot, {backgroundColor: t.palette.positive_600}]} />
              <View style={styles.historyContent}>
                <Text style={[a.text_sm, a.font_semi_bold, {color: t.palette.contrast_700}]}>
                  <Trans>Created</Trans>
                </Text>
                <Text style={[a.text_xs, {color: t.palette.contrast_600}]}>
                  {formatDate(entry.createdAt)}
                </Text>
              </View>
            </View>
            {entry.updatedAt && (
              <View style={styles.historyItem}>
                <View style={[styles.historyDot, {backgroundColor: t.palette.primary_600}]} />
                <View style={styles.historyContent}>
                  <Text style={[a.text_sm, a.font_semi_bold, {color: t.palette.contrast_700}]}>
                    <Trans>Last Updated</Trans>
                  </Text>
                  <Text style={[a.text_xs, {color: t.palette.contrast_600}]}>
                    {formatDate(entry.updatedAt)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    minWidth: 40,
  },
  metaContainer: {
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
  },
  tagsInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symptomItem: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  visibilityDisplay: {
    gap: 8,
  },
  visibilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  evidenceGrid: {
    gap: 12,
  },
  evidenceItem: {
    padding: 0,
    alignItems: 'stretch',
  },
  evidenceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  evidenceIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  evidenceInfo: {
    flex: 1,
    gap: 2,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  historyContent: {
    flex: 1,
    gap: 2,
  },
})