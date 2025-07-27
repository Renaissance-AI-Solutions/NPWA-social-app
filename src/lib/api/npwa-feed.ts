import {BskyAgent} from '@atproto/api'
import {useAgent} from '#/state/session'
import {LOCAL_DEV_SERVICE} from '#/lib/constants'

export interface NPWAPost {
  uri: string
  cid: string
  author: {
    did: string
    handle: string
    displayName?: string
    avatar?: string
  }
  record: {
    text: string
    createdAt: string
    sourceIds?: string[]
  }
  embed?: any
  replyCount: number
  repostCount: number
  likeCount: number
  indexedAt: string
  viewer?: {
    like?: string
    repost?: string
  }
  labels?: any[]
}

export interface NPWAFeedResponse {
  feed: Array<{
    post: NPWAPost
  }>
  cursor?: string
}

// Configuration for NPWA services
const getServiceConfig = () => {
  // Use environment variables if available, otherwise fall back to AT Protocol dev environment
  const pdsUrl = process.env.EXPO_PUBLIC_API_URL || LOCAL_DEV_SERVICE // http://localhost:2583
  const appViewUrl = process.env.EXPO_PUBLIC_APP_VIEW_URL || 'http://localhost:2584'

  return {
    pdsUrl,
    appViewUrl,
    useLocalServices: process.env.EXPO_PUBLIC_USE_LOCAL_SERVICES === 'true' || process.env.NODE_ENV === 'development'
  }
}

// Mock NPWA posts for development - replace with actual API calls when backend is ready
const MOCK_NPWA_POSTS: NPWAPost[] = [
  {
    uri: 'at://did:plc:npwa1/app.bsky.feed.post/3l4k2j3h4g5f',
    cid: 'bafyreih5ac7at3gskcjxe4s2vqjy2wlzpqvvwg4jvpzgxzjp3k2l3m4n5o',
    author: {
      did: 'did:plc:npwa1',
      handle: 'npwa.admin',
      displayName: 'NPWA Admin',
      avatar: 'https://example.com/avatar1.jpg',
    },
    record: {
      text: 'Welcome to the Neuropsychological Warfare Platform! This platform is designed to help victims of psychological operations document their experiences and connect with others. #NPWA #TI #Gangstalking',
      createdAt: '2024-01-15T10:30:00Z',
      sourceIds: ['1', '3'], // References to our sources
    },
    replyCount: 12,
    repostCount: 8,
    likeCount: 45,
    indexedAt: '2024-01-15T10:30:00Z',
    viewer: {},
    labels: [],
  },
  {
    uri: 'at://did:plc:victim123/app.bsky.feed.post/3l4k2j3h4g5g',
    cid: 'bafyreih5ac7at3gskcjxe4s2vqjy2wlzpqvvwg4jvpzgxzjp3k2l3m4n5p',
    author: {
      did: 'did:plc:victim123',
      handle: 'havana.survivor',
      displayName: 'Havana Survivor',
      avatar: 'https://example.com/avatar2.jpg',
    },
    record: {
      text: 'Experiencing severe symptoms again today. Documented in my journal with precise timestamps and location data. The pattern is becoming clearer. [1] [2]',
      createdAt: '2024-01-14T15:45:00Z',
      sourceIds: ['1', '4'], // References to our sources
    },
    replyCount: 5,
    repostCount: 12,
    likeCount: 23,
    indexedAt: '2024-01-14T15:45:00Z',
    viewer: {},
    labels: [],
  },
  {
    uri: 'at://did:plc:researcher456/app.bsky.feed.post/3l4k2j3h4g5h',
    cid: 'bafyreih5ac7at3gskcjxe4s2vqjy2wlzpqvvwg4jvpzgxzjp3k2l3m4n5q',
    author: {
      did: 'did:plc:researcher456',
      handle: 'dr.research',
      displayName: 'Dr. Research',
      avatar: 'https://example.com/avatar3.jpg',
    },
    record: {
      text: 'New research paper published on directed energy weapons and their biological effects. This is crucial evidence for the TI community. Link to peer-reviewed study: [1]',
      createdAt: '2024-01-13T09:20:00Z',
      sourceIds: ['4'], // References to our sources
    },
    replyCount: 18,
    repostCount: 34,
    likeCount: 67,
    indexedAt: '2024-01-13T09:20:00Z',
    viewer: {},
    labels: [],
  },
  {
    uri: 'at://did:plc:whistleblower789/app.bsky.feed.post/3l4k2j3h4g5i',
    cid: 'bafyreih5ac7at3gskcjxe4s2vqjy2wlzpqvvwg4jvpzgxzjp3k2l3m4n5r',
    author: {
      did: 'did:plc:whistleblower789',
      handle: 'fed.whistleblower',
      displayName: 'Federal Whistleblower',
      avatar: 'https://example.com/avatar4.jpg',
    },
    record: {
      text: 'BREAKING: New FOIA documents reveal extent of surveillance programs targeting civilians. This confirms what many TIs have been reporting for years. [1] [2] [3]',
      createdAt: '2024-01-12T14:10:00Z',
      sourceIds: ['2', '3', '5'], // References to our sources
    },
    replyCount: 42,
    repostCount: 89,
    likeCount: 156,
    indexedAt: '2024-01-12T14:10:00Z',
    viewer: {},
    labels: [],
  },
  {
    uri: 'at://did:plc:activist101/app.bsky.feed.post/3l4k2j3h4g5j',
    cid: 'bafyreih5ac7at3gskcjxe4s2vqjy2wlzpqvvwg4jvpzgxzjp3k2l3m4n5s',
    author: {
      did: 'did:plc:activist101',
      handle: 'ti.activist',
      displayName: 'TI Activist',
      avatar: 'https://example.com/avatar5.jpg',
    },
    record: {
      text: 'Community meeting this weekend to discuss legal strategies and mutual support. We are stronger together. Location details in DMs for verified members only.',
      createdAt: '2024-01-11T11:55:00Z',
    },
    replyCount: 8,
    repostCount: 15,
    likeCount: 34,
    indexedAt: '2024-01-11T11:55:00Z',
    viewer: {},
    labels: [],
  },
]

