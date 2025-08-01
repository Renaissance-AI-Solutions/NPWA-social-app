import React, {useCallback} from 'react'
import {Keyboard, Pressable, View} from 'react-native'
import {ChatBskyConvoDefs, ModerationCause} from '@atproto/api'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'

import {NavigationProp} from '#/lib/routes/types'
import {Shadow} from '#/state/cache/types'
import {
  useConvoQuery,
  useMarkAsReadMutation,
} from '#/state/queries/messages/conversation'
import {useMuteConvo} from '#/state/queries/messages/mute-conversation'
import {useProfileBlockMutationQueue} from '#/state/queries/profile'
import * as Toast from '#/view/com/util/Toast'
import {atoms as a, useTheme, ViewStyleProp} from '#/alf'
import {BlockedByListDialog} from '#/components/dms/BlockedByListDialog'
import {LeaveConvoPrompt} from '#/components/dms/LeaveConvoPrompt'
import {ReportConversationPrompt} from '#/components/dms/ReportConversationPrompt'
import {ArrowBoxLeft_Stroke2_Corner0_Rounded as ArrowBoxLeft} from '#/components/icons/ArrowBoxLeft'
import {DotGrid_Stroke2_Corner0_Rounded as DotsHorizontal} from '#/components/icons/DotGrid'
import {Flag_Stroke2_Corner0_Rounded as Flag} from '#/components/icons/Flag'
import {Mute_Stroke2_Corner0_Rounded as Mute} from '#/components/icons/Mute'
import {
  Person_Stroke2_Corner0_Rounded as Person,
  PersonCheck_Stroke2_Corner0_Rounded as PersonCheck,
  PersonX_Stroke2_Corner0_Rounded as PersonX,
} from '#/components/icons/Person'
import {SpeakerVolumeFull_Stroke2_Corner0_Rounded as Unmute} from '#/components/icons/Speaker'
import * as Menu from '#/components/Menu'
import * as Prompt from '#/components/Prompt'
import * as bsky from '#/types/bsky'
import {Bubble_Stroke2_Corner2_Rounded as Bubble} from '../icons/Bubble'
import {ReportDialog} from './ReportDialog'

let ConvoMenu = ({
  convo,
  profile,
  control,
  currentScreen,
  showMarkAsRead,
  hideTrigger,
  blockInfo,
  latestReportableMessage,
  style,
}: {
  convo: ChatBskyConvoDefs.ConvoView
  profile: Shadow<bsky.profile.AnyProfileView>
  control?: Menu.MenuControlProps
  currentScreen: 'list' | 'conversation'
  showMarkAsRead?: boolean
  hideTrigger?: boolean
  blockInfo: {
    listBlocks: ModerationCause[]
    userBlock?: ModerationCause
  }
  latestReportableMessage?: ChatBskyConvoDefs.MessageView
  style?: ViewStyleProp['style']
}): React.ReactNode => {
  const {_} = useLingui()
  const t = useTheme()

  const leaveConvoControl = Prompt.usePromptControl()
  const reportControl = Prompt.usePromptControl()
  const blockedByListControl = Prompt.usePromptControl()

  const {listBlocks} = blockInfo

  return (
    <>
      <Menu.Root control={control}>
        {!hideTrigger && (
          <View style={[style]}>
            <Menu.Trigger label={_(msg`Chat settings`)}>
              {({props, state}) => (
                <Pressable
                  {...props}
                  onPress={() => {
                    Keyboard.dismiss()
                    props.onPress()
                  }}
                  style={[
                    a.p_sm,
                    a.rounded_full,
                    (state.hovered || state.pressed) && t.atoms.bg_contrast_25,
                    // make sure pfp is in the middle
                    {marginLeft: -10},
                  ]}>
                  <DotsHorizontal size="md" style={t.atoms.text} />
                </Pressable>
              )}
            </Menu.Trigger>
          </View>
        )}

        <Menu.Outer>
          <MenuContent
            profile={profile}
            showMarkAsRead={showMarkAsRead}
            blockInfo={blockInfo}
            convo={convo}
            leaveConvoControl={leaveConvoControl}
            reportControl={reportControl}
            blockedByListControl={blockedByListControl}
          />
        </Menu.Outer>
      </Menu.Root>

      <LeaveConvoPrompt
        control={leaveConvoControl}
        convoId={convo.id}
        currentScreen={currentScreen}
      />
      {latestReportableMessage ? (
        <ReportDialog
          currentScreen={currentScreen}
          params={{
            type: 'convoMessage',
            convoId: convo.id,
            message: latestReportableMessage,
          }}
          control={reportControl}
        />
      ) : (
        <ReportConversationPrompt control={reportControl} />
      )}

      <BlockedByListDialog
        control={blockedByListControl}
        listBlocks={listBlocks}
      />
    </>
  )
}
ConvoMenu = React.memo(ConvoMenu)

