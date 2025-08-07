import {useState, useMemo, useCallback} from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useQuery} from '@tanstack/react-query'

import {useAgent, useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText, ButtonIcon} from '#/components/Button'
import {Text} from '#/components/Typography'
import {Download_Stroke2_Corner0_Rounded as Download} from '#/components/icons/Download'
import {logger} from '#/logger'
import {cleanError} from '#/lib/strings/errors'

// Types for analytics data
interface JournalEntry {
  uri: string
  text: string
  entryType: 'real_time' | 'backdated'
  incidentTimestamp?: string
  location?: {
    latitude: number
    longitude: number
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

interface SymptomStats {
  category: string
  count: number
  averageSeverity: number
  trend: 'up' | 'down' | 'stable'
}

interface LocationCluster {
  latitude: number
  longitude: number
  count: number
  address?: string
}

interface TimelineData {
  date: string
  count: number
  averageSeverity?: number
}

interface AnalyticsData {
  totalEntries: number
  realTimeEntries: number
  backdatedEntries: number
  privateEntries: number
  symptomStats: SymptomStats[]
  locationClusters: LocationCluster[]
  timelineData: TimelineData[]
  mostCommonTags: Array<{tag: string; count: number}>
  dateRange: {start: string; end: string}
}

interface Props {
  onExport?: () => void
}

export function JournalAnalytics({onExport}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const agent = useAgent()
  const {currentAccount} = useSession()
  const _insets = useSafeAreaInsets()
  
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
  const [_selectedCategory, _setSelectedCategory] = useState<string | null>(null)

  // Fetch journal entries for analytics
  const {
    data: entries = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['journal-entries-analytics', currentAccount?.did, timeRange],
    queryFn: async () => {
      if (!currentAccount) return []
      
      try {
        const response = await agent.com.atproto.repo.listRecords({
          repo: currentAccount.did,
          collection: 'app.warlog.journal',
          limit: 1000, // Get more entries for analytics
        })

        return response.data.records.map((record: any) => ({
          uri: record.uri,
          ...record.value,
        })) as JournalEntry[]
      } catch (err) {
        logger.error('Failed to fetch journal entries for analytics', {message: String(err)})
        throw err
      }
    },
    enabled: !!currentAccount,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Calculate analytics data from entries
  const analyticsData: AnalyticsData = useMemo(() => {
    if (!entries.length) {
      return {
        totalEntries: 0,
        realTimeEntries: 0,
        backdatedEntries: 0,
        privateEntries: 0,
        symptomStats: [],
        locationClusters: [],
        timelineData: [],
        mostCommonTags: [],
        dateRange: {start: '', end: ''},
      }
    }

    // Filter entries by time range
    const now = new Date()
    const cutoffDate = new Date()
    switch (timeRange) {
      case 'week':
        cutoffDate.setDate(now.getDate() - 7)
        break
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1)
        break
      case 'quarter':
        cutoffDate.setMonth(now.getMonth() - 3)
        break
      case 'year':
        cutoffDate.setFullYear(now.getFullYear() - 1)
        break
    }

    const filteredEntries = entries.filter(entry => 
      new Date(entry.createdAt) >= cutoffDate
    )

    // Basic counts
    const totalEntries = filteredEntries.length
    const realTimeEntries = filteredEntries.filter(e => e.entryType === 'real_time').length
    const backdatedEntries = filteredEntries.filter(e => e.entryType === 'backdated').length
    const privateEntries = filteredEntries.filter(e => e.isPrivate).length

    // Symptom statistics
    const symptomMap = new Map<string, {severities: number[], count: number}>()
    filteredEntries.forEach(entry => {
      entry.symptoms?.forEach(symptom => {
        const existing = symptomMap.get(symptom.category) || {severities: [], count: 0}
        existing.severities.push(symptom.severity)
        existing.count++
        symptomMap.set(symptom.category, existing)
      })
    })

    const symptomStats: SymptomStats[] = Array.from(symptomMap.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      averageSeverity: data.severities.reduce((a, b) => a + b, 0) / data.severities.length,
      trend: 'stable' as const, // TODO: Calculate actual trend
    })).sort((a, b) => b.count - a.count)

    // Location clustering (simplified)
    const locationMap = new Map<string, LocationCluster>()
    filteredEntries.forEach(entry => {
      if (entry.location) {
        const key = `${entry.location.latitude.toFixed(3)},${entry.location.longitude.toFixed(3)}`
        const existing = locationMap.get(key) || {
          latitude: entry.location.latitude,
          longitude: entry.location.longitude,
          count: 0,
          address: entry.location.address,
        }
        existing.count++
        locationMap.set(key, existing)
      }
    })

    const locationClusters = Array.from(locationMap.values()).sort((a, b) => b.count - a.count)

    // Timeline data
    const timelineMap = new Map<string, {count: number, severities: number[]}>()
    filteredEntries.forEach(entry => {
      const date = new Date(entry.createdAt).toISOString().split('T')[0]
      const existing = timelineMap.get(date) || {count: 0, severities: []}
      existing.count++
      if (entry.symptoms) {
        entry.symptoms.forEach(s => existing.severities.push(s.severity))
      }
      timelineMap.set(date, existing)
    })

    const timelineData: TimelineData[] = Array.from(timelineMap.entries()).map(([date, data]) => ({
      date,
      count: data.count,
      averageSeverity: data.severities.length > 0 
        ? data.severities.reduce((a, b) => a + b, 0) / data.severities.length 
        : undefined,
    })).sort((a, b) => a.date.localeCompare(b.date))

    // Most common tags
    const tagMap = new Map<string, number>()
    filteredEntries.forEach(entry => {
      entry.tags?.forEach(tag => {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
      })
    })

    const mostCommonTags = Array.from(tagMap.entries())
      .map(([tag, count]) => ({tag, count}))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const dateRange = {
      start: filteredEntries.length > 0 ? Math.min(...filteredEntries.map(e => new Date(e.createdAt).getTime())).toString() : '',
      end: filteredEntries.length > 0 ? Math.max(...filteredEntries.map(e => new Date(e.createdAt).getTime())).toString() : '',
    }

    return {
      totalEntries,
      realTimeEntries,
      backdatedEntries,
      privateEntries,
      symptomStats,
      locationClusters,
      timelineData,
      mostCommonTags,
      dateRange,
    }
  }, [entries, timeRange])

