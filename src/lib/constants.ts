import {type Insets, Platform} from 'react-native'
import {type AppBskyActorDefs} from '@atproto/api'

// AT Protocol Development Environment Configuration
export const LOCAL_DEV_SERVICE =
  Platform.OS === 'android' ? 'http://10.0.2.2:2583' : 'http://localhost:2583'
export const STAGING_SERVICE = 'https://staging.bsky.dev'
export const BSKY_SERVICE = 'https://bsky.social'
export const PUBLIC_BSKY_SERVICE = Platform.OS === 'android' ? 'http://10.0.2.2:2584' : 'http://localhost:2584'
export const DEFAULT_SERVICE = LOCAL_DEV_SERVICE
const HELP_DESK_LANG = 'en-us'
export const HELP_DESK_URL = `https://blueskyweb.zendesk.com/hc/${HELP_DESK_LANG}`
export const EMBED_SERVICE = Platform.OS === 'android' ? 'http://10.0.2.2:2584' : 'http://localhost:2584'
export const EMBED_SCRIPT = `${EMBED_SERVICE}/static/embed.js`
export const BSKY_DOWNLOAD_URL = Platform.OS === 'android' ? 'http://10.0.2.2:2584/download' : 'http://localhost:2584/download'
export const STARTER_PACK_MAX_SIZE = 150

// HACK
// Yes, this is exactly what it looks like. It's a hard-coded constant
// reflecting the number of new users in the last week. We don't have
// time to add a route to the servers for this so we're just going to hard
// code and update this number with each release until we can get the
// server route done.
// -prf
export const JOINED_THIS_WEEK = 560000 // estimate as of 12/18/24

export const DISCOVER_DEBUG_DIDS: Record<string, true> = {
  'did:plc:oisofpd7lj26yvgiivf3lxsi': true, // hailey.at
  'did:plc:p2cp5gopk7mgjegy6wadk3ep': true, // samuel.bsky.team
  'did:plc:ragtjsm2j2vknwkz3zp4oxrd': true, // pfrazee.com
  'did:plc:vpkhqolt662uhesyj6nxm7ys': true, // why.bsky.team
  'did:plc:3jpt2mvvsumj2r7eqk4gzzjz': true, // esb.lol
  'did:plc:vjug55kidv6sye7ykr5faxxn': true, // emilyliu.me
  'did:plc:tgqseeot47ymot4zro244fj3': true, // iwsmith.bsky.social
  'did:plc:2dzyut5lxna5ljiaasgeuffz': true, // mrnuma.bsky.social
}

const BASE_FEEDBACK_FORM_URL = `${HELP_DESK_URL}/requests/new`
export function FEEDBACK_FORM_URL({
  email,
  handle,
}: {
  email?: string
  handle?: string
}): string {
  let str = BASE_FEEDBACK_FORM_URL
  if (email) {
    str += `?tf_anonymous_requester_email=${encodeURIComponent(email)}`
    if (handle) {
      str += `&tf_17205412673421=${encodeURIComponent(handle)}`
    }
  }
  return str
}

export const MAX_DISPLAY_NAME = 64
export const MAX_DESCRIPTION = 256

export const MAX_GRAPHEME_LENGTH = 300

export const MAX_DM_GRAPHEME_LENGTH = 1000

// Recommended is 100 per: https://www.w3.org/WAI/GL/WCAG20/tests/test3.html
// but increasing limit per user feedback
export const MAX_ALT_TEXT = 2000

export const MAX_REPORT_REASON_GRAPHEME_LENGTH = 2000

export function IS_TEST_USER(handle?: string) {
  return handle && handle?.endsWith('.test')
}

export function IS_PROD_SERVICE(url?: string) {
  return url && url !== STAGING_SERVICE && !url.startsWith(LOCAL_DEV_SERVICE)
}

export const PROD_DEFAULT_FEED = (rkey: string) =>
  `at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/${rkey}`

export const STAGING_DEFAULT_FEED = (rkey: string) =>
  `at://did:plc:yofh3kx63drvfljkibw5zuxo/app.bsky.feed.generator/${rkey}`

export const PROD_FEEDS = [
  `feedgen|${PROD_DEFAULT_FEED('whats-hot')}`,
  `feedgen|${PROD_DEFAULT_FEED('thevids')}`,
]

export const STAGING_FEEDS = [
  `feedgen|${STAGING_DEFAULT_FEED('whats-hot')}`,
  `feedgen|${STAGING_DEFAULT_FEED('thevids')}`,
]

export const FEEDBACK_FEEDS = [...PROD_FEEDS, ...STAGING_FEEDS]

export const POST_IMG_MAX = {
  width: 2000,
  height: 2000,
  size: 1000000,
}

export const STAGING_LINK_META_PROXY =
  'https://cardyb.staging.bsky.dev/v1/extract?url='

