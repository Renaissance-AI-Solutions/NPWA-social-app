import {View} from 'react-native'
import {Trans} from '@lingui/macro'

import {
  type AllNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {useNotificationSettingsQuery} from '#/state/queries/notifications/settings'
import {atoms as a} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {At_Stroke2_Corner2_Rounded as AtIcon} from '#/components/icons/At'
import * as Layout from '#/components/Layout'
import * as SettingsList from '../components/SettingsList'
import {ItemTextWithSubtitle} from './components/ItemTextWithSubtitle'
import {PreferenceControls} from './components/PreferenceControls'

type Props = NativeStackScreenProps<
  AllNavigatorParams,
  'MentionNotificationSettings'
>
export function MentionNotificationSettingsScreen({}: Props) {
  const {data: preferences, isError} = useNotificationSettingsQuery()

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Notifications</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.Item style={[a.align_start]}>
            <SettingsList.ItemIcon icon={AtIcon} />
            <ItemTextWithSubtitle
              bold
              titleText={<Trans>Mentions</Trans>}
              subtitleText={
                <Trans>Get notifications when people mention you.</Trans>
              }
            />
          </SettingsList.Item>
          {isError ? (
            <View style={[a.px_lg, a.pt_md]}>
              <Admonition type="error">
                <Trans>Failed to load notification settings.</Trans>
              </Admonition>
            </View>
          ) : (
            <PreferenceControls
              name="mention"
              preference={preferences?.mention}
            />
          )}
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}
