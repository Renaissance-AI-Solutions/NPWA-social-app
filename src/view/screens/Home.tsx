import React from 'react'
import {ActivityIndicator, StyleSheet} from 'react-native'
import {useFocusEffect} from '@react-navigation/native'

import {PROD_DEFAULT_FEED} from '#/lib/constants'
import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'
import {useOTAUpdates} from '#/lib/hooks/useOTAUpdates'
import {useSetTitle} from '#/lib/hooks/useSetTitle'
import {useRequestNotificationsPermission} from '#/lib/notifications/notifications'
import {
  type HomeTabNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {logEvent} from '#/lib/statsig/statsig'
import {isWeb} from '#/platform/detection'
import {emitSoftReset} from '#/state/events'
import {
  type SavedFeedSourceInfo,
  usePinnedFeedsInfos,
} from '#/state/queries/feed'
import {type FeedDescriptor, type FeedParams} from '#/state/queries/post-feed'
import {usePreferencesQuery} from '#/state/queries/preferences'
import {type UsePreferencesQueryResponse} from '#/state/queries/preferences/types'
import {useSession} from '#/state/session'
import {useSetMinimalShellMode} from '#/state/shell'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {useSelectedFeed, useSetSelectedFeed} from '#/state/shell/selected-feed'
import {FeedPage} from '#/view/com/feeds/FeedPage'
import {HomeHeader} from '#/view/com/home/HomeHeader'
import {
  Pager,
  type PagerRef,
  type RenderTabBarFnProps,
} from '#/view/com/pager/Pager'
import {CustomFeedEmptyState} from '#/view/com/posts/CustomFeedEmptyState'
import {FollowingEmptyState} from '#/view/com/posts/FollowingEmptyState'
import {FollowingEndOfFeed} from '#/view/com/posts/FollowingEndOfFeed'
import {NoFeedsPinned} from '#/screens/Home/NoFeedsPinned'
import * as Layout from '#/components/Layout'
import {useDemoMode} from '#/storage/hooks/demo-mode'

type Props = NativeStackScreenProps<HomeTabNavigatorParams, 'Home' | 'Start'>
export function HomeScreen(props: Props) {
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const {data: preferences} = usePreferencesQuery()
  const {currentAccount} = useSession()
  const {data: pinnedFeedInfos, isLoading: isPinnedFeedsLoading} =
    usePinnedFeedsInfos()

  React.useEffect(() => {
    if (isWeb && !currentAccount) {
      const getParams = new URLSearchParams(window.location.search)
      const splash = getParams.get('splash')
      if (splash === 'true') {
        setShowLoggedOut(true)
        return
      }
    }

    const params = props.route.params
    if (
      currentAccount &&
      props.route.name === 'Start' &&
      params?.name &&
      params?.rkey
    ) {
      props.navigation.navigate('StarterPack', {
        rkey: params.rkey,
        name: params.name,
      })
    }
  }, [
    currentAccount,
    props.navigation,
    props.route.name,
    props.route.params,
    setShowLoggedOut,
  ])

  if (preferences && pinnedFeedInfos && !isPinnedFeedsLoading) {
    return (
      <Layout.Screen testID="HomeScreen">
        <HomeScreenReady
          {...props}
          preferences={preferences}
          pinnedFeedInfos={pinnedFeedInfos}
        />
      </Layout.Screen>
    )
  } else {
    return (
      <Layout.Screen>
        <Layout.Center style={styles.loading}>
          <ActivityIndicator size="large" />
        </Layout.Center>
      </Layout.Screen>
    )
  }
}

function HomeScreenReady({
  preferences,
  pinnedFeedInfos,
}: Props & {
  preferences: UsePreferencesQueryResponse
  pinnedFeedInfos: SavedFeedSourceInfo[]
}) {
  const allFeeds = React.useMemo(
    () => pinnedFeedInfos.map(f => f.feedDescriptor),
    [pinnedFeedInfos],
  )
  const maybeRawSelectedFeed: FeedDescriptor | undefined =
    useSelectedFeed() ?? allFeeds[0]
  const setSelectedFeed = useSetSelectedFeed()
  const maybeFoundIndex = allFeeds.indexOf(maybeRawSelectedFeed)
  const selectedIndex = Math.max(0, maybeFoundIndex)
  const maybeSelectedFeed: FeedDescriptor | undefined = allFeeds[selectedIndex]
  const requestNotificationsPermission = useRequestNotificationsPermission()

  useSetTitle(pinnedFeedInfos[selectedIndex]?.displayName)
  useOTAUpdates()

  React.useEffect(() => {
    requestNotificationsPermission('Home')
  }, [requestNotificationsPermission])

  const pagerRef = React.useRef<PagerRef>(null)
  const lastPagerReportedIndexRef = React.useRef(selectedIndex)
  React.useLayoutEffect(() => {
    // Since the pager is not a controlled component, adjust it imperatively
    // if the selected index gets out of sync with what it last reported.
    // This is supposed to only happen on the web when you use the right nav.
    if (selectedIndex !== lastPagerReportedIndexRef.current) {
      lastPagerReportedIndexRef.current = selectedIndex
      pagerRef.current?.setPage(selectedIndex)
    }
  }, [selectedIndex])

  const {hasSession} = useSession()
  const setMinimalShellMode = useSetMinimalShellMode()
  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(false)
    }, [setMinimalShellMode]),
  )

  useFocusEffect(
    useNonReactiveCallback(() => {
      if (maybeSelectedFeed) {
        logEvent('home:feedDisplayed', {
          index: selectedIndex,
          feedType: maybeSelectedFeed.split('|')[0],
          feedUrl: maybeSelectedFeed,
          reason: 'focus',
        })
      }
    }),
  )

  const onPageSelected = React.useCallback(
    (index: number) => {
      setMinimalShellMode(false)
      const maybeFeed = allFeeds[index]

      // Mutate the ref before setting state to avoid the imperative syncing effect
      // above from starting a loop on Android when swiping back and forth.
      lastPagerReportedIndexRef.current = index
      setSelectedFeed(maybeFeed)

      if (maybeFeed) {
        logEvent('home:feedDisplayed', {
          index,
          feedType: maybeFeed.split('|')[0],
          feedUrl: maybeFeed,
        })
      }
    },
    [setSelectedFeed, setMinimalShellMode, allFeeds],
  )

  const onPressSelected = React.useCallback(() => {
    emitSoftReset()
  }, [])

  const onPageScrollStateChanged = React.useCallback(
    (state: 'idle' | 'dragging' | 'settling') => {
      'worklet'
      if (state === 'dragging') {
        setMinimalShellMode(false)
      }
    },
    [setMinimalShellMode],
  )

  const [demoMode] = useDemoMode()

  const renderTabBar = React.useCallback(
    (props: RenderTabBarFnProps) => {
      if (demoMode) {
        return (
          <HomeHeader
            key="FEEDS_TAB_BAR"
            {...props}
            testID="homeScreenFeedTabs"
            onPressSelected={onPressSelected}
            // @ts-ignore
            feeds={[{displayName: 'Following'}, {displayName: 'Discover'}]}
          />
        )
      }
      return (
        <HomeHeader
          key="FEEDS_TAB_BAR"
          {...props}
          testID="homeScreenFeedTabs"
          onPressSelected={onPressSelected}
          feeds={pinnedFeedInfos}
        />
      )
    },
    [onPressSelected, pinnedFeedInfos, demoMode],
  )

  const renderFollowingEmptyState = React.useCallback(() => {
    return <FollowingEmptyState />
  }, [])

  const renderCustomFeedEmptyState = React.useCallback(() => {
    return <CustomFeedEmptyState />
  }, [])

  const homeFeedParams = React.useMemo<FeedParams>(() => {
    return {
      mergeFeedEnabled: Boolean(preferences.feedViewPrefs.lab_mergeFeedEnabled),
      mergeFeedSources: preferences.feedViewPrefs.lab_mergeFeedEnabled
        ? preferences.savedFeeds
            .filter(f => f.type === 'feed' || f.type === 'list')
            .map(f => f.value)
        : [],
    }
  }, [preferences])

  if (demoMode) {
    return (
      <Pager
        ref={pagerRef}
        testID="homeScreen"
        onPageSelected={onPageSelected}
        onPageScrollStateChanged={onPageScrollStateChanged}
        renderTabBar={renderTabBar}
        initialPage={selectedIndex}>
        <FeedPage
          testID="demoFeedPage"
          isPageFocused
          isPageAdjacent={false}
          feed="demo"
          renderEmptyState={renderCustomFeedEmptyState}
          feedInfo={pinnedFeedInfos[0]}
        />
        <FeedPage
          testID="customFeedPage"
          isPageFocused
          isPageAdjacent={false}
          feed={`feedgen|${PROD_DEFAULT_FEED('whats-hot')}`}
          renderEmptyState={renderCustomFeedEmptyState}
          feedInfo={pinnedFeedInfos[0]}
        />
      </Pager>
    )
  }

  return hasSession ? (
    <Pager
      key={allFeeds.join(',')}
      ref={pagerRef}
      testID="homeScreen"
      initialPage={selectedIndex}
      onPageSelected={onPageSelected}
      onPageScrollStateChanged={onPageScrollStateChanged}
      renderTabBar={renderTabBar}>
      {pinnedFeedInfos.length ? (
        pinnedFeedInfos.map((feedInfo, index) => {
          const feed = feedInfo.feedDescriptor
          if (feed === 'following') {
            return (
              <FeedPage
                key={feed}
                testID="followingFeedPage"
                isPageFocused={maybeSelectedFeed === feed}
                isPageAdjacent={Math.abs(selectedIndex - index) === 1}
                feed={feed}
                feedParams={homeFeedParams}
                renderEmptyState={renderFollowingEmptyState}
                renderEndOfFeed={FollowingEndOfFeed}
                feedInfo={feedInfo}
              />
            )
          }
          const savedFeedConfig = feedInfo.savedFeed
          return (
            <FeedPage
              key={feed}
              testID="customFeedPage"
              isPageFocused={maybeSelectedFeed === feed}
              isPageAdjacent={Math.abs(selectedIndex - index) === 1}
              feed={feed}
              renderEmptyState={renderCustomFeedEmptyState}
              savedFeedConfig={savedFeedConfig}
              feedInfo={feedInfo}
            />
          )
        })
      ) : (
        <NoFeedsPinned preferences={preferences} />
      )}
    </Pager>
  ) : (
    <Pager
      testID="homeScreen"
      onPageSelected={onPageSelected}
      onPageScrollStateChanged={onPageScrollStateChanged}
      renderTabBar={renderTabBar}>
      <FeedPage
        testID="customFeedPage"
        isPageFocused
        isPageAdjacent={false}
        feed={`feedgen|${PROD_DEFAULT_FEED('whats-hot')}`}
        renderEmptyState={renderCustomFeedEmptyState}
        feedInfo={pinnedFeedInfos[0]}
      />
    </Pager>
  )
}

const styles = StyleSheet.create({
  loading: {
    height: '100%',
    alignContent: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
})