export class NPWAFeedAPI {
  private config = getServiceConfig()

  constructor(private agent: BskyAgent) {}

  async getFeed(params: {
    limit?: number
    cursor?: string
  } = {}): Promise<NPWAFeedResponse> {
    // If using local services, use mock data for now
    if (this.config.useLocalServices) {
      console.log('Using local NPWA services:', this.config)
      return this.getMockFeed(params)
    }

    // TODO: Replace with actual API call when backend is ready
    // return this.agent.api.app.npwa.feed.getFeed(params)
    
    return this.getMockFeed(params)
  }

  async getFollowingFeed(params: {
    limit?: number
    cursor?: string
  } = {}): Promise<NPWAFeedResponse> {
    // If using local services, use mock data for now
    if (this.config.useLocalServices) {
      console.log('Using local NPWA services for following feed:', this.config)
      return this.getMockFollowingFeed(params)
    }

    // TODO: Replace with actual API call when backend is ready
    // return this.agent.api.app.npwa.feed.getFollowingFeed(params)
    
    return this.getMockFollowingFeed(params)
  }

  async getJournalFeed(params: {
    limit?: number
    cursor?: string
    authorDid?: string
  } = {}): Promise<NPWAFeedResponse> {
    // If using local services, use mock data for now
    if (this.config.useLocalServices) {
      console.log('Using local NPWA services for journal feed:', this.config)
      return this.getMockJournalFeed(params)
    }

    // TODO: Replace with actual API call when backend is ready
    // return this.agent.api.app.npwa.journal.list(params)
    
    return this.getMockJournalFeed(params)
  }

  private getMockFeed(params: {
    limit?: number
    cursor?: string
  }): NPWAFeedResponse {
    const limit = params.limit || 50
    const startIndex = params.cursor ? parseInt(params.cursor, 10) : 0
    const endIndex = startIndex + limit
    const paginatedPosts = MOCK_NPWA_POSTS.slice(startIndex, endIndex)
    
    return {
      feed: paginatedPosts.map(post => ({ post })),
      cursor: endIndex < MOCK_NPWA_POSTS.length ? endIndex.toString() : undefined,
    }
  }

  private getMockFollowingFeed(params: {
    limit?: number
    cursor?: string
  }): NPWAFeedResponse {
    const limit = params.limit || 50
    const startIndex = params.cursor ? parseInt(params.cursor, 10) : 0
    const endIndex = startIndex + limit
    
    // Filter to show posts from "followed" users (mock logic)
    const followingPosts = MOCK_NPWA_POSTS.filter(post => 
      ['npwa.admin', 'havana.survivor', 'dr.research'].includes(post.author.handle)
    )
    
    const paginatedPosts = followingPosts.slice(startIndex, endIndex)
    
    return {
      feed: paginatedPosts.map(post => ({ post })),
      cursor: endIndex < followingPosts.length ? endIndex.toString() : undefined,
    }
  }

  private getMockJournalFeed(params: {
    limit?: number
    cursor?: string
    authorDid?: string
  }): NPWAFeedResponse {
    // Mock implementation - filter for journal-style posts
    let journalPosts = MOCK_NPWA_POSTS.filter(post => 
      post.record.text.includes('journal') || 
      post.record.text.includes('symptoms') ||
      post.record.text.includes('documented')
    )
    
    // Filter by author if specified
    if (params.authorDid) {
      journalPosts = journalPosts.filter(post => post.author.did === params.authorDid)
    }
    
    const limit = params.limit || 50
    const startIndex = params.cursor ? parseInt(params.cursor, 10) : 0
    const endIndex = startIndex + limit
    const paginatedPosts = journalPosts.slice(startIndex, endIndex)
    
    return {
      feed: paginatedPosts.map(post => ({ post })),
      cursor: endIndex < journalPosts.length ? endIndex.toString() : undefined,
    }
  }
}

export function useNPWAFeedAPI() {
  const agent = useAgent()
  return new NPWAFeedAPI(agent)
} 