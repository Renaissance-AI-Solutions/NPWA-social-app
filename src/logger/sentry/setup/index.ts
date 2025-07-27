/**
 * Importing these separately from `platform/detection` and `lib/app-info` to
 * avoid future conflicts and/or circular deps
 */

import {init} from '@sentry/react-native'

import pkgJson from '#/../package.json'

/**
 * Examples:
 * - `dev`
 * - `1.99.0`
 */
const release = process.env.SENTRY_RELEASE || pkgJson.version

/**
 * The latest deployed commit hash
 */
const dist = process.env.SENTRY_DIST || 'dev'

const sentryConfig = {
  enabled: !!process.env.SENTRY_DSN,
  autoSessionTracking: false,
  dsn: process.env.SENTRY_DSN,
  debug: __DEV__, // Enable debug in development for easier troubleshooting
  environment: process.env.NODE_ENV,
  dist,
  release,
  tracesSampleRate: __DEV__ ? 1.0 : 0.1, // Capture all traces in dev, 10% in prod
  ignoreErrors: [
    /*
     * Unknown internals errors
     */
    `t is not defined`,
    `Can't find variable: t`,
    /*
     * Un-useful errors
     */
    `Network request failed`,
  ],
  /**
   * Does not affect traces of error events or other logs, just disables
   * automatically attaching stack traces to events. This helps us group events
   * and prevents explosions of separate issues.
   *
   * @see https://docs.sentry.io/platforms/react-native/configuration/options/#attach-stacktrace
   */
  attachStacktrace: false,
}

if (__DEV__) {
  console.log('🔧 Sentry Init Config:', {
    enabled: sentryConfig.enabled,
    dsn: sentryConfig.dsn ? 'SET' : 'MISSING',
    debug: sentryConfig.debug,
    environment: sentryConfig.environment,
    release: sentryConfig.release,
    dist: sentryConfig.dist
  })
}

init(sentryConfig)

// Test function to verify Sentry is working
export const testSentryError = () => {
  console.log('🧪 Testing Sentry error capture...')
  const error = new Error('Test Sentry Error - This is intentional for debugging')
  error.stack = error.stack || 'No stack trace available'
  
  // Log to console first
  console.error('Manually triggering Sentry error:', error)
  
  // Send to Sentry
  import('@sentry/react-native').then(Sentry => {
    Sentry.captureException(error, {
      tags: {
        test: 'manual_trigger',
        environment: process.env.NODE_ENV || 'unknown'
      },
      extra: {
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
      }
    })
    console.log('✅ Sentry.captureException called')
  })
}

// Auto-test Sentry on app start in development
if (__DEV__) {
  console.log('🔧 Sentry Debug Info:')
  console.log('📡 Sentry DSN:', process.env.SENTRY_DSN ? 'Present' : 'Missing')
  console.log('🔑 Sentry Auth Token:', process.env.SENTRY_AUTH_TOKEN ? 'Present' : 'Missing')
  console.log('🌍 NODE_ENV:', process.env.NODE_ENV)
  console.log('🚀 __DEV__:', __DEV__)
  
  if (process.env.SENTRY_DSN) {
    console.log('✅ Sentry is enabled and will auto-test in 5 seconds')
    setTimeout(() => {
      console.log('🔧 Sentry Development Test - Auto-triggered after 5 seconds')
      testSentryError()
    }, 5000)
  } else {
    console.warn('⚠️ Sentry DSN not found - Sentry is disabled')
  }
}
