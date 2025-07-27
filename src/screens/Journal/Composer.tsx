import React, {useState, useCallback, useRef} from 'react'
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
// Note: Location functionality requires expo-location package
// import * as Location from 'expo-location'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {useAgent, useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Text} from '#/components/Typography'
import * as Toast from '#/view/com/util/Toast'
import {cleanError} from '#/lib/strings/errors'
import {logger} from '#/logger'
import {isIOS} from '#/platform/detection'
import {SourcePicker, type Source as SourceType} from '#/components/SourcePicker'

// Types for journal entry
interface Symptom {
  category: 'physical_pain' | 'neurological' | 'psychological' | 'sleep_disruption' | 'cognitive_impairment' | 'sensory_anomaly' | 'technology_interference' | 'surveillance_indication' | 'other'
  subcategory?: string
  severity: number // 1-10 scale
  duration?: string
  notes?: string
}

interface Source {
  url: string
  title: string
  description?: string
  accessedAt?: string
}

interface JournalEntry {
  text: string
  entryType: 'real_time' | 'backdated'
  incidentTimestamp?: string
  location?: {
    latitude: number
    longitude: number
    accuracy?: number
    address?: string
  }
  symptoms?: Symptom[]
  evidenceUris?: string[]
  sourceIds?: string[]
  tags?: string[]
  isPrivate: boolean
  createdAt: string
}

interface Props {
  onSuccess?: () => void
  onCancel?: () => void
}

