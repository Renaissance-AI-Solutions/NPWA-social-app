import {useState, useMemo} from 'react'
import {View, Text, TouchableOpacity, Linking} from 'react-native'
import {atoms as a, useTheme} from '#/alf'
import {type Source} from '#/components/SourcePicker'

interface SourceDisplayProps {
  sources: Source[]
  maxVisibleSources?: number
  showBadgeFilter?: boolean
  onSourcePress?: (source: Source) => void
}

export function SourceDisplay({
  sources,
  maxVisibleSources = 3,
  showBadgeFilter = false,
  onSourcePress,
}: SourceDisplayProps) {
  const t = useTheme()
  const [isExpanded, setIsExpanded] = useState(false)
  const [badgeFilter, setBadgeFilter] = useState<Source['badgeType'] | null>(null)

  const filteredSources = useMemo(() => {
    if (!badgeFilter) return sources
    return sources.filter(source => source.badgeType === badgeFilter)
  }, [sources, badgeFilter])

  const visibleSources = useMemo(() => {
    if (isExpanded) return filteredSources
    return filteredSources.slice(0, maxVisibleSources)
  }, [filteredSources, isExpanded, maxVisibleSources])

  const hasMoreSources = filteredSources.length > maxVisibleSources

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

  const handleSourcePress = (source: Source) => {
    if (onSourcePress) {
      onSourcePress(source)
    } else if (source.url) {
      Linking.openURL(source.url)
    }
  }

  if (sources.length === 0) {
    return null
  }

  return (
    <View style={[a.mt_sm]}>
      {/* Badge Filter */}
      {showBadgeFilter && (
        <View style={[a.flex_row, a.gap_xs, a.mb_sm]}>
          <TouchableOpacity
            style={[
              a.px_sm,
              a.py_xs,
              a.rounded_sm,
              {backgroundColor: badgeFilter === null ? '#3b82f6' : '#e5e7eb'},
            ]}
            onPress={() => setBadgeFilter(null)}>
            <Text style={[a.text_xs, a.font_bold, {color: badgeFilter === null ? 'white' : '#6b7280'}]}>
              All
            </Text>
          </TouchableOpacity>
          {['havana', 'gangstalked', 'targeted', 'whistleblower', 'retaliation'].map(badge => (
            <TouchableOpacity
              key={badge}
              style={[
                a.px_sm,
                a.py_xs,
                a.rounded_sm,
                {backgroundColor: badgeFilter === badge ? '#3b82f6' : '#e5e7eb'},
              ]}
              onPress={() => setBadgeFilter(badge as Source['badgeType'])}>
              <Text style={[a.text_xs, a.font_bold, {color: badgeFilter === badge ? 'white' : '#6b7280'}]}>
                {badge}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Sources List */}
      <View style={[a.border_t, {borderTopColor: t.atoms.border_contrast_low.borderColor}, a.pt_sm]}>
        <Text style={[a.text_sm, a.font_bold, a.mb_xs, {color: t.atoms.text.color}]}>
          Sources ({filteredSources.length})
        </Text>
        
        {visibleSources.map((source, index) => (
          <TouchableOpacity
            key={source.id}
            style={[
              a.flex_row,
              a.align_center,
              a.py_xs,
              a.px_sm,
              a.mb_xs,
              a.rounded_sm,
              {backgroundColor: t.atoms.bg_contrast_25.backgroundColor},
            ]}
            onPress={() => handleSourcePress(source)}>
            {/* Citation Number */}
            <View
              style={[
                a.w_6,
                a.h_6,
                a.rounded_full,
                a.align_center,
                a.justify_center,
                a.mr_sm,
                {backgroundColor: '#3b82f6'},
              ]}>
              <Text style={[a.text_xs, a.font_bold, {color: 'white'}]}>
                {index + 1}
              </Text>
            </View>

            {/* Source Info */}
            <View style={[a.flex_1]}>
              <Text style={[a.text_sm, a.font_bold, {color: t.atoms.text.color}]} numberOfLines={1}>
                {source.name}
              </Text>
              {source.url && (
                <Text style={[a.text_xs, {color: t.atoms.text_contrast_medium.color}]} numberOfLines={1}>
                  {source.url}
                </Text>
              )}
            </View>

            {/* Rank Badge */}
            <View
              style={[
                a.px_xs,
                a.py_xs,
                a.rounded_sm,
                a.mr_sm,
                {backgroundColor: getRankColor(source.rank)},
              ]}>
              <Text style={[a.text_xs, a.font_bold, {color: 'white'}]}>
                {source.rank.replace('_', ' ').toUpperCase()}
              </Text>
            </View>

            {/* Vote Count */}
            <Text style={[a.text_xs, {color: t.atoms.text_contrast_medium.color}]}>
              ↑{source.upvotes} ↓{source.downvotes}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Expand/Collapse Button */}
        {hasMoreSources && (
          <TouchableOpacity
            style={[a.align_center, a.py_sm]}
            onPress={() => setIsExpanded(!isExpanded)}>
            <Text style={[a.text_sm, a.font_bold, {color: '#3b82f6'}]}>
              {isExpanded 
                ? `Show Less (${maxVisibleSources} of ${filteredSources.length})`
                : `Show More (${filteredSources.length - maxVisibleSources} more)`
              }
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

// Helper component for inline citations within text
interface InlineCitationsProps {
  text: string
  sources: Source[]
  onCitationPress?: (sourceIndex: number) => void
}

export function InlineCitations({text, sources, onCitationPress}: InlineCitationsProps) {
  const t = useTheme()
  
  // Parse text for citation patterns like [1], [2], etc.
  const parts = text.split(/(\[\d+\])/g)
  
  return (
    <Text style={[{color: t.atoms.text.color}]}>
      {parts.map((part, index) => {
        const citationMatch = part.match(/\[(\d+)\]/)
        if (citationMatch) {
          const citationIndex = parseInt(citationMatch[1], 10)
          const source = sources[citationIndex - 1] // Convert to 0-based index
          
          if (source) {
            return (
              <TouchableOpacity
                key={index}
                onPress={() => onCitationPress?.(citationIndex)}
                style={[a.inline]}>
                <Text style={[a.text_sm, a.font_bold, {color: '#3b82f6'}]}>
                  {part}
                </Text>
              </TouchableOpacity>
            )
          }
        }
        return (
          <Text key={index} style={[a.text_sm]}>
            {part}
          </Text>
        )
      })}
    </Text>
  )
} 