// Use local AppView for link meta proxy in development
export const PROD_LINK_META_PROXY = Platform.OS === 'android' ? 'http://10.0.2.2:2584/v1/extract?url=' : 'http://localhost:2584/v1/extract?url='

export function LINK_META_PROXY(serviceUrl: string) {
  if (IS_PROD_SERVICE(serviceUrl)) {
    return PROD_LINK_META_PROXY
  }

  return STAGING_LINK_META_PROXY
}

// Use local status page for development
export const STATUS_PAGE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:2584/status' : 'http://localhost:2584/status'

// Hitslop constants
export const createHitslop = (size: number): Insets => ({
  top: size,
  left: size,
  bottom: size,
  right: size,
})
export const HITSLOP_10 = createHitslop(10)
export const HITSLOP_20 = createHitslop(20)
export const HITSLOP_30 = createHitslop(30)
export const POST_CTRL_HITSLOP = {top: 5, bottom: 10, left: 10, right: 10}
export const LANG_DROPDOWN_HITSLOP = {top: 10, bottom: 10, left: 4, right: 4}
export const BACK_HITSLOP = HITSLOP_30
export const MAX_POST_LINES = 25

export const BSKY_APP_ACCOUNT_DID = 'did:plc:z72i7hdynmk6r22z27h6tvur'

export const BSKY_FEED_OWNER_DIDS = [
  BSKY_APP_ACCOUNT_DID,
  'did:plc:vpkhqolt662uhesyj6nxm7ys',
  'did:plc:q6gjnaw2blty4crticxkmujt',
]

// Disabled external feeds for local development
// export const DISCOVER_FEED_URI =
//   'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot'
// export const VIDEO_FEED_URI =
//   'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/thevids'
// export const STAGING_VIDEO_FEED_URI =
//   'at://did:plc:yofh3kx63drvfljkibw5zuxo/app.bsky.feed.generator/thevids'
// export const VIDEO_FEED_URIS = [VIDEO_FEED_URI, STAGING_VIDEO_FEED_URI]

// Provide empty array for local development to avoid undefined errors
export const VIDEO_FEED_URIS: string[] = []

// Use only local timeline feed for now
export const TIMELINE_SAVED_FEED = {
  type: 'timeline',
  value: 'following',
  pinned: true,
}

// Disable external feeds for local development
// export const DISCOVER_SAVED_FEED = {
//   type: 'feed',
//   value: DISCOVER_FEED_URI,
//   pinned: true,
// }
// export const VIDEO_SAVED_FEED = {
//   type: 'feed',
//   value: VIDEO_FEED_URI,
//   pinned: true,
// }

export const RECOMMENDED_SAVED_FEEDS: Pick<
  AppBskyActorDefs.SavedFeed,
  'type' | 'value' | 'pinned'
>[] = [TIMELINE_SAVED_FEED] // Only use timeline feed for local development

export const KNOWN_SHUTDOWN_FEEDS = [
  'at://did:plc:wqowuobffl66jv3kpsvo7ak4/app.bsky.feed.generator/the-algorithm', // for you by skygaze
]

export const GIF_SERVICE = Platform.OS === 'android' ? 'http://10.0.2.2:2584' : 'http://localhost:2584'

export const GIF_SEARCH = (params: string) =>
  `${GIF_SERVICE}/api/gifs/search?${params}`
export const GIF_FEATURED = (params: string) =>
  `${GIF_SERVICE}/api/gifs/featured?${params}`

export const MAX_LABELERS = 20

export const VIDEO_SERVICE = Platform.OS === 'android' ? 'http://10.0.2.2:2584' : 'http://localhost:2584'
export const VIDEO_SERVICE_DID = 'did:web:localhost:2584'
//export const VIDEO_SERVICE = 'https://video.bsky.app'
//export const VIDEO_SERVICE_DID = 'did:web:video.bsky.app'


export const VIDEO_MAX_DURATION_MS = 3 * 60 * 1000 // 3 minutes in milliseconds
export const VIDEO_MAX_SIZE = 1000 * 1000 * 100 // 100mb

export const SUPPORTED_MIME_TYPES = [
  'video/mp4',
  'video/mpeg',
  'video/webm',
  'video/quicktime',
  'image/gif',
] as const

export type SupportedMimeTypes = (typeof SUPPORTED_MIME_TYPES)[number]

export const EMOJI_REACTION_LIMIT = 5

export const urls = {
  website: {
    blog: {
      initialVerificationAnnouncement: `https://bsky.social/about/blog/04-21-2025-verification`,
    },
  },
}

export const PUBLIC_APPVIEW_DID = 'did:web:api.bsky.app'
export const PUBLIC_STAGING_APPVIEW_DID = 'did:web:api.staging.bsky.dev'
