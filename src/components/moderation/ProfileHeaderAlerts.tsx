import {StyleProp, ViewStyle} from 'react-native'
import {ModerationDecision} from '@atproto/api'

import {getModerationCauseKey, unique} from '#/lib/moderation'
import * as Pills from '#/components/Pills'

export function ProfileHeaderAlerts({
  moderation,
}: {
  moderation: ModerationDecision
  style?: StyleProp<ViewStyle>
}) {
  const modui = moderation.ui('profileView')
  if (!modui.alert && !modui.inform) {
    return null
  }

  return (
    <Pills.Row size="lg">
      {modui.alerts.filter(unique).map(cause => (
        <Pills.Label
          size="lg"
          key={getModerationCauseKey(cause)}
          cause={cause}
        />
      ))}
      {modui.informs.filter(unique).map(cause => (
        <Pills.Label
          size="lg"
          key={getModerationCauseKey(cause)}
          cause={cause}
        />
      ))}
    </Pills.Row>
  )
}
