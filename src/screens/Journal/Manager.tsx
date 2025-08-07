import React, {useState, useCallback, useMemo} from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useQuery} from '@tanstack/react-query'

import {useAgent, useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText, ButtonIcon} from '#/components/Button'
import {Text} from '#/components/Typography'
import {Trending3_Stroke2_Corner1_Rounded as Analytics} from '#/components/icons/Trending'
import {Calendar_Stroke2_Corner0_Rounded as Calendar} from '#/components/icons/Calendar'
import {Eye_Stroke2_Corner0_Rounded as Eye} from '#/components/icons/Eye'
import {Clock_Stroke2_Corner0_Rounded as Clock} from '#/components/icons/Clock'
import {Group3_Stroke2_Corner0_Rounded as Community} from '#/components/icons/Group'
import {JournalList} from './List'
import {useNavigation} from '@react-navigation/native'

type TabType = 'personal' | 'dashboard' | 'community' | 'contacts'

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
  visibility: 'private' | 'contacts' | 'community' | 'public'
  createdAt: string
  updatedAt?: string
}

interface Props {
  onCreateEntry: () => void
  onEntryPress?: (entryUri: string) => void
}

export function JournalManager({onCreateEntry, onEntryPress}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const navigation = useNavigation()
  const agent = useAgent()
  const {currentAccount} = useSession()
  const insets = useSafeAreaInsets()
  
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const screenWidth = Dimensions.get('window').width
  
  // Fetch journal entries for statistics
  const {
    data: journalEntries = [],
    isLoading: isLoadingStats,
  } = useQuery({
    queryKey: ['journal-entries', currentAccount?.did],
    queryFn: async () => {
      if (!currentAccount) return []
      
      try {
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
        return []
      }
    },
    enabled: !!currentAccount,
  })
  
  // Calculate statistics
  const statistics = useMemo(() => {
    const totalEntries = journalEntries.length
    const realTimeEntries = journalEntries.filter(e => e.entryType === 'real_time').length
    const backdatedEntries = journalEntries.filter(e => e.entryType === 'backdated').length
    const privateEntries = journalEntries.filter(e => e.visibility === 'private').length
    const communityEntries = journalEntries.filter(e => e.visibility === 'community').length
    const publicEntries = journalEntries.filter(e => e.visibility === 'public').length
    
    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentEntries = journalEntries.filter(e => 
      new Date(e.createdAt) > sevenDaysAgo
    ).length
    
    // Most common tags
    const tagCounts: {[key: string]: number} = {}
    journalEntries.forEach(entry => {
      entry.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    })
    const topTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
    
    return {
      totalEntries,
      realTimeEntries,
      backdatedEntries,
      privateEntries,
      communityEntries,
      publicEntries,
      recentEntries,
      topTags,
    }
  }, [journalEntries])

  const handleAnalytics = useCallback(() => {
    // @ts-ignore - navigation types don't include JournalAnalytics yet
    navigation.navigate('JournalAnalytics')
  }, [navigation])

  const renderTabButton = useCallback((tab: TabType, label: string, icon?: React.ReactNode) => {
    const isActive = activeTab === tab
    return (
      <Button
        key={tab}
        variant={isActive ? 'solid' : 'outline'}
        color="primary"
        size="small"
        onPress={() => setActiveTab(tab)}
        label={label}
        style={[styles.tabButton, {minWidth: screenWidth / 4 - 16}]}>
        {icon && <ButtonIcon icon={icon} />}
        <ButtonText style={[a.text_sm]}>{label}</ButtonText>
      </Button>
    )
  }, [activeTab, screenWidth])
  
  const renderStatCard = useCallback((title: string, value: string | number, icon: React.ReactNode, color: string) => {
    return (
      <View style={[styles.statCard, {backgroundColor: t.palette.white}]}>
        <View style={[styles.statIcon, {backgroundColor: color + '20'}]}>
          {React.cloneElement(icon as React.ReactElement, {
            size: 'sm',
            fill: color,
          })}
        </View>
        <Text style={[a.text_2xl, a.font_bold, {color: t.palette.contrast_800}]}>
          {value}
        </Text>
        <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
          {title}
        </Text>
      </View>
    )
  }, [t])
  
  const renderDashboard = useCallback(() => {
    return (
      <ScrollView 
        style={styles.dashboardContainer} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.dashboardContent}>
        
        {/* Quick Stats Grid */}
        <View style={styles.statsGrid}>
          {renderStatCard(
            _(msg`Total Entries`),
            statistics.totalEntries,
            <Analytics />,
            t.palette.primary_600
          )}
          {renderStatCard(
            _(msg`This Week`),
            statistics.recentEntries,
            <Calendar />,
            t.palette.secondary_600
          )}
          {renderStatCard(
            _(msg`Real-time`),
            statistics.realTimeEntries,
            <Clock />,
            t.palette.positive_600
          )}
          {renderStatCard(
            _(msg`Private`),
            statistics.privateEntries,
            <Eye />,
            t.palette.contrast_600
          )}
        </View>
        
        {/* Entry Types Chart */}
        <View style={[styles.chartSection, {backgroundColor: t.palette.white}]}>
          <Text style={[a.text_lg, a.font_bold, a.mb_md]}>
            <Trans>Entry Types</Trans>
          </Text>
          <View style={styles.chartRow}>
            <View style={styles.chartItem}>
              <View style={[styles.chartBar, {backgroundColor: t.palette.primary_500}]}>
                <View 
                  style={[
                    styles.chartFill, 
                    {backgroundColor: t.palette.primary_600},
                    {width: `${statistics.totalEntries > 0 ? (statistics.realTimeEntries / statistics.totalEntries) * 100 : 0}%`}
                  ]} 
                />
              </View>
              <Text style={[a.text_sm, {color: t.palette.contrast_700}]}>
                <Trans>Real-time ({statistics.realTimeEntries})</Trans>
              </Text>
            </View>
            <View style={styles.chartItem}>
              <View style={[styles.chartBar, {backgroundColor: t.palette.secondary_300}]}>
                <View 
                  style={[
                    styles.chartFill, 
                    {backgroundColor: t.palette.secondary_600},
                    {width: `${statistics.totalEntries > 0 ? (statistics.backdatedEntries / statistics.totalEntries) * 100 : 0}%`}
                  ]} 
                />
              </View>
              <Text style={[a.text_sm, {color: t.palette.contrast_700}]}>
                <Trans>Backdated ({statistics.backdatedEntries})</Trans>
              </Text>
            </View>
          </View>
        </View>
        
        {/* Top Tags */}
        {statistics.topTags.length > 0 && (
          <View style={[styles.tagsSection, {backgroundColor: t.palette.white}]}>
            <Text style={[a.text_lg, a.font_bold, a.mb_md]}>
              <Trans>Most Used Tags</Trans>
            </Text>
            <View style={styles.tagsGrid}>
              {statistics.topTags.map(([tag, count]) => (
                <View key={tag} style={[styles.tagCard, {backgroundColor: t.palette.primary_100}]}>
                  <Text style={[a.text_md, a.font_semi_bold, {color: t.palette.primary_700}]}>
                    #{tag}
                  </Text>
                  <Text style={[a.text_sm, {color: t.palette.primary_600}]}>
                    {count} {count === 1 ? _(msg`entry`) : _(msg`entries`)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {/* Privacy Distribution */}
        <View style={[styles.privacySection, {backgroundColor: t.palette.white}]}>
          <Text style={[a.text_lg, a.font_bold, a.mb_md]}>
            <Trans>Privacy Levels</Trans>
          </Text>
          <View style={styles.privacyStats}>
            <View style={styles.privacyItem}>
              <View style={[styles.privacyDot, {backgroundColor: t.palette.contrast_600}]} />
              <Text style={[a.text_sm, {color: t.palette.contrast_700}]}>
                <Trans>Private: {statistics.privateEntries}</Trans>
              </Text>
            </View>
            <View style={styles.privacyItem}>
              <View style={[styles.privacyDot, {backgroundColor: t.palette.secondary_600}]} />
              <Text style={[a.text_sm, {color: t.palette.contrast_700}]}>
                <Trans>Community: {statistics.communityEntries}</Trans>
              </Text>
            </View>
            <View style={styles.privacyItem}>
              <View style={[styles.privacyDot, {backgroundColor: t.palette.positive_600}]} />
              <Text style={[a.text_sm, {color: t.palette.contrast_700}]}>
                <Trans>Public: {statistics.publicEntries}</Trans>
              </Text>
            </View>
          </View>
        </View>
        
        {/* Quick Actions */}
        <View style={[styles.actionsSection, {backgroundColor: t.palette.white}]}>
          <Text style={[a.text_lg, a.font_bold, a.mb_md]}>
            <Trans>Quick Actions</Trans>
          </Text>
          <View style={styles.actionsGrid}>
            <Button
              variant="solid"
              color="primary"
              size="large"
              onPress={onCreateEntry}
              label={_(msg`New Entry`)}
              style={styles.actionButton}>
              <ButtonText><Trans>New Entry</Trans></ButtonText>
            </Button>
            <Button
              variant="outline"
              color="primary"
              size="large"
              onPress={handleAnalytics}
              label={_(msg`Analytics`)}
              style={styles.actionButton}>
              <ButtonIcon icon={Analytics} />
              <ButtonText><Trans>Analytics</Trans></ButtonText>
            </Button>
          </View>
        </View>
      </ScrollView>
    )
  }, [statistics, t, _, onCreateEntry, handleAnalytics, renderStatCard])

  const renderTabContent = useCallback(() => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard()
      case 'personal':
        return (
          <JournalList 
            onCreateEntry={onCreateEntry}
            onEntryPress={onEntryPress}
            hideHeader={true}
          />
        )
      case 'community':
        // TODO: Implement community feed
        return (
          <View style={styles.placeholderContainer}>
            <View style={[styles.placeholderIcon, {backgroundColor: t.palette.secondary_100}]}>
              <Community size="lg" fill={t.palette.secondary_600} />
            </View>
            <Text style={[a.text_lg, a.font_bold, a.text_center, a.mb_md]}>
              <Trans>Community Feed</Trans>
            </Text>
            <Text style={[a.text_md, a.text_center, {color: t.palette.contrast_600}, a.mb_lg]}>
              <Trans>View journal entries from your badge community. This feature will enable you to connect with others who share similar experiences.</Trans>
            </Text>
            <View style={[styles.featureList, {backgroundColor: t.palette.white}]}>
              <Text style={[a.text_sm, a.font_semi_bold, {color: t.palette.contrast_700}, a.mb_sm]}>
                <Trans>Coming Features:</Trans>
              </Text>
              <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
                • <Trans>Badge-verified community posts</Trans>
              </Text>
              <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
                • <Trans>Anonymous sharing options</Trans>
              </Text>
              <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
                • <Trans>Community support networks</Trans>
              </Text>
            </View>
            <Text style={[a.text_sm, a.text_center, {color: t.palette.contrast_500}, a.mt_md]}>
              <Trans>Coming soon in the next update</Trans>
            </Text>
          </View>
        )
      case 'contacts':
        // TODO: Implement contacts feed
        return (
          <View style={styles.placeholderContainer}>
            <View style={[styles.placeholderIcon, {backgroundColor: t.palette.primary_100}]}>
              <Community size="lg" fill={t.palette.primary_600} />
            </View>
            <Text style={[a.text_lg, a.font_bold, a.text_center, a.mb_md]}>
              <Trans>Contacts Feed</Trans>
            </Text>
            <Text style={[a.text_md, a.text_center, {color: t.palette.contrast_600}, a.mb_lg]}>
              <Trans>View journal entries shared by people you follow. A private space for trusted connections to support each other.</Trans>
            </Text>
            <View style={[styles.featureList, {backgroundColor: t.palette.white}]}>
              <Text style={[a.text_sm, a.font_semi_bold, {color: t.palette.contrast_700}, a.mb_sm]}>
                <Trans>Coming Features:</Trans>
              </Text>
              <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
                • <Trans>Trusted contact sharing</Trans>
              </Text>
              <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
                • <Trans>Private support groups</Trans>
              </Text>
              <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
                • <Trans>Encrypted messaging</Trans>
              </Text>
            </View>
            <Text style={[a.text_sm, a.text_center, {color: t.palette.contrast_500}, a.mt_md]}>
              <Trans>Coming soon in the next update</Trans>
            </Text>
          </View>
        )
      default:
        return null
    }
  }, [activeTab, onCreateEntry, onEntryPress, t.palette, renderDashboard])

  return (
    <View style={[styles.container, {backgroundColor: t.palette.contrast_25}]}>
      {/* Header with Tabs */}
      <View style={[styles.header, {backgroundColor: t.palette.white}]}>
        <View style={styles.headerRow}>
          <Text style={[a.text_xl, a.font_bold]}>
            <Trans>Journal</Trans>
          </Text>
          <View style={styles.headerActions}>
            <Button
              variant="outline"
              color="primary"
              size="small"
              onPress={handleAnalytics}
              label={_(msg`Analytics`)}>
              <ButtonIcon icon={Analytics} />
            </Button>
            <Button
              variant="solid"
              color="primary"
              size="small"
              onPress={onCreateEntry}
              label={_(msg`New Entry`)}>
              <ButtonText>
                <Trans>New Entry</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>

        {/* Tab Navigation */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabScrollContainer}
          contentContainerStyle={styles.tabContainer}>
          {renderTabButton('dashboard', _(msg`Dashboard`), <Analytics />)}
          {renderTabButton('personal', _(msg`Personal`), <Eye />)}
          {renderTabButton('community', _(msg`Community`), <Community />)}
          {renderTabButton('contacts', _(msg`Contacts`), <Community />)}
        </ScrollView>
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  tabScrollContainer: {
    maxHeight: 60,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tabButton: {
    paddingHorizontal: 16,
  },
  content: {
    flex: 1,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  placeholderIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  featureList: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
    alignSelf: 'stretch',
  },
  dashboardContainer: {
    flex: 1,
  },
  dashboardContent: {
    padding: 16,
    paddingBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  chartSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chartRow: {
    gap: 12,
  },
  chartItem: {
    marginBottom: 12,
  },
  chartBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
    overflow: 'hidden',
  },
  chartFill: {
    height: '100%',
    borderRadius: 4,
  },
  tagsSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  privacySection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  privacyStats: {
    gap: 8,
  },
  privacyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privacyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  actionsSection: {
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
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
})