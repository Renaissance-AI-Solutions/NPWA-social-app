import {useState, useCallback, useEffect} from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {useSourcesAPI, type Source} from '#/lib/api/sources'

interface SourcePickerProps {
  selectedSources: Source[]
  onSourcesChange: (sources: Source[]) => void
  onInsertCitation: (sourceIndex: number) => void
  maxSources?: number
}

export function SourcePicker({
  selectedSources,
  onSourcesChange,
  onInsertCitation,
  maxSources = 10,
}: SourcePickerProps) {
  const t = useTheme()
  const sourcesAPI = useSourcesAPI()
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [availableSources, setAvailableSources] = useState<Source[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newSourceName, setNewSourceName] = useState('')
  const [newSourceUrl, setNewSourceUrl] = useState('')



  const loadSources = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await sourcesAPI.list({
        search: searchQuery || undefined,
        limit: 20,
      })
      setAvailableSources(response.sources)
    } catch (error) {
      console.error('Failed to load sources:', error)
      Alert.alert('Error', 'Failed to load sources')
    } finally {
      setIsLoading(false)
    }
  }, [sourcesAPI, searchQuery])

    // Load sources when modal opens
  useEffect(() => {
    if (isModalVisible) {
      loadSources()
    }
  }, [isModalVisible, searchQuery, loadSources])

  const handleSourceSelect = useCallback(async (source: Source) => {
    if (selectedSources.length >= maxSources) {
      Alert.alert('Maximum Sources', `You can only add up to ${maxSources} sources.`)
      return
    }
    
    if (!selectedSources.find(s => s.id === source.id)) {
      onSourcesChange([...selectedSources, source])
    }
    setIsModalVisible(false)
  }, [selectedSources, onSourcesChange, maxSources])

  const handleSourceRemove = useCallback((sourceId: string) => {
    onSourcesChange(selectedSources.filter(s => s.id !== sourceId))
  }, [selectedSources, onSourcesChange])

  const handleAddNewSource = useCallback(async () => {
    if (!newSourceName.trim()) {
      Alert.alert('Error', 'Source name is required.')
      return
    }

    if (!newSourceUrl.trim()) {
      Alert.alert('Error', 'Source URL is required.')
      return
    }

    try {
      const response = await sourcesAPI.create({
        name: newSourceName.trim(),
        url: newSourceUrl.trim(),
      })

      handleSourceSelect(response.source)
      setNewSourceName('')
      setNewSourceUrl('')
      setIsAddingNew(false)
    } catch (error) {
      console.error('Failed to create source:', error)
      Alert.alert('Error', 'Failed to create source')
    }
  }, [newSourceName, newSourceUrl, sourcesAPI, handleSourceSelect])

  const handleInsertCitation = useCallback((source: Source) => {
    const sourceIndex = selectedSources.findIndex(s => s.id === source.id)
    if (sourceIndex !== -1) {
      onInsertCitation(sourceIndex + 1) // 1-based indexing for citations
    }
  }, [selectedSources, onInsertCitation])

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

  const renderSourceItem = ({item}: {item: Source}) => (
    <TouchableOpacity
      accessibilityHint="Tap to select this source"
      style={[
        a.p_md,
        a.border_b,
        {borderBottomColor: t.atoms.border_contrast_low.borderColor},
      ]}
      onPress={() => handleSourceSelect(item)}>
      <Text style={[a.text_md, a.font_bold, {color: t.atoms.text.color}]}>
        {item.name}
      </Text>
      {item.url && (
        <Text style={[a.text_sm, {color: t.atoms.text_contrast_medium.color}]} numberOfLines={1}>
          {item.url}
        </Text>
      )}
      <View style={[a.flex_row, a.align_center, a.gap_sm, a.mt_xs]}>
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
        <Text style={[a.text_xs, {color: t.atoms.text_contrast_medium.color}]}>
          ↑{item.upvotes} ↓{item.downvotes}
        </Text>
        {item.badgeType && (
          <Text style={[a.text_xs, {color: t.atoms.text_contrast_medium.color}]}>
            #{item.badgeType}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )

  const renderSelectedSource = ({item, index}: {item: Source; index: number}) => (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.justify_between,
        a.p_sm,
        a.mb_xs,
        a.rounded_md,
        {backgroundColor: t.atoms.bg_contrast_25.backgroundColor},
      ]}>
      <View style={[a.flex_1]}>
        <Text style={[a.text_sm, a.font_bold, {color: t.atoms.text.color}]}>
          [{index + 1}] {item.name}
        </Text>
        {item.url && (
          <Text style={[a.text_xs, {color: t.atoms.text_contrast_medium.color}]} numberOfLines={1}>
            {item.url}
          </Text>
        )}
      </View>
      <View style={[a.flex_row, a.gap_xs]}>
        <TouchableOpacity
          accessibilityHint="Insert citation for this source"
          style={[a.px_sm, a.py_xs, a.rounded_sm, {backgroundColor: '#3b82f6'}]}
          onPress={() => handleInsertCitation(item)}>
          <Text style={[a.text_xs, a.font_bold, {color: 'white'}]}>
            Insert [{index + 1}]
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityHint="Remove this source from selection"
          style={[a.px_sm, a.py_xs, a.rounded_sm, {backgroundColor: '#ef4444'}]}
          onPress={() => handleSourceRemove(item.id)}>
          <Text style={[a.text_xs, a.font_bold, {color: 'white'}]}>
            Remove
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View>
      {/* Selected Sources */}
      {selectedSources.length > 0 && (
        <View style={[a.mb_md]}>
          <Text style={[a.text_sm, a.font_bold, a.mb_sm, {color: t.atoms.text.color}]}>
            Selected Sources ({selectedSources.length}/{maxSources})
          </Text>
          <FlatList
            data={selectedSources}
            renderItem={renderSelectedSource}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Add Source Button */}
      <Button
        variant="outline"
        size="small"
        onPress={() => setIsModalVisible(true)}
        label="Add Source">
        <Text>+</Text>
        <ButtonText>Add Source</ButtonText>
      </Button>

      {/* Source Selection Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet">
        <View style={[a.flex_1, {backgroundColor: t.atoms.bg.backgroundColor}]}>
          {/* Header */}
          <View
            style={[
              a.flex_row,
              a.align_center,
              a.justify_between,
              a.p_lg,
              a.border_b,
              {borderBottomColor: t.atoms.border_contrast_low.borderColor},
            ]}>
            <Text style={[a.text_lg, a.font_bold, {color: t.atoms.text.color}]}>
              Select Source
            </Text>
            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
              <Text style={[a.text_md, {color: '#3b82f6'}]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[a.p_lg]}>
            <TextInput
              style={[
                a.p_md,
                a.rounded_md,
                a.border,
                {
                  borderColor: t.atoms.border_contrast_low.borderColor,
                  backgroundColor: t.atoms.bg_contrast_25.backgroundColor,
                  color: t.atoms.text.color,
                },
              ]}
              placeholder="Search sources..."
              placeholderTextColor={t.atoms.text_contrast_medium.color}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Add New Source Toggle */}
          <View style={[a.px_lg, a.pb_md]}>
            <Button
              variant={isAddingNew ? 'solid' : 'outline'}
              color="primary"
              size="large"
              onPress={() => setIsAddingNew(!isAddingNew)}
              label={isAddingNew ? 'Cancel' : 'Add New Source'}>
              <ButtonText>{isAddingNew ? 'Cancel' : 'Add New Source'}</ButtonText>
            </Button>
          </View>

          {/* Add New Source Form */}
          {isAddingNew && (
            <View style={[a.px_lg, a.pb_md]}>
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
                placeholder="Source name..."
                placeholderTextColor={t.atoms.text_contrast_medium.color}
                value={newSourceName}
                onChangeText={setNewSourceName}
              />
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
                placeholder="Source URL..."
                placeholderTextColor={t.atoms.text_contrast_medium.color}
                value={newSourceUrl}
                onChangeText={setNewSourceUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Button
                variant="solid"
                color="primary"
                size="large"
                onPress={handleAddNewSource}
                label="Create Source">
                <ButtonText>Create Source</ButtonText>
              </Button>
            </View>
          )}

          {/* Sources List */}
          <FlatList
            data={availableSources}
            renderItem={renderSourceItem}
            keyExtractor={item => item.id}
            style={[a.flex_1]}
            refreshing={isLoading}
            onRefresh={loadSources}
            ListEmptyComponent={
              <View style={[a.p_lg, a.align_center]}>
                <Text style={[a.text_md, {color: t.atoms.text_contrast_medium.color}]}>
                  {isLoading ? 'Loading sources...' : searchQuery ? 'No sources found' : 'No sources available'}
                </Text>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  )
}

// Re-export the Source type for compatibility
export type {Source} from '#/lib/api/sources' 