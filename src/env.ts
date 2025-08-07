export const LOG_DEBUG = process.env.EXPO_PUBLIC_LOG_DEBUG || ''
export const LOG_LEVEL = (process.env.EXPO_PUBLIC_LOG_LEVEL || 'info') as
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'

// Journal API Configuration
export const JOURNAL_API_CONFIG = {
  // Primary service endpoint
  PDS_ENDPOINT: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  APPVIEW_ENDPOINT: process.env.EXPO_PUBLIC_APP_VIEW_URL || 'http://localhost:3001',
  
  // Journal XRPC endpoints (xyz.tisocial.journal namespace)
  JOURNAL_ENDPOINTS: {
    CREATE_ENTRY: 'xyz.tisocial.journal.createEntry',
    GET_ENTRY: 'xyz.tisocial.journal.getEntry', 
    UPDATE_ENTRY: 'xyz.tisocial.journal.updateEntry',
    DELETE_ENTRY: 'xyz.tisocial.journal.deleteEntry',
    QUERY_FEED: 'xyz.tisocial.journal.queryFeed',
    SEARCH_ENTRIES: 'xyz.tisocial.journal.searchEntries',
    GET_PRIVACY_SETTINGS: 'xyz.tisocial.journal.getPrivacySettings',
    UPDATE_PRIVACY_SETTINGS: 'xyz.tisocial.journal.updatePrivacySettings',
    GET_ANALYTICS: 'xyz.tisocial.journal.getAnalytics',
    GET_FEED_SKELETON: 'xyz.tisocial.journal.getFeedSkeleton',
  },

  // Development vs Production configuration
  DEV_MODE: process.env.EXPO_PUBLIC_ENV === 'development' || __DEV__,
  
  // Request configuration
  REQUEST_TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second base delay
}