export function JournalComposer({onSuccess, onCancel}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const agent = useAgent()
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  
  // Form state
  const [text, setText] = useState('')
  const [entryType, setEntryType] = useState<'real_time' | 'backdated'>('real_time')
  const [incidentTimestamp, setIncidentTimestamp] = useState<Date | null>(null)
  const [location, setLocation] = useState<JournalEntry['location'] | null>(null)
  const [isPrivate, setIsPrivate] = useState(false)
  const [symptoms, setSymptoms] = useState<Symptom[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [sources, setSources] = useState<SourceType[]>([])
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false)
  
  const textInputRef = useRef<TextInput>(null)

  // Location handling - placeholder implementation
  const requestLocationPermission = useCallback(async () => {
    try {
      // TODO: Implement proper location functionality with expo-location
      // For now, use a placeholder implementation
      Alert.alert(
        _(msg`Location Feature`),
        _(msg`Location functionality requires expo-location package to be installed. This will be implemented in a future version.`),
        [
          {
            text: _(msg`Add Mock Location`),
            onPress: () => {
              setLocation({
                latitude: 37.7749,
                longitude: -122.4194,
                accuracy: 10,
                address: 'Sample Location, San Francisco, CA',
              })
              setLocationPermissionGranted(true)
            },
          },
          {text: _(msg`Cancel`), style: 'cancel'},
        ]
      )
    } catch (error) {
      logger.error('Failed to get location', {message: String(error)})
      Toast.show(_(msg`Failed to get location`), 'xmark')
    }
  }, [_])

  // Add symptom
  const addSymptom = useCallback(() => {
    const newSymptom: Symptom = {
      category: 'other',
      severity: 5,
    }
    setSymptoms(prev => [...prev, newSymptom])
  }, [])

  // Remove symptom
  const removeSymptom = useCallback((index: number) => {
    setSymptoms(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Update symptom
  const updateSymptom = useCallback((index: number, updates: Partial<Symptom>) => {
    setSymptoms(prev => prev.map((symptom, i) => 
      i === index ? {...symptom, ...updates} : symptom
    ))
  }, [])

  // Submit journal entry
  const submitMutation = useMutation({
    mutationFn: async (entry: JournalEntry) => {
      if (!currentAccount) throw new Error('Not authenticated')
      
      const record = {
        $type: 'app.warlog.journal',
        ...entry,
      }

      // Create the journal record via AT Protocol
      const response = await agent.com.atproto.repo.createRecord({
        repo: currentAccount.did,
        collection: 'app.warlog.journal',
        record,
      })

      return response
    },
    onSuccess: () => {
      Toast.show(_(msg`Journal entry saved successfully`))
      queryClient.invalidateQueries({queryKey: ['journal-entries']})
      onSuccess?.()
    },
    onError: (error) => {
      logger.error('Failed to save journal entry', {message: String(error)})
      Toast.show(_(msg`Failed to save journal entry: ${cleanError(error)}`), 'xmark')
    },
  })

  const handleSubmit = useCallback(() => {
    if (!text.trim()) {
      Toast.show(_(msg`Please enter journal entry text`), 'xmark')
      return
    }

    if (!currentAccount) {
      Toast.show(_(msg`You must be logged in to create journal entries`), 'xmark')
      return
    }

    const entry: JournalEntry = {
      text: text.trim(),
      entryType,
      incidentTimestamp: incidentTimestamp?.toISOString(),
      location: location || undefined,
      symptoms: symptoms.length > 0 ? symptoms : undefined,
      sourceIds: sources.length > 0 ? sources.map(source => source.id) : undefined,
      tags: tags.length > 0 ? tags : undefined,
      isPrivate,
      createdAt: new Date().toISOString(),
    }

    setIsSubmitting(true)
    submitMutation.mutate(entry)
  }, [text, entryType, incidentTimestamp, location, symptoms, sources, tags, isPrivate, currentAccount, submitMutation, _])

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={isIOS ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}>
      <View style={[styles.header, {backgroundColor: t.palette.white}]}>
        <Button
          variant="ghost"
          size="small"
          onPress={onCancel}
          label={_(msg`Cancel`)}>
          <ButtonText>
            <Trans>Cancel</Trans>
          </ButtonText>
        </Button>
        
        <Text style={[a.text_lg, a.font_bold]}>
          <Trans>New Journal Entry</Trans>
        </Text>
        
        <Button
          variant="solid"
          color="primary"
          size="small"
          disabled={isSubmitting || !text.trim()}
          onPress={handleSubmit}
          label={_(msg`Save`)}>
          <ButtonText>
            <Trans>Save</Trans>
          </ButtonText>
        </Button>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        
        {/* Entry Type Selection */}
        <View style={styles.section}>
          <Text style={[a.text_sm, a.font_bold, a.pb_sm]}>
            <Trans>Entry Type</Trans>
          </Text>
          <View style={styles.buttonRow}>
            <Button
              variant={entryType === 'real_time' ? 'solid' : 'outline'}
              color="primary"
              size="small"
              onPress={() => setEntryType('real_time')}
              label={_(msg`Real-time`)}>
              <ButtonText>
                <Trans>Real-time</Trans>
              </ButtonText>
            </Button>
            <Button
              variant={entryType === 'backdated' ? 'solid' : 'outline'}
              color="primary"
              size="small"
              onPress={() => setEntryType('backdated')}
              label={_(msg`Backdated`)}>
              <ButtonText>
                <Trans>Backdated</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>

        {/* Main Text Entry */}
        <View style={styles.section}>
          <Text style={[a.text_sm, a.font_bold, a.pb_sm]}>
            <Trans>Journal Entry</Trans>
          </Text>
          <TextInput
            ref={textInputRef}
            style={[styles.textInput, {backgroundColor: t.palette.contrast_50}]}
            value={text}
            onChangeText={setText}
            placeholder={_(msg`Describe what happened, when, where, and any relevant details...`)}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            autoCorrect
            autoCapitalize="sentences"
          />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[a.text_sm, a.font_bold]}>
              <Trans>Location</Trans>
            </Text>
            <Button
              variant="outline"
              size="small"
              onPress={requestLocationPermission}
              disabled={!!location}
              label={_(msg`Get Current Location`)}>
              <ButtonText>
                {location ? <Trans>Location Added</Trans> : <Trans>Add Location</Trans>}
              </ButtonText>
            </Button>
          </View>
          {location && (
            <View style={styles.locationInfo}>
              <Text style={[a.text_xs, {color: t.palette.contrast_600}]}>
                {location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
              </Text>
              <Button
                variant="ghost"
                size="small"
                onPress={() => setLocation(null)}
                label={_(msg`Remove location`)}>
                <ButtonText style={{color: t.palette.negative_500}}>
                  <Trans>Remove</Trans>
                </ButtonText>
              </Button>
            </View>
          )}
        </View>

        {/* Symptoms */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[a.text_sm, a.font_bold]}>
              <Trans>Symptoms</Trans>
            </Text>
            <Button
              variant="outline"
              size="small"
              onPress={addSymptom}
              label={_(msg`Add Symptom`)}>
              <ButtonText>
                <Trans>Add Symptom</Trans>
              </ButtonText>
            </Button>
          </View>
          {symptoms.map((symptom, index) => (
            <View key={index} style={styles.symptomItem}>
              <Text style={[a.text_xs, {color: t.palette.contrast_600}]}>
                {symptom.category} - Severity: {symptom.severity}/10
              </Text>
              <Button
                variant="ghost"
                size="small"
                onPress={() => removeSymptom(index)}
                label={_(msg`Remove symptom`)}>
                <ButtonText style={{color: t.palette.negative_500}}>
                  <Trans>Remove</Trans>
                </ButtonText>
              </Button>
            </View>
          ))}
        </View>

        {/* Sources */}
        <View style={styles.section}>
          <Text style={[a.text_sm, a.font_bold, a.pb_sm]}>
            <Trans>Sources</Trans>
          </Text>
          <SourcePicker
            selectedSources={sources}
            onSourcesChange={setSources}
            onInsertCitation={(sourceIndex) => {
              // For journal entries, we could insert citations into the text
              console.log(`Insert citation [${sourceIndex}] into journal text`)
            }}
          />
        </View>

        {/* Privacy Setting */}
        <View style={styles.section}>
          <View style={styles.buttonRow}>
            <Button
              variant={isPrivate ? 'solid' : 'outline'}
              color={isPrivate ? 'secondary' : 'primary'}
              size="small"
              onPress={() => setIsPrivate(!isPrivate)}
              label={_(msg`Toggle privacy`)}>
              <ButtonText>
                {isPrivate ? <Trans>Private Entry</Trans> : <Trans>Public Entry</Trans>}
              </ButtonText>
            </Button>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  symptomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    marginBottom: 4,
  },
}) 