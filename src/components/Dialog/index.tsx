import React, {useImperativeHandle} from 'react'
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  type ScrollView,
  type StyleProp,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native'
import {
  KeyboardAwareScrollView,
  useKeyboardHandler,
} from 'react-native-keyboard-controller'
import {runOnJS} from 'react-native-reanimated'
import {type ReanimatedScrollEvent} from 'react-native-reanimated/lib/typescript/hook/commonTypes'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {useEnableKeyboardController} from '#/lib/hooks/useEnableKeyboardController'
import {ScrollProvider} from '#/lib/ScrollContext'
import {logger} from '#/logger'
import {isAndroid, isIOS} from '#/platform/detection'
import {useA11y} from '#/state/a11y'
import {useDialogStateControlContext} from '#/state/dialogs'
import {List, type ListMethods, type ListProps} from '#/view/com/util/List'
import {atoms as a, tokens, useTheme} from '#/alf'
import {useThemeName} from '#/alf/util/useColorModeTheme'
import {Context, useDialogContext} from '#/components/Dialog/context'
import {
  type DialogControlProps,
  type DialogInnerProps,
  type DialogOuterProps,
} from '#/components/Dialog/types'
import {createInput} from '#/components/forms/TextField'
import {BottomSheet, BottomSheetSnapPoint} from '../../../modules/bottom-sheet'
import {
  type BottomSheetSnapPointChangeEvent,
  type BottomSheetStateChangeEvent,
} from '../../../modules/bottom-sheet/src/BottomSheet.types'
import {type BottomSheetNativeComponent} from '../../../modules/bottom-sheet/src/BottomSheetNativeComponent'

export {useDialogContext, useDialogControl} from '#/components/Dialog/context'
export * from '#/components/Dialog/shared'
export * from '#/components/Dialog/types'
export * from '#/components/Dialog/utils'

export const Input = createInput(TextInput)

export function Outer({
  children,
  control,
  onClose,
  nativeOptions,
  testID,
}: React.PropsWithChildren<DialogOuterProps>) {
  const themeName = useThemeName()
  const t = useTheme(themeName)
  const ref = React.useRef<BottomSheetNativeComponent>(null)
  const closeCallbacks = React.useRef<(() => void)[]>([])
  const {setDialogIsOpen, setFullyExpandedCount} =
    useDialogStateControlContext()

  const prevSnapPoint = React.useRef<BottomSheetSnapPoint>(
    BottomSheetSnapPoint.Hidden,
  )

  const [disableDrag, setDisableDrag] = React.useState(false)
  const [snapPoint, setSnapPoint] = React.useState<BottomSheetSnapPoint>(
    BottomSheetSnapPoint.Partial,
  )

  const callQueuedCallbacks = React.useCallback(() => {
    for (const cb of closeCallbacks.current) {
      try {
        cb()
      } catch (e: any) {
        logger.error(e || 'Error running close callback')
      }
    }

    closeCallbacks.current = []
  }, [])

  const open = React.useCallback<DialogControlProps['open']>(() => {
    // Run any leftover callbacks that might have been queued up before calling `.open()`
    callQueuedCallbacks()
    setDialogIsOpen(control.id, true)
    ref.current?.present()
  }, [setDialogIsOpen, control.id, callQueuedCallbacks])

  // This is the function that we call when we want to dismiss the dialog.
  const close = React.useCallback<DialogControlProps['close']>(cb => {
    if (typeof cb === 'function') {
      closeCallbacks.current.push(cb)
    }
    ref.current?.dismiss()
  }, [])

  // This is the actual thing we are doing once we "confirm" the dialog. We want the dialog's close animation to
  // happen before we run this. It is passed to the `BottomSheet` component.
  const onCloseAnimationComplete = React.useCallback(() => {
    // This removes the dialog from our list of stored dialogs. Not super necessary on iOS, but on Android this
    // tells us that we need to toggle the accessibility overlay setting
    setDialogIsOpen(control.id, false)
    callQueuedCallbacks()
    onClose?.()
  }, [callQueuedCallbacks, control.id, onClose, setDialogIsOpen])

  const onSnapPointChange = (e: BottomSheetSnapPointChangeEvent) => {
    const {snapPoint} = e.nativeEvent
    setSnapPoint(snapPoint)

    if (
      snapPoint === BottomSheetSnapPoint.Full &&
      prevSnapPoint.current !== BottomSheetSnapPoint.Full
    ) {
      setFullyExpandedCount(c => c + 1)
    } else if (
      snapPoint !== BottomSheetSnapPoint.Full &&
      prevSnapPoint.current === BottomSheetSnapPoint.Full
    ) {
      setFullyExpandedCount(c => c - 1)
    }
    prevSnapPoint.current = snapPoint
  }

  const onStateChange = (e: BottomSheetStateChangeEvent) => {
    if (e.nativeEvent.state === 'closed') {
      onCloseAnimationComplete()

      if (prevSnapPoint.current === BottomSheetSnapPoint.Full) {
        setFullyExpandedCount(c => c - 1)
      }
      prevSnapPoint.current = BottomSheetSnapPoint.Hidden
    }
  }

  useImperativeHandle(
    control.ref,
    () => ({
      open,
      close,
    }),
    [open, close],
  )

  const context = React.useMemo(
    () => ({
      close,
      isNativeDialog: true,
      nativeSnapPoint: snapPoint,
      disableDrag,
      setDisableDrag,
      isWithinDialog: true,
    }),
    [close, snapPoint, disableDrag, setDisableDrag],
  )

  return (
    <BottomSheet
      ref={ref}
      cornerRadius={20}
      backgroundColor={t.atoms.bg.backgroundColor}
      {...nativeOptions}
      onSnapPointChange={onSnapPointChange}
      onStateChange={onStateChange}
      disableDrag={disableDrag}>
      <Context.Provider value={context}>
        <View testID={testID} style={[a.relative]}>
          {children}
        </View>
      </Context.Provider>
    </BottomSheet>
  )
}

