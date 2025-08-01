import React, {useCallback} from 'react'
import {LayoutAnimation} from 'react-native'
import {
  ComAtprotoServerCreateAccount,
  type ComAtprotoServerDescribeServer,
} from '@atproto/api'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import * as EmailValidator from 'email-validator'

import {DEFAULT_SERVICE} from '#/lib/constants'
import {cleanError} from '#/lib/strings/errors'
import {createFullHandle} from '#/lib/strings/handles'
import {getAge} from '#/lib/strings/time'
import {logger} from '#/logger'
import {useSessionApi} from '#/state/session'
import {useOnboardingDispatch} from '#/state/shell'

export type ServiceDescription = ComAtprotoServerDescribeServer.OutputSchema

const DEFAULT_DATE = new Date(Date.now() - 60e3 * 60 * 24 * 365 * 20) // default to 20 years ago

export enum SignupStep {
  INFO,
  HANDLE,
  CAPTCHA,
}

type SubmitTask = {
  verificationCode: string | undefined
  mutableProcessed: boolean // OK to mutate assuming it's never read in render.
}

type ErrorField =
  | 'invite-code'
  | 'email'
  | 'handle'
  | 'password'
  | 'date-of-birth'

export type SignupState = {
  hasPrev: boolean
  activeStep: SignupStep

  serviceUrl: string
  serviceDescription?: ServiceDescription
  userDomain: string
  dateOfBirth: Date
  email: string
  password: string
  inviteCode: string
  handle: string

  error: string
  errorField?: ErrorField
  isLoading: boolean

  pendingSubmit: null | SubmitTask

  // Tracking
  signupStartTime: number
  fieldErrors: Record<ErrorField, number>
  backgroundCount: number
}

export type SignupAction =
  | {type: 'prev'}
  | {type: 'next'}
  | {type: 'finish'}
  | {type: 'setStep'; value: SignupStep}
  | {type: 'setServiceUrl'; value: string}
  | {type: 'setServiceDescription'; value: ServiceDescription | undefined}
  | {type: 'setEmail'; value: string}
  | {type: 'setPassword'; value: string}
  | {type: 'setDateOfBirth'; value: Date}
  | {type: 'setInviteCode'; value: string}
  | {type: 'setHandle'; value: string}
  | {type: 'setError'; value: string; field?: ErrorField}
  | {type: 'clearError'}
  | {type: 'setIsLoading'; value: boolean}
  | {type: 'submit'; task: SubmitTask}
  | {type: 'incrementBackgroundCount'}

export const initialState: SignupState = {
  hasPrev: false,
  activeStep: SignupStep.INFO,

  serviceUrl: DEFAULT_SERVICE,
  serviceDescription: undefined,
  userDomain: '',
  dateOfBirth: DEFAULT_DATE,
  email: '',
  password: '',
  handle: '',
  inviteCode: '',

  error: '',
  errorField: undefined,
  isLoading: false,

  pendingSubmit: null,

  // Tracking
  signupStartTime: Date.now(),
  fieldErrors: {
    'invite-code': 0,
    email: 0,
    handle: 0,
    password: 0,
    'date-of-birth': 0,
  },
  backgroundCount: 0,
}

export function is13(date: Date) {
  return getAge(date) >= 13
}

export function is18(date: Date) {
  return getAge(date) >= 18
}

export function reducer(s: SignupState, a: SignupAction): SignupState {
  let next = {...s}

  switch (a.type) {
    case 'prev': {
      if (s.activeStep !== SignupStep.INFO) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        next.activeStep--
        next.error = ''
        next.errorField = undefined
      }
      break
    }
    case 'next': {
      if (s.activeStep !== SignupStep.CAPTCHA) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        next.activeStep++
        next.error = ''
        next.errorField = undefined
      }
      break
    }
    case 'setStep': {
      next.activeStep = a.value
      break
    }
    case 'setServiceUrl': {
      next.serviceUrl = a.value
      break
    }
    case 'setServiceDescription': {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)

      next.serviceDescription = a.value
      next.userDomain = a.value?.availableUserDomains[0] ?? ''
      next.isLoading = false
      break
    }

    case 'setEmail': {
      next.email = a.value
      break
    }
    case 'setPassword': {
      next.password = a.value
      break
    }
    case 'setDateOfBirth': {
      next.dateOfBirth = a.value
      break
    }
    case 'setInviteCode': {
      next.inviteCode = a.value
      break
    }
    case 'setHandle': {
      next.handle = a.value
      break
    }
    case 'setIsLoading': {
      next.isLoading = a.value
      break
    }
    case 'setError': {
      next.error = a.value
      next.errorField = a.field

      // Track field errors
      if (a.field) {
        next.fieldErrors[a.field] = (next.fieldErrors[a.field] || 0) + 1

        // Log the field error
        logger.metric(
          'signup:fieldError',
          {
            field: a.field,
            errorCount: next.fieldErrors[a.field],
            errorMessage: a.value,
            activeStep: next.activeStep,
          },
          {statsig: true},
        )
      }
      break
    }
    case 'clearError': {
      next.error = ''
      next.errorField = undefined
      break
    }
    case 'submit': {
      next.pendingSubmit = a.task
      break
    }
    case 'incrementBackgroundCount': {
      next.backgroundCount = s.backgroundCount + 1

      // Log background/foreground event during signup
      logger.metric(
        'signup:backgrounded',
        {
          activeStep: next.activeStep,
          backgroundCount: next.backgroundCount,
        },
        {statsig: true},
      )
      break
    }
  }

  next.hasPrev = next.activeStep !== SignupStep.INFO

  logger.debug('signup', next)

  if (s.activeStep !== next.activeStep) {
    logger.debug('signup: step changed', {activeStep: next.activeStep})
  }

  return next
}