function MenuContent({
  convo: initialConvo,
  profile,
  showMarkAsRead,
  blockInfo,
  leaveConvoControl,
  reportControl,
  blockedByListControl,
}: {
  convo: ChatBskyConvoDefs.ConvoView
  profile: Shadow<bsky.profile.AnyProfileView>
  showMarkAsRead?: boolean
  blockInfo: {
    listBlocks: ModerationCause[]
    userBlock?: ModerationCause
  }
  leaveConvoControl: Prompt.PromptControlProps
  reportControl: Prompt.PromptControlProps
  blockedByListControl: Prompt.PromptControlProps
}) {
  const navigation = useNavigation<NavigationProp>()
  const {_} = useLingui()
  const {mutate: markAsRead} = useMarkAsReadMutation()

  const {listBlocks, userBlock} = blockInfo
  const isBlocking = userBlock || !!listBlocks.length
  const isDeletedAccount = profile.handle === 'missing.invalid'

  const convoId = initialConvo.id
  const {data: convo} = useConvoQuery(initialConvo)

  const onNavigateToProfile = useCallback(() => {
    navigation.navigate('Profile', {name: profile.did})
  }, [navigation, profile.did])

  const {mutate: muteConvo} = useMuteConvo(convoId, {
    onSuccess: data => {
      if (data.convo.muted) {
        Toast.show(_(msg({message: 'Chat muted', context: 'toast'})))
      } else {
        Toast.show(_(msg({message: 'Chat unmuted', context: 'toast'})))
      }
    },
    onError: () => {
      Toast.show(_(msg`Could not mute chat`), 'xmark')
    },
  })

  const [queueBlock, queueUnblock] = useProfileBlockMutationQueue(profile)

  const toggleBlock = React.useCallback(() => {
    if (listBlocks.length) {
      blockedByListControl.open()
      return
    }

    if (userBlock) {
      queueUnblock()
    } else {
      queueBlock()
    }
  }, [userBlock, listBlocks, blockedByListControl, queueBlock, queueUnblock])

  return isDeletedAccount ? (
    <Menu.Item
      label={_(msg`Leave conversation`)}
      onPress={() => leaveConvoControl.open()}>
      <Menu.ItemText>
        <Trans>Leave conversation</Trans>
      </Menu.ItemText>
      <Menu.ItemIcon icon={ArrowBoxLeft} />
    </Menu.Item>
  ) : (
    <>
      <Menu.Group>
        {showMarkAsRead && (
          <Menu.Item
            label={_(msg`Mark as read`)}
            onPress={() => markAsRead({convoId})}>
            <Menu.ItemText>
              <Trans>Mark as read</Trans>
            </Menu.ItemText>
            <Menu.ItemIcon icon={Bubble} />
          </Menu.Item>
        )}
        <Menu.Item
          label={_(msg`Go to user's profile`)}
          onPress={onNavigateToProfile}>
          <Menu.ItemText>
            <Trans>Go to profile</Trans>
          </Menu.ItemText>
          <Menu.ItemIcon icon={Person} />
        </Menu.Item>
        <Menu.Item
          label={_(msg`Mute conversation`)}
          onPress={() => muteConvo({mute: !convo?.muted})}>
          <Menu.ItemText>
            {convo?.muted ? (
              <Trans>Unmute conversation</Trans>
            ) : (
              <Trans>Mute conversation</Trans>
            )}
          </Menu.ItemText>
          <Menu.ItemIcon icon={convo?.muted ? Unmute : Mute} />
        </Menu.Item>
      </Menu.Group>
      <Menu.Divider />
      <Menu.Group>
        <Menu.Item
          label={isBlocking ? _(msg`Unblock account`) : _(msg`Block account`)}
          onPress={toggleBlock}>
          <Menu.ItemText>
            {isBlocking ? _(msg`Unblock account`) : _(msg`Block account`)}
          </Menu.ItemText>
          <Menu.ItemIcon icon={isBlocking ? PersonCheck : PersonX} />
        </Menu.Item>
        <Menu.Item
          label={_(msg`Report conversation`)}
          onPress={() => reportControl.open()}>
          <Menu.ItemText>
            <Trans>Report conversation</Trans>
          </Menu.ItemText>
          <Menu.ItemIcon icon={Flag} />
        </Menu.Item>
      </Menu.Group>
      <Menu.Divider />
      <Menu.Group>
        <Menu.Item
          label={_(msg`Leave conversation`)}
          onPress={() => leaveConvoControl.open()}>
          <Menu.ItemText>
            <Trans>Leave conversation</Trans>
          </Menu.ItemText>
          <Menu.ItemIcon icon={ArrowBoxLeft} />
        </Menu.Item>
      </Menu.Group>
    </>
  )
}

export {ConvoMenu}
