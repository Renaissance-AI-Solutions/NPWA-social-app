import {useCallback} from 'react'
import {View, StyleSheet} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Text} from '#/components/Typography'
import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import {Globe_Stroke2_Corner0_Rounded as Globe} from '#/components/icons/Globe'
import {Group3_Stroke2_Corner0_Rounded as PersonGroup} from '#/components/icons/Group'
import {Shield_Stroke2_Corner0_Rounded as Shield} from '#/components/icons/Shield'
import {useDialog, Dialog} from '#/components/Dialog'

export type VisibilityLevel = 'private' | 'contacts' | 'community' | 'public'

interface VisibilityOption {
  value: VisibilityLevel
  label: string
  description: string
  icon: React.ReactNode
  color: string
  recommended?: boolean
  warning?: string
}

interface Props {
  visibility: VisibilityLevel
  onVisibilityChange: (visibility: VisibilityLevel) => void
  hasBadge?: boolean
  disabled?: boolean
  showDetailed?: boolean
}

export function PrivacyControls({
  visibility,
  onVisibilityChange,
  hasBadge = false,
  disabled = false,
  showDetailed = false,
}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const privacyDialog = useDialog()

  const visibilityOptions: VisibilityOption[] = [
    {
      value: 'private',
      label: _(msg`Private`),
      description: _(msg`Only you can see this entry. Perfect for sensitive personal documentation.`),
      icon: <Lock size="sm" fill={t.palette.contrast_600} />,
      color: t.palette.contrast_600,
      recommended: true,
    },
    {
      value: 'contacts',
      label: _(msg`Contacts Only`),
      description: _(msg`Only people you follow can see this entry. Good for trusted connections.`),
      icon: <PersonGroup size="sm" fill={t.palette.primary_600} />,
      color: t.palette.primary_600,
    },
    {
      value: 'community',
      label: _(msg`Badge Community`),
      description: hasBadge 
        ? _(msg`Visible to others with the same verification badge. Share experiences with your community.`)
        : _(msg`Available once you have a verification badge. Connect with others who share your experiences.`),
      icon: <Shield size="sm" fill={hasBadge ? t.palette.secondary_600 : t.palette.contrast_400} />,
      color: hasBadge ? t.palette.secondary_600 : t.palette.contrast_400,
      warning: !hasBadge ? _(msg`Requires verification badge`) : undefined,
    },
    {
      value: 'public',
      label: _(msg`Public`),
      description: _(msg`Anyone can see this entry. Use with caution for sensitive information.`),
      icon: <Globe size="sm" fill={t.palette.negative_600} />,
      color: t.palette.negative_600,
      warning: _(msg`Consider privacy implications carefully`),
    },
  ]

  const currentOption = visibilityOptions.find(opt => opt.value === visibility)

  const handleVisibilitySelect = useCallback((newVisibility: VisibilityLevel) => {
    // Don't allow community selection without badge
    if (newVisibility === 'community' && !hasBadge) {
      return
    }

    onVisibilityChange(newVisibility)
    privacyDialog.close()
  }, [onVisibilityChange, hasBadge, privacyDialog])

  const openPrivacyDialog = useCallback(() => {
    if (!disabled) {
      privacyDialog.open()
    }
  }, [disabled, privacyDialog])

  if (showDetailed) {
    return (
      <>
        <View style={styles.detailedContainer}>
          <Text style={[a.text_md, a.font_semi_bold, a.mb_sm]}>
            <Trans>Privacy Level</Trans>
          </Text>
          
          <View style={styles.optionsGrid}>
            {visibilityOptions.map((option) => {
              const isSelected = option.value === visibility
              const isDisabled = disabled || (option.value === 'community' && !hasBadge)
              
              return (
                <Button
                  key={option.value}
                  variant={isSelected ? 'solid' : 'outline'}
                  color={isSelected ? 'primary' : 'secondary'}
                  size="large"
                  onPress={() => handleVisibilitySelect(option.value)}
                  disabled={isDisabled}
                  label={option.label}
                  style={[
                    styles.optionButton,
                    isDisabled && styles.disabledOption,
                  ]}>
                  <View style={styles.optionContent}>
                    <View style={styles.optionHeader}>
                      {option.icon}
                      <Text style={[
                        a.text_md,
                        a.font_semi_bold,
                        isSelected && {color: t.palette.white},
                        isDisabled && {color: t.palette.contrast_400},
                      ]}>
                        {option.label}
                      </Text>
                      {option.recommended && !isDisabled && (
                        <View style={[styles.recommendedBadge, {backgroundColor: t.palette.positive_100}]}>
                          <Text style={[a.text_xs, {color: t.palette.positive_700}]}>
                            <Trans>Recommended</Trans>
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    <Text style={[
                      a.text_sm,
                      a.leading_snug,
                      a.mt_xs,
                      {color: isSelected ? t.palette.white : t.palette.contrast_600},
                      isDisabled && {color: t.palette.contrast_400},
                    ]}>
                      {option.description}
                    </Text>
                    
                    {option.warning && (
                      <Text style={[
                        a.text_xs,
                        a.mt_xs,
                        {color: isSelected ? t.palette.white : t.palette.negative_600},
                        isDisabled && {color: t.palette.contrast_400},
                      ]}>
                        ⚠️ {option.warning}
                      </Text>
                    )}
                  </View>
                </Button>
              )
            })}
          </View>
        </View>

        <Dialog control={privacyDialog}>
          <View style={styles.dialogContent}>
            <Text style={[a.text_lg, a.font_bold, a.mb_lg]}>
              <Trans>Choose Privacy Level</Trans>
            </Text>
            
            {visibilityOptions.map((option) => {
              const isSelected = option.value === visibility
              const isDisabled = option.value === 'community' && !hasBadge
              
              return (
                <Button
                  key={option.value}
                  variant={isSelected ? 'solid' : 'outline'}
                  color="primary"
                  size="large"
                  onPress={() => handleVisibilitySelect(option.value)}
                  disabled={isDisabled}
                  label={option.label}
                  style={[styles.dialogOption, isDisabled && styles.disabledOption]}>
                  <View style={styles.optionContent}>
                    <View style={styles.optionHeader}>
                      {option.icon}
                      <Text style={[
                        a.text_md,
                        a.font_semi_bold,
                        isSelected && {color: t.palette.white},
                        isDisabled && {color: t.palette.contrast_400},
                      ]}>
                        {option.label}
                      </Text>
                      {option.recommended && !isDisabled && (
                        <View style={[styles.recommendedBadge, {backgroundColor: t.palette.positive_100}]}>
                          <Text style={[a.text_xs, {color: t.palette.positive_700}]}>
                            <Trans>Recommended</Trans>
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    <Text style={[
                      a.text_sm,
                      a.leading_snug,
                      a.mt_xs,
                      {color: isSelected ? t.palette.white : t.palette.contrast_600},
                      isDisabled && {color: t.palette.contrast_400},
                    ]}>
                      {option.description}
                    </Text>
                    
                    {option.warning && (
                      <Text style={[
                        a.text_xs,
                        a.mt_xs,
                        {color: isSelected ? t.palette.white : t.palette.negative_600},
                        isDisabled && {color: t.palette.contrast_400},
                      ]}>
                        ⚠️ {option.warning}
                      </Text>
                    )}
                  </View>
                </Button>
              )
            })}
          </View>
        </Dialog>
      </>
    )
  }

  // Compact version
  return (
    <>
      <Button
        variant="outline"
        color="secondary"
        size="small"
        onPress={openPrivacyDialog}
        disabled={disabled}
        label={_(msg`Privacy: ${currentOption?.label || 'Unknown'}`)}
        style={styles.compactButton}>
        <View style={styles.compactContent}>
          {currentOption?.icon}
          <ButtonText style={[a.text_sm]}>
            {currentOption?.label || _(msg`Unknown`)}
          </ButtonText>
        </View>
      </Button>

      <Dialog control={privacyDialog}>
        <View style={styles.dialogContent}>
          <Text style={[a.text_lg, a.font_bold, a.mb_lg]}>
            <Trans>Choose Privacy Level</Trans>
          </Text>
          
          {visibilityOptions.map((option) => {
            const isSelected = option.value === visibility
            const isDisabled = option.value === 'community' && !hasBadge
            
            return (
              <Button
                key={option.value}
                variant={isSelected ? 'solid' : 'outline'}
                color="primary"
                size="large"
                onPress={() => handleVisibilitySelect(option.value)}
                disabled={isDisabled}
                label={option.label}
                style={[styles.dialogOption, isDisabled && styles.disabledOption]}>
                <View style={styles.optionContent}>
                  <View style={styles.optionHeader}>
                    {option.icon}
                    <Text style={[
                      a.text_md,
                      a.font_semi_bold,
                      isSelected && {color: t.palette.white},
                      isDisabled && {color: t.palette.contrast_400},
                    ]}>
                      {option.label}
                    </Text>
                    {option.recommended && !isDisabled && (
                      <View style={[styles.recommendedBadge, {backgroundColor: t.palette.positive_100}]}>
                        <Text style={[a.text_xs, {color: t.palette.positive_700}]}>
                          <Trans>Recommended</Trans>
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={[
                    a.text_sm,
                    a.leading_snug,
                    a.mt_xs,
                    {color: isSelected ? t.palette.white : t.palette.contrast_600},
                    isDisabled && {color: t.palette.contrast_400},
                  ]}>
                    {option.description}
                  </Text>
                  
                  {option.warning && (
                    <Text style={[
                      a.text_xs,
                      a.mt_xs,
                      {color: isSelected ? t.palette.white : t.palette.negative_600},
                      isDisabled && {color: t.palette.contrast_400},
                    ]}>
                      ⚠️ {option.warning}
                    </Text>
                  )}
                </View>
              </Button>
            )
          })}
          
          <View style={[styles.privacyNote, {backgroundColor: t.palette.contrast_50}]}>
            <Text style={[a.text_xs, {color: t.palette.contrast_600}]}>
              <Trans>
                💡 Private entries are recommended for sensitive information. 
                Community sharing requires verification badges to ensure authentic connections.
              </Trans>
            </Text>
          </View>
        </View>
      </Dialog>
    </>
  )
}

const styles = StyleSheet.create({
  detailedContainer: {
    gap: 12,
  },
  optionsGrid: {
    gap: 12,
  },
  optionButton: {
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  optionContent: {
    width: '100%',
    alignItems: 'flex-start',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recommendedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  disabledOption: {
    opacity: 0.5,
  },
  compactButton: {
    minWidth: 120,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dialogContent: {
    padding: 24,
    gap: 16,
    minWidth: 320,
  },
  dialogOption: {
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  privacyNote: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
})