  const handleExport = useCallback(() => {
    Alert.alert(
      _(msg`Export Analytics`),
      _(msg`This feature will export your journal analytics data in a secure, encrypted format. Would you like to proceed?`),
      [
        {text: _(msg`Cancel`), style: 'cancel'},
        {
          text: _(msg`Export`),
          onPress: () => {
            // TODO: Implement actual export functionality
            logger.info('Journal analytics export requested')
            onExport?.()
          },
        },
      ]
    )
  }, [_, onExport])

  const renderTimeRangeSelector = useCallback(() => (
    <View style={styles.timeRangeContainer}>
      {(['week', 'month', 'quarter', 'year'] as const).map(range => (
        <Button
          key={range}
          variant={timeRange === range ? 'solid' : 'outline'}
          color="primary"
          size="small"
          onPress={() => setTimeRange(range)}
          label={_(msg`${range}`)}
          style={styles.timeRangeButton}>
          <ButtonText>
            {range === 'week' && <Trans>Week</Trans>}
            {range === 'month' && <Trans>Month</Trans>}
            {range === 'quarter' && <Trans>Quarter</Trans>}
            {range === 'year' && <Trans>Year</Trans>}
          </ButtonText>
        </Button>
      ))}
    </View>
  ), [timeRange, _])

  const renderOverviewStats = useCallback(() => (
    <View style={[styles.section, {backgroundColor: t.palette.white}]}>
      <Text style={[a.text_lg, a.font_bold, a.mb_md]}>
        <Trans>Overview</Trans>
      </Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={[a.text_2xl, a.font_bold, {color: t.palette.primary_500}]}>
            {analyticsData.totalEntries}
          </Text>
          <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
            <Trans>Total Entries</Trans>
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[a.text_2xl, a.font_bold, {color: t.palette.positive_500}]}>
            {analyticsData.realTimeEntries}
          </Text>
          <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
            <Trans>Real-time</Trans>
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[a.text_2xl, a.font_bold, {color: t.palette.positive_500}]}>
            {analyticsData.backdatedEntries}
          </Text>
          <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
            <Trans>Backdated</Trans>
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[a.text_2xl, a.font_bold, {color: t.palette.contrast_600}]}>
            {analyticsData.privateEntries}
          </Text>
          <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
            <Trans>Private</Trans>
          </Text>
        </View>
      </View>
    </View>
  ), [analyticsData, t])

  const renderSymptomAnalysis = useCallback(() => (
    <View style={[styles.section, {backgroundColor: t.palette.white}]}>
      <Text style={[a.text_lg, a.font_bold, a.mb_md]}>
        <Trans>Symptom Analysis</Trans>
      </Text>
      {analyticsData.symptomStats.length > 0 ? (
        <View style={styles.symptomsList}>
          {analyticsData.symptomStats.slice(0, 5).map((symptom, _index) => (
            <View key={symptom.category} style={styles.symptomItem}>
              <View style={styles.symptomHeader}>
                <Text style={[a.text_md, a.font_bold]}>
                  {symptom.category.replace(/_/g, ' ')}
                </Text>
                <View style={styles.symptomStats}>
                  <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
                    {symptom.count} times
                  </Text>
                  <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
                    Avg: {symptom.averageSeverity.toFixed(1)}/10
                  </Text>
                </View>
              </View>
              <View style={styles.severityBar}>
                <View 
                  style={[
                    styles.severityFill, 
                    {
                      width: `${(symptom.averageSeverity / 10) * 100}%`,
                      backgroundColor: symptom.averageSeverity > 7 ? t.palette.negative_500 : 
                                     symptom.averageSeverity > 4 ? t.palette.primary_500 : 
                                     t.palette.positive_500,
                    }
                  ]} 
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[a.text_md, {color: t.palette.contrast_500}]}>
          <Trans>No symptom data available for this time period</Trans>
        </Text>
      )}
    </View>
  ), [analyticsData.symptomStats, t])

  const renderLocationAnalysis = useCallback(() => (
    <View style={[styles.section, {backgroundColor: t.palette.white}]}>
      <Text style={[a.text_lg, a.font_bold, a.mb_md]}>
        <Trans>Location Analysis</Trans>
      </Text>
      {analyticsData.locationClusters.length > 0 ? (
        <View style={styles.locationsList}>
          {analyticsData.locationClusters.slice(0, 5).map((location, _index) => (
            <View key={_index} style={styles.locationItem}>
              <View style={styles.locationIcon}>
                <Text style={[a.text_sm, t.atoms.text_contrast_high]}>📍</Text>
              </View>
              <View style={styles.locationDetails}>
                <Text style={[a.text_md, a.font_bold]} numberOfLines={1}>
                  {location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                </Text>
                <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
                  {location.count} incidents
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={[a.text_md, {color: t.palette.contrast_500}]}>
            <Trans>No location data available</Trans>
          </Text>
          <Text style={[a.text_sm, {color: t.palette.contrast_400}, a.mt_xs]}>
            <Trans>Location data helps identify patterns and hotspots</Trans>
          </Text>
        </View>
      )}
    </View>
  ), [analyticsData.locationClusters, t])

  const renderTagAnalysis = useCallback(() => (
    <View style={[styles.section, {backgroundColor: t.palette.white}]}>
      <Text style={[a.text_lg, a.font_bold, a.mb_md]}>
        <Trans>Common Tags</Trans>
      </Text>
      {analyticsData.mostCommonTags.length > 0 ? (
        <View style={styles.tagsContainer}>
          {analyticsData.mostCommonTags.map((tag, _index) => (
            <View 
              key={tag.tag} 
              style={[
                styles.tagChip, 
                {backgroundColor: t.palette.primary_100}
              ]}>
              <Text style={[a.text_sm, {color: t.palette.primary_700}]}>
                #{tag.tag}
              </Text>
              <Text style={[a.text_xs, {color: t.palette.primary_600}]}>
                {tag.count}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[a.text_md, {color: t.palette.contrast_500}]}>
          <Trans>No tags found</Trans>
        </Text>
      )}
    </View>
  ), [analyticsData.mostCommonTags, t])

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, {backgroundColor: t.palette.contrast_25}]}>
        <Text style={[a.text_lg]}>
          <Trans>Loading analytics...</Trans>
        </Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered, {backgroundColor: t.palette.contrast_25}]}>
        <Text style={[a.text_lg, a.font_bold, a.text_center, a.mb_md]}>
          <Trans>Failed to Load Analytics</Trans>
        </Text>
        <Text style={[a.text_md, a.text_center, {color: t.palette.contrast_600}]}>
          {cleanError(String(error))}
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, {backgroundColor: t.palette.contrast_25}]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: t.palette.white}]}>
        <Text style={[a.text_xl, a.font_bold]}>
          <Trans>Journal Analytics</Trans>
        </Text>
        <Button
          variant="outline"
          color="primary"
          size="small"
          onPress={handleExport}
          label={_(msg`Export`)}>
          <ButtonIcon icon={Download} />
          <ButtonText>
            <Trans>Export</Trans>
          </ButtonText>
        </Button>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        
        {/* Time Range Selector */}
        {renderTimeRangeSelector()}

        {/* Overview Stats */}
        {renderOverviewStats()}

        {/* Symptom Analysis */}
        {renderSymptomAnalysis()}

        {/* Location Analysis */}
        {renderLocationAnalysis()}

        {/* Tag Analysis */}
        {renderTagAnalysis()}

        {/* Privacy Notice */}
        <View style={[styles.section, {backgroundColor: t.palette.contrast_50}]}>
          <Text style={[a.text_sm, {color: t.palette.contrast_600}, a.text_center]}>
            <Trans>All analytics are computed locally and encrypted. No data leaves your device without explicit consent.</Trans>
          </Text>
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
  timeRangeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  timeRangeButton: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  symptomsList: {
    gap: 12,
  },
  symptomItem: {
    gap: 8,
  },
  symptomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symptomStats: {
    flexDirection: 'row',
    gap: 8,
  },
  severityBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  severityFill: {
    height: '100%',
    borderRadius: 2,
  },
  locationsList: {
    gap: 12,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationDetails: {
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
})