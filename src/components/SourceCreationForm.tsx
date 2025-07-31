import React, {useState, useCallback} from 'react'
import {View, TextInput, Alert, StyleSheet} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText, ButtonIcon} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Text} from '#/components/Typography'
import {useSourcesAPI, type CreateSourceParams} from '#/lib/api/sources'
import {cleanError} from '#/lib/strings/errors'
import {logger} from '#/logger'
import {PageText_Stroke2_Corner0_Rounded as Document} from '#/components/icons/PageText'
import {ChainLink_Stroke2_Corner0_Rounded as LinkIcon} from '#/components/icons/ChainLink'
import {PlusLarge_Stroke2_Corner0_Rounded as Plus} from '#/components/icons/Plus'

interface SourceCreationFormProps {
  control: Dialog.DialogControlProps
  onSourceCreated?: () => void
}

interface FormData {
  name: string
  url: string
  badgeType: string
}

export function SourceCreationForm({
  control,
  onSourceCreated,
}: SourceCreationFormProps) {
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <SourceCreationFormInner
        control={control}
        onSourceCreated={onSourceCreated}
      />
    </Dialog.Outer>
  )
}

function SourceCreationFormInner({
  control,
  onSourceCreated,
}: SourceCreationFormProps) {
  const {_} = useLingui()
  const t = useTheme()
  const sourcesAPI = useSourcesAPI()

  const [formData, setFormData] = useState<FormData>({
    name: '',
    url: '',
    badgeType: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inputType, setInputType] = useState<'url' | 'document'>('url')

  const badgeTypes = [
    {value: '', label: _(msg`None`)},
    {value: 'havana', label: _(msg`Havana Syndrome`)},
    {value: 'gangstalked', label: _(msg`Gangstalked`)},
    {value: 'targeted', label: _(msg`Targeted Individual`)},
    {value: 'whistleblower', label: _(msg`Whistleblower`)},
    {value: 'retaliation', label: _(msg`Retaliation`)},
  ]

  const updateFormData = useCallback(
    (field: keyof FormData) => (value: string) => {
      setFormData(prev => ({...prev, [field]: value}))
    },
    [],
  )

  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim()) {
      Alert.alert(_(msg`Error`), _(msg`Please enter a source name`))
      return
    }

    if (inputType === 'url' && !formData.url.trim()) {
      Alert.alert(_(msg`Error`), _(msg`Please enter a URL`))
      return
    }

    setIsSubmitting(true)
    try {
      const params: CreateSourceParams = {
        name: formData.name.trim(),
        url: inputType === 'url' ? formData.url.trim() : undefined,
        badgeType: formData.badgeType || undefined,
      }

      // For document upload, we'll add documentId when Step 12 is implemented
      if (inputType === 'document') {
        params.documentId = undefined // Placeholder for future implementation
      }

      await sourcesAPI.create(params)

      // Reset form
      setFormData({name: '', url: '', badgeType: ''})
      
      // Close dialog and notify parent
      control.close(() => {
        onSourceCreated?.()
      })

      Alert.alert(_(msg`Success`), _(msg`Source created successfully`))
    } catch (error) {
      logger.error('Failed to create source', {message: cleanError(error)})
      Alert.alert(_(msg`Error`), _(msg`Failed to create source`))
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, inputType, sourcesAPI, control, onSourceCreated, _])

  const handleCancel = useCallback(() => {
    control.close()
  }, [control])

  return (
    <Dialog.ScrollableInner
      label={_(msg`Create New Source`)}
      style={[a.w_full, {maxWidth: 600}]}>
      
      {/* Header */}
      <Dialog.Header
        renderLeft={() => (
          <Button
            variant="ghost"
            size="small"
            onPress={handleCancel}
            label={_(msg`Cancel`)}>
            <ButtonText>
              <Trans>Cancel</Trans>
            </ButtonText>
          </Button>
        )}
        renderRight={() => (
          <Button
            variant="solid"
            color="primary" 
            size="small"
            onPress={handleSubmit}
            disabled={isSubmitting}
            label={_(msg`Create Source`)}>
            <ButtonText>
              {isSubmitting ? <Trans>Creating...</Trans> : <Trans>Create</Trans>}
            </ButtonText>
          </Button>
        )}>
        <Dialog.HeaderText>
          <Trans>Create New Source</Trans>
        </Dialog.HeaderText>
      </Dialog.Header>

      <View style={[a.flex_1, a.gap_lg, a.pt_lg]}>
        {/* Input Type Selection */}
        <View style={styles.section}>
          <Text style={[a.text_md, a.font_bold, a.mb_sm, {color: t.palette.contrast_800}]}>
            <Trans>Source Type</Trans>
          </Text>
          <View style={styles.typeButtons}>
            <Button
              variant={inputType === 'url' ? 'solid' : 'outline'}
              color="primary"
              size="large"
              onPress={() => setInputType('url')}
              label={_(msg`Add URL source`)}>
              <ButtonIcon icon={LinkIcon} />
              <ButtonText>
                <Trans>URL</Trans>
              </ButtonText>
            </Button>
            <Button
              variant={inputType === 'document' ? 'solid' : 'outline'}
              color="primary"
              size="large"
              onPress={() => setInputType('document')}
              label={_(msg`Upload document (coming soon)`)}>
              <ButtonIcon icon={Document} />
              <ButtonText>
                <Trans>Document</Trans>
              </ButtonText>
            </Button>
          </View>
          {inputType === 'document' && (
            <Text style={[a.text_sm, a.mt_xs, {color: t.palette.contrast_600}]}>
              <Trans>Document upload functionality will be available in Step 12</Trans>
            </Text>
          )}
        </View>

        {/* Source Name */}
        <View style={styles.section}>
          <Text style={[a.text_md, a.font_bold, a.mb_sm, {color: t.palette.contrast_800}]}>
            <Trans>Source Name</Trans>
            <Text style={{color: t.palette.negative_500}}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: t.palette.contrast_50,
                borderColor: t.palette.contrast_300,
                color: t.palette.contrast_800,
              },
            ]}
            value={formData.name}
            onChangeText={updateFormData('name')}
            placeholder={_(msg`Enter a descriptive name for this source`)}
            placeholderTextColor={t.palette.contrast_400}
            multiline
            accessibilityLabel={_(msg`Source name`)}
            accessibilityHint={_(msg`Enter a descriptive name for this source`)}
          />
        </View>

        {/* URL Input (only when URL type is selected) */}
        {inputType === 'url' && (
          <View style={styles.section}>
            <Text style={[a.text_md, a.font_bold, a.mb_sm, {color: t.palette.contrast_800}]}>
              <Trans>URL</Trans>
              <Text style={{color: t.palette.negative_500}}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: t.palette.contrast_50,
                  borderColor: t.palette.contrast_300,
                  color: t.palette.contrast_800,
                },
              ]}
              value={formData.url}
              onChangeText={updateFormData('url')}
              placeholder={_(msg`https://example.com/document.pdf`)}
              placeholderTextColor={t.palette.contrast_400}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={_(msg`Source URL`)}
              accessibilityHint={_(msg`Enter the URL for this source`)}
            />
          </View>
        )}

        {/* Document Upload Placeholder (only when document type is selected) */}
        {inputType === 'document' && (
          <View style={styles.section}>
            <Text style={[a.text_md, a.font_bold, a.mb_sm, {color: t.palette.contrast_800}]}>
              <Trans>Document Upload</Trans>
            </Text>
            <View
              style={[
                styles.documentPlaceholder,
                {
                  backgroundColor: t.palette.contrast_25,
                  borderColor: t.palette.contrast_200,
                },
              ]}>
              <Document size="lg" fill={t.palette.contrast_400} />
              <Text style={[a.text_center, {color: t.palette.contrast_600}]}>
                <Trans>Document upload will be available in Step 12</Trans>
              </Text>
              <Text style={[a.text_sm, a.text_center, {color: t.palette.contrast_500}]}>
                <Trans>This feature is part of the secure document storage implementation</Trans>
              </Text>
            </View>
          </View>
        )}

        {/* Badge Type Selection */}
        <View style={styles.section}>
          <Text style={[a.text_md, a.font_bold, a.mb_sm, {color: t.palette.contrast_800}]}>
            <Trans>Associated Badge Type</Trans>
          </Text>
          <Text style={[a.text_sm, a.mb_sm, {color: t.palette.contrast_600}]}>
            <Trans>Optional: Associate this source with a specific victim badge type</Trans>
          </Text>
          <View style={styles.badgeButtons}>
            {badgeTypes.map(badge => (
              <Button
                key={badge.value}
                variant={formData.badgeType === badge.value ? 'solid' : 'outline'}
                color="primary"
                size="small"
                onPress={() => updateFormData('badgeType')(badge.value)}
                label={_(msg`Select ${badge.label} badge type`)}>
                <ButtonText>
                  {badge.label}
                </ButtonText>
              </Button>
            ))}
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={[a.text_sm, {color: t.palette.contrast_600}]}>
            <Trans>
              Sources help support claims and provide credibility to journal entries and posts. 
              Once created, sources can be voted on by the community and referenced in your content.
            </Trans>
          </Text>
        </View>
      </View>
    </Dialog.ScrollableInner>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 44,
  },
  documentPlaceholder: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  badgeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
})