interface IContext {
  state: SignupState
  dispatch: React.Dispatch<SignupAction>
}
export const SignupContext = React.createContext<IContext>({} as IContext)
export const useSignupContext = () => React.useContext(SignupContext)

export function useSubmitSignup() {
  const {_} = useLingui()
  const {createAccount} = useSessionApi()
  const onboardingDispatch = useOnboardingDispatch()

  return useCallback(
    async (state: SignupState, dispatch: (action: SignupAction) => void) => {
      if (!state.email) {
        dispatch({type: 'setStep', value: SignupStep.INFO})
        return dispatch({
          type: 'setError',
          value: _(msg`Please enter your email.`),
          field: 'email',
        })
      }
      if (!EmailValidator.validate(state.email)) {
        dispatch({type: 'setStep', value: SignupStep.INFO})
        return dispatch({
          type: 'setError',
          value: _(msg`Your email appears to be invalid.`),
          field: 'email',
        })
      }
      if (!state.password) {
        dispatch({type: 'setStep', value: SignupStep.INFO})
        return dispatch({
          type: 'setError',
          value: _(msg`Please choose your password.`),
          field: 'password',
        })
      }
      if (!state.handle) {
        dispatch({type: 'setStep', value: SignupStep.HANDLE})
        return dispatch({
          type: 'setError',
          value: _(msg`Please choose your handle.`),
          field: 'handle',
        })
      }
      if (
        state.serviceDescription?.phoneVerificationRequired &&
        !state.pendingSubmit?.verificationCode
      ) {
        dispatch({type: 'setStep', value: SignupStep.CAPTCHA})
        logger.error('Signup Flow Error', {
          errorMessage: 'Verification captcha code was not set.',
          registrationHandle: state.handle,
        })
        return dispatch({
          type: 'setError',
          value: _(msg`Please complete the verification captcha.`),
        })
      }
      dispatch({type: 'setError', value: ''})
      dispatch({type: 'setIsLoading', value: true})

      try {
        await createAccount(
          {
            service: state.serviceUrl,
            email: state.email,
            handle: createFullHandle(state.handle, state.userDomain),
            password: state.password,
            birthDate: state.dateOfBirth,
            inviteCode: state.inviteCode.trim(),
            verificationCode: state.pendingSubmit?.verificationCode,
          },
          {
            signupDuration: Date.now() - state.signupStartTime,
            fieldErrorsTotal: Object.values(state.fieldErrors).reduce(
              (a, b) => a + b,
              0,
            ),
            backgroundCount: state.backgroundCount,
          },
        )

        /*
         * Must happen last so that if the user has multiple tabs open and
         * createAccount fails, one tab is not stuck in onboarding — Eric
         */
        onboardingDispatch({type: 'start'})
      } catch (e: any) {
        let errMsg = e.toString()
        if (e instanceof ComAtprotoServerCreateAccount.InvalidInviteCodeError) {
          dispatch({
            type: 'setError',
            value: _(
              msg`Invite code not accepted. Check that you input it correctly and try again.`,
            ),
            field: 'invite-code',
          })
          dispatch({type: 'setStep', value: SignupStep.INFO})
          return
        }

        const error = cleanError(errMsg)
        const isHandleError = error.toLowerCase().includes('handle')

        dispatch({type: 'setIsLoading', value: false})
        dispatch({
          type: 'setError',
          value: error,
          field: isHandleError ? 'handle' : undefined,
        })
        dispatch({type: 'setStep', value: isHandleError ? 2 : 1})

        logger.error('Signup Flow Error', {
          errorMessage: error,
          registrationHandle: state.handle,
        })
      } finally {
        dispatch({type: 'setIsLoading', value: false})
      }
    },
    [_, onboardingDispatch, createAccount],
  )
}
