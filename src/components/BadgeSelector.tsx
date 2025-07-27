import React, {useState} from 'react'
import {View, TouchableOpacity, Alert} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {Button, ButtonText} from '#/components/Button'
import {AvatarBadge, type VictimBadge, type BadgeType, createVictimBadge, BADGE_CONFIG} from '#/components/AvatarBadge'
import * as TextField from '#/components/forms/TextField'

interface Props {
  badges: VictimBadge[]
  onBadgesChange: (badges: VictimBadge[]) => void
  maxBadges?: number
}

export function BadgeSelector({badges, onBadgesChange, maxBadges = 5}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const [selectedBadge, setSelectedBadge] = useState<BadgeType | null>(null)
  const [evidenceUri, setEvidenceUri] = useState('')

  const availableBadgeTypes: BadgeType[] = ['havana', 'gangstalked', 'targeted', 'whistleblower', 'retaliation']
  
  const handleAddBadge = () => {
    if (!selectedBadge) {
      Alert.alert(
        _(msg`Select Badge Type`),
        _(msg`Please select a badge type before adding.`)
      )
      return
    }

    if (badges.length >= maxBadges) {
      Alert.alert(
        _(msg`Maximum Badges Reached`),
        _(msg`You can only have ${maxBadges} badges maximum.`)
      )
      return
    }

    const existingBadge = badges.find(b => b.badgeType === selectedBadge)
    if (existingBadge) {
      Alert.alert(
        _(msg`Badge Already Added`),
        _(msg`You already have this type of badge.`)
      )
      return
    }

    const newBadge = createVictimBadge(selectedBadge, 0, evidenceUri || undefined)
    onBadgesChange([...badges, newBadge])
    setSelectedBadge(null)
    setEvidenceUri('')
  }

  const handleRemoveBadge = (badgeType: BadgeType) => {
    onBadgesChange(badges.filter(b => b.badgeType !== badgeType))
  }

  const handleUploadEvidence = (_badgeType: BadgeType) => {
    // TODO: Implement evidence upload functionality
    Alert.alert(
      _(msg`Evidence Upload`),
      _(msg`Evidence upload functionality will be implemented in the document management system.`)
    )
  }

  return (
    <View style={[a.gap_md]}>
      <View>
        <TextField.LabelText>
          <Trans>Victim Classification Badges</Trans>
        </TextField.LabelText>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium, a.mb_md]}>
          <Trans>Select badges that represent your situation. These help connect you with others who share similar experiences.</Trans>
        </Text>

        {/* Current badges */}
        {badges.length > 0 && (
          <View style={[a.mb_md, a.p_md, a.border, a.rounded_md, {borderColor: t.palette.contrast_200}]}>
            <Text style={[a.text_sm, a.font_bold, a.mb_sm]}>
              <Trans>Your Badges:</Trans>
            </Text>
            <View style={[a.gap_sm]}>
              {badges.map((badge, index) => (
                                 <View key={`${badge.badgeType}-${index}`} style={[a.flex_row, a.align_center, a.justify_between, a.p_sm, a.rounded_sm, {backgroundColor: t.palette.contrast_50}]}>
                  <View style={[a.flex_row, a.align_center, a.gap_sm]}>
                    <AvatarBadge badges={[badge]} size="small" showLabels={false} maxDisplay={1} />
                    <View>
                      <Text style={[a.text_sm, a.font_bold]}>
                        {BADGE_CONFIG[badge.badgeType].label}
                      </Text>
                      <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                        {badge.verificationLevel === 0 ? 'Unverified' : 
                         badge.verificationLevel === 1 ? 'Community Verified' :
                         badge.verificationLevel === 2 ? 'Document Verified' : 'AI Verified'}
                      </Text>
                    </View>
                  </View>
                  <View style={[a.flex_row, a.gap_xs]}>
                    <Button
                      size="small"
                      color="primary"
                      variant="ghost"
                      label={_(msg`Upload evidence`)}
                      onPress={() => handleUploadEvidence(badge.badgeType)}>
                      <ButtonText style={[a.text_xs]}>
                        <Trans>Evidence</Trans>
                      </ButtonText>
                    </Button>
                    <Button
                      size="small"
                      color="negative"
                      variant="ghost"
                      label={_(msg`Remove badge`)}
                      onPress={() => handleRemoveBadge(badge.badgeType)}>
                      <ButtonText style={[a.text_xs]}>
                        <Trans>Remove</Trans>
                      </ButtonText>
                    </Button>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Add new badge */}
        {badges.length < maxBadges && (
          <View style={[a.p_md, a.border, a.rounded_md, {borderColor: t.palette.contrast_200}]}>
            <Text style={[a.text_sm, a.font_bold, a.mb_sm]}>
              <Trans>Add New Badge:</Trans>
            </Text>
            
            {/* Badge type selection */}
            <View style={[a.mb_md]}>
              <Text style={[a.text_xs, a.font_bold, a.mb_xs]}>
                <Trans>Badge Type:</Trans>
              </Text>
              <View style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
                {availableBadgeTypes
                  .filter(type => !badges.find(b => b.badgeType === type))
                  .map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      a.px_md,
                      a.py_sm,
                      a.border,
                      a.rounded_full,
 
                      {
                        borderColor: selectedBadge === type ? BADGE_CONFIG[type].color : t.palette.contrast_300,
                        backgroundColor: selectedBadge === type ? `${BADGE_CONFIG[type].color}20` : 'transparent'
                      }
                    ]}
                    onPress={() => setSelectedBadge(selectedBadge === type ? null : type)}>
                    <Text style={[
                      a.text_xs,
                      a.font_bold,
                      {color: selectedBadge === type ? BADGE_CONFIG[type].color : t.atoms.text_contrast_medium.color}
                    ]}>
                      {BADGE_CONFIG[type].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Badge description */}
            {selectedBadge && (
              <View style={[a.mb_md, a.p_sm, a.rounded_sm, {backgroundColor: `${BADGE_CONFIG[selectedBadge].color}10`}]}>
                <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                  {BADGE_CONFIG[selectedBadge].description}
                </Text>
              </View>
            )}

            {/* Evidence URI (optional) */}
            <View style={[a.mb_md]}>
              <Text style={[a.text_xs, a.font_bold, a.mb_xs]}>
                <Trans>Evidence Link (Optional):</Trans>
              </Text>
              <TextField.Root>
                               <TextField.Input
                 label={_(msg`Evidence link`)}
                 value={evidenceUri}
                 onChangeText={setEvidenceUri}
                 placeholder={_(msg`Link to supporting evidence or documents`)}
                 autoCapitalize="none"
                 keyboardType="url"
               />
              </TextField.Root>
              <Text style={[a.text_2xs, t.atoms.text_contrast_medium, a.mt_xs]}>
                <Trans>This will be encrypted and only visible to you and verified reviewers.</Trans>
              </Text>
            </View>

            {/* Add button */}
            <Button
              size="small"
              color="primary"
              variant="solid"
              label={_(msg`Add badge`)}
              disabled={!selectedBadge}
              onPress={handleAddBadge}
              style={[a.rounded_full]}>
              <ButtonText style={[a.text_sm]}>
                <Trans>Add Badge</Trans>
              </ButtonText>
            </Button>
          </View>
        )}

        {/* Help text */}
        <Text style={[a.text_2xs, t.atoms.text_contrast_medium, a.mt_sm]}>
          <Trans>
            Badges help the community understand your situation and connect you with others who share similar experiences. 
            Evidence can be provided to increase verification level, but is never required.
          </Trans>
        </Text>
      </View>
    </View>
  )
} 