export function Inner({children, style, header}: DialogInnerProps) {
  const insets = useSafeAreaInsets()
  return (
    <>
      {header}
      <View
        style={[
          a.pt_2xl,
          a.px_xl,
          {
            paddingBottom: insets.bottom + insets.top,
          },
          style,
        ]}>
        {children}
      </View>
    </>
  )
}

export const ScrollableInner = React.forwardRef<ScrollView, DialogInnerProps>(
  function ScrollableInner(
    {children, contentContainerStyle, header, ...props},
    ref,
  ) {
    const {nativeSnapPoint, disableDrag, setDisableDrag} = useDialogContext()
    const insets = useSafeAreaInsets()

    useEnableKeyboardController(isIOS)

    const [keyboardHeight, setKeyboardHeight] = React.useState(0)

    useKeyboardHandler(
      {
        onEnd: e => {
          'worklet'
          runOnJS(setKeyboardHeight)(e.height)
        },
      },
      [],
    )

    let paddingBottom = 0
    if (isIOS) {
      paddingBottom += keyboardHeight / 4
      if (nativeSnapPoint === BottomSheetSnapPoint.Full) {
        paddingBottom += insets.bottom + tokens.space.md
      }
      paddingBottom = Math.max(paddingBottom, tokens.space._2xl)
    } else {
      paddingBottom += keyboardHeight
      if (nativeSnapPoint === BottomSheetSnapPoint.Full) {
        paddingBottom += insets.top
      }
      paddingBottom +=
        Math.max(insets.bottom, tokens.space._5xl) + tokens.space._2xl
    }

    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isAndroid) {
        return
      }
      const {contentOffset} = e.nativeEvent
      if (contentOffset.y > 0 && !disableDrag) {
        setDisableDrag(true)
      } else if (contentOffset.y <= 1 && disableDrag) {
        setDisableDrag(false)
      }
    }

    return (
      <KeyboardAwareScrollView
        contentContainerStyle={[
          a.pt_2xl,
          a.px_xl,
          {paddingBottom},
          contentContainerStyle,
        ]}
        ref={ref}
        {...props}
        bounces={nativeSnapPoint === BottomSheetSnapPoint.Full}
        bottomOffset={30}
        scrollEventThrottle={50}
        onScroll={isAndroid ? onScroll : undefined}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={header ? [0] : undefined}>
        {header}
        {children}
      </KeyboardAwareScrollView>
    )
  },
)

export const InnerFlatList = React.forwardRef<
  ListMethods,
  ListProps<any> & {
    webInnerStyle?: StyleProp<ViewStyle>
    webInnerContentContainerStyle?: StyleProp<ViewStyle>
  }
>(function InnerFlatList({style, ...props}, ref) {
  const insets = useSafeAreaInsets()
  const {nativeSnapPoint, disableDrag, setDisableDrag} = useDialogContext()

  const onScroll = (e: ReanimatedScrollEvent) => {
    'worklet'
    if (!isAndroid) {
      return
    }
    const {contentOffset} = e
    if (contentOffset.y > 0 && !disableDrag) {
      runOnJS(setDisableDrag)(true)
    } else if (contentOffset.y <= 1 && disableDrag) {
      runOnJS(setDisableDrag)(false)
    }
  }

  return (
    <ScrollProvider onScroll={onScroll}>
      <List
        keyboardShouldPersistTaps="handled"
        bounces={nativeSnapPoint === BottomSheetSnapPoint.Full}
        ListFooterComponent={<View style={{height: insets.bottom + 100}} />}
        ref={ref}
        {...props}
        style={[style]}
      />
    </ScrollProvider>
  )
})

export function Handle({difference = false}: {difference?: boolean}) {
  const t = useTheme()
  const {_} = useLingui()
  const {screenReaderEnabled} = useA11y()
  const {close} = useDialogContext()

  return (
    <View style={[a.absolute, a.w_full, a.align_center, a.z_10, {height: 20}]}>
      <Pressable
        accessible={screenReaderEnabled}
        onPress={() => close()}
        accessibilityLabel={_(msg`Dismiss`)}
        accessibilityHint={_(msg`Double tap to close the dialog`)}>
        <View
          style={[
            a.rounded_sm,
            {
              top: tokens.space._2xl / 2 - 2.5,
              width: 35,
              height: 5,
              alignSelf: 'center',
            },
            difference
              ? {
                  // TODO: mixBlendMode is only available on the new architecture -sfn
                  // backgroundColor: t.palette.white,
                  // mixBlendMode: 'difference',
                  backgroundColor: t.palette.white,
                  opacity: 0.75,
                }
              : {
                  backgroundColor: t.palette.contrast_975,
                  opacity: 0.5,
                },
          ]}
        />
      </Pressable>
    </View>
  )
}

export function Close() {
  return null
}
