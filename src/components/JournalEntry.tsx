import {View, Text, TouchableOpacity} from 'react-native'
import {atoms as a, useTheme} from '#/alf'
import {type Source} from '#/components/SourcePicker'
import {SourceDisplay, InlineCitations} from '#/components/SourceDisplay'

interface JournalEntryData {
  uri: string
  text: string
  entryType: 'real_time' | 'backdated'
  createdAt: string
  incidentTimestamp?: string
  location?: {
    latitude: number
    longitude: number
    address?: string
  }
  symptoms?: Array<{
    category: string
    severity: number
    notes?: string
  }>
  isPrivate: boolean
  sourceIds?: string[]
}

interface JournalEntryProps {
  entry: JournalEntryData
  sources?: Source[] // Populated sources based on sourceIds
  onPress?: () => void
  onSourcePress?: (source: Source) => void
  showFullText?: boolean
}

export function JournalEntry({
  entry,
  sources = [],
  onPress,
  onSourcePress,
  showFullText = false,
}: JournalEntryProps) {
  const t = useTheme()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getEntryTypeColor = (type: string) => {
    return type === 'real_time' ? '#22c55e' : '#f59e0b'
  }

  const getEntryTypeLabel = (type: string) => {
    return type === 'real_time' ? 'Real-time' : 'Backdated'
  }

  return (
    <TouchableOpacity
      style={[
        a.p_lg,
        a.mb_md,
        a.rounded_md,
        {backgroundColor: t.atoms.bg_contrast_25.backgroundColor},
        a.border,
        {borderColor: t.atoms.border_contrast_low.borderColor},
      ]}
      onPress={onPress}
      activeOpacity={0.7}>
      
      {/* Header */}
      <View style={[a.flex_row, a.align_center, a.justify_between, a.mb_sm]}>
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          {/* Entry Type Badge */}
          <View
            style={[
              a.px_sm,
              a.py_xs,
              a.rounded_sm,
              {backgroundColor: getEntryTypeColor(entry.entryType)},
            ]}>
            <Text style={[a.text_xs, a.font_bold, {color: 'white'}]}>
              {getEntryTypeLabel(entry.entryType)}
            </Text>
          </View>

          {/* Privacy Indicator */}
          {entry.isPrivate && (
            <View
              style={[
                a.px_sm,
                a.py_xs,
                a.rounded_sm,
                {backgroundColor: '#6b7280'},
              ]}>
              <Text style={[a.text_xs, a.font_bold, {color: 'white'}]}>
                Private
              </Text>
            </View>
          )}
        </View>

        {/* Date */}
        <Text style={[a.text_xs, {color: t.atoms.text_contrast_medium.color}]}>
          {formatDate(entry.createdAt)}
        </Text>
      </View>

      {/* Incident Timestamp */}
      {entry.incidentTimestamp && entry.incidentTimestamp !== entry.createdAt && (
        <View style={[a.mb_sm]}>
          <Text style={[a.text_xs, {color: t.atoms.text_contrast_medium.color}]}>
            Incident occurred: {formatDate(entry.incidentTimestamp)}
          </Text>
        </View>
      )}

      {/* Location */}
      {entry.location && (
        <View style={[a.mb_sm]}>
          <Text style={[a.text_xs, {color: t.atoms.text_contrast_medium.color}]}>
            📍 {entry.location.address || `${entry.location.latitude.toFixed(4)}, ${entry.location.longitude.toFixed(4)}`}
          </Text>
        </View>
      )}

      {/* Main Text with Inline Citations */}
      <View style={[a.mb_sm]}>
        {sources.length > 0 ? (
          <InlineCitations
            text={entry.text}
            sources={sources}
            onCitationPress={(sourceIndex) => {
              const source = sources[sourceIndex - 1]
              if (source && onSourcePress) {
                onSourcePress(source)
              }
            }}
          />
        ) : (
          <Text style={[a.text_md, {color: t.atoms.text.color}]} numberOfLines={showFullText ? undefined : 4}>
            {entry.text}
          </Text>
        )}
      </View>

      {/* Symptoms */}
      {entry.symptoms && entry.symptoms.length > 0 && (
        <View style={[a.mb_sm]}>
          <Text style={[a.text_sm, a.font_bold, a.mb_xs, {color: t.atoms.text.color}]}>
            Symptoms ({entry.symptoms.length})
          </Text>
          <View style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
            {entry.symptoms.slice(0, 3).map((symptom, index) => (
              <View
                key={index}
                style={[
                  a.px_sm,
                  a.py_xs,
                  a.rounded_sm,
                  {backgroundColor: '#fef3c7'},
                ]}>
                <Text style={[a.text_xs, {color: '#92400e'}]}>
                  {symptom.category} ({symptom.severity}/10)
                </Text>
              </View>
            ))}
            {entry.symptoms.length > 3 && (
              <View
                style={[
                  a.px_sm,
                  a.py_xs,
                  a.rounded_sm,
                  {backgroundColor: '#e5e7eb'},
                ]}>
                <Text style={[a.text_xs, {color: '#6b7280'}]}>
                  +{entry.symptoms.length - 3} more
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <SourceDisplay
          sources={sources}
          maxVisibleSources={2}
          onSourcePress={onSourcePress}
        />
      )}
    </TouchableOpacity>
  )
} 