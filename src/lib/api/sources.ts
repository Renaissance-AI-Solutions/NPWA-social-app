import {useState, useCallback} from 'react'
import {AtpAgent} from '@atproto/api'
import {useSession} from '#/state/session'

export interface Source {
  id: string
  name: string
  url?: string
  documentId?: string
  badgeType?: 'havana' | 'gangstalked' | 'targeted' | 'whistleblower' | 'retaliation'
  upvotes: number
  downvotes: number
  rank: 'new' | 'debated' | 'debunked' | 'slightly_vetted' | 'vetted' | 'trusted'
  createdAt: string
  updatedAt: string
  userVote?: 'up' | 'down' | null
}

export interface SourceComment {
  id: string
  sourceId: string
  author: {
    did: string
    handle: string
    displayName?: string
    avatar?: string
  }
  content: string
  createdAt: string
}

export interface SourcesListParams {
  search?: string
  badgeType?: string
  rank?: string
  cursor?: string
  limit?: number
}

export interface SourcesListResponse {
  sources: Source[]
  cursor?: string
}

export interface CreateSourceParams {
  name: string
  url?: string
  documentId?: string
  badgeType?: string
}

export interface VoteParams {
  sourceId: string
  vote: 'up' | 'down'
}

export interface VoteResponse {
  source: Source
  userVote: 'up' | 'down' | null
}

export interface CommentParams {
  sourceId: string
  content: string
}

// Mock data for development - replace with actual API calls when backend is ready
const generateMockSources = (count: number, offset: number = 0): Source[] => {
  const badgeTypes = ['havana', 'gangstalked', 'targeted', 'whistleblower', 'retaliation'] as const
  const ranks = ['new', 'debated', 'debunked', 'slightly_vetted', 'vetted', 'trusted'] as const
  
  return Array.from({length: count}, (_, i) => ({
    id: `source_${offset + i + 1}`,
    name: `Source ${offset + i + 1}: ${['Harvard Medical Study', 'FBI Report', 'Scientific Journal', 'Government Document', 'Research Paper'][i % 5]}`,
    url: i % 3 === 0 ? `https://example.com/source-${offset + i + 1}` : undefined,
    documentId: i % 3 === 1 ? `doc_${offset + i + 1}` : undefined,
    badgeType: i % 4 === 0 ? badgeTypes[i % badgeTypes.length] : undefined,
    upvotes: Math.floor(Math.random() * 100),
    downvotes: Math.floor(Math.random() * 20),
    rank: ranks[i % ranks.length],
    createdAt: new Date(Date.now() - (offset + i) * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - (offset + i) * 43200000).toISOString(),
    userVote: null,
  }))
}

const generateMockComments = (sourceId: string): SourceComment[] => {
  return [
    {
      id: `comment_${sourceId}_1`,
      sourceId,
      author: {
        did: 'did:plc:user1',
        handle: 'researcher.bsky.social',
        displayName: 'Dr. Research',
        avatar: undefined,
      },
      content: 'This source provides valuable insights into the documented patterns of harassment.',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: `comment_${sourceId}_2`,
      sourceId,
      author: {
        did: 'did:plc:user2',
        handle: 'analyst.bsky.social',
        displayName: 'Security Analyst',
        avatar: undefined,
      },
      content: 'The methodology appears sound, though additional verification would strengthen the claims.',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
  ]
}

export function useSourcesAPI() {
  const {agent} = useSession()
  
  const list = useCallback(async (params: SourcesListParams): Promise<SourcesListResponse> => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // const response = await agent.api.app.npwa.sources.list(params)
      
      // Mock implementation for development
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate network delay
      
      const allSources = generateMockSources(50)
      let filteredSources = allSources
      
      // Apply filters
      if (params.search) {
        filteredSources = filteredSources.filter(source =>
          source.name.toLowerCase().includes(params.search!.toLowerCase())
        )
      }
      
      if (params.badgeType) {
        filteredSources = filteredSources.filter(source =>
          source.badgeType === params.badgeType
        )
      }
      
      if (params.rank) {
        filteredSources = filteredSources.filter(source =>
          source.rank === params.rank
        )
      }
      
      // Apply pagination
      const cursorIndex = params.cursor ? parseInt(params.cursor) : 0
      const limit = params.limit || 20
      const paginatedSources = filteredSources.slice(cursorIndex, cursorIndex + limit)
      const nextCursor = cursorIndex + limit < filteredSources.length ? (cursorIndex + limit).toString() : undefined
      
      return {
        sources: paginatedSources,
        cursor: nextCursor,
      }
    } catch (error) {
      console.error('Sources API list error:', error)
      throw new Error('Failed to fetch sources')
    }
  }, [agent])

  const create = useCallback(async (params: CreateSourceParams): Promise<Source> => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // const response = await agent.api.app.npwa.sources.create(params)
      
      // Mock implementation for development
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const newSource: Source = {
        id: `source_new_${Date.now()}`,
        name: params.name,
        url: params.url,
        documentId: params.documentId,
        badgeType: params.badgeType as any,
        upvotes: 0,
        downvotes: 0,
        rank: 'new',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userVote: null,
      }
      
      return newSource
    } catch (error) {
      console.error('Sources API create error:', error)
      throw new Error('Failed to create source')
    }
  }, [agent])

  const vote = useCallback(async (params: VoteParams): Promise<VoteResponse> => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // const response = await agent.api.app.npwa.sources.vote(params)
      
      // Mock implementation for development
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Mock source update
      const mockSource: Source = {
        id: params.sourceId,
        name: 'Mock Source',
        upvotes: Math.floor(Math.random() * 100),
        downvotes: Math.floor(Math.random() * 20),
        rank: 'debated',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userVote: params.vote,
      }
      
      return {
        source: mockSource,
        userVote: params.vote,
      }
    } catch (error) {
      console.error('Sources API vote error:', error)
      throw new Error('Failed to vote on source')
    }
  }, [agent])

  const getById = useCallback(async (sourceId: string): Promise<Source> => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // const response = await agent.api.app.npwa.sources.get({sourceId})
      
      // Mock implementation for development
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const mockSource: Source = {
        id: sourceId,
        name: 'Harvard Medical School Study on Havana Syndrome',
        url: 'https://www.health.harvard.edu/blog/havana-syndrome-what-we-know-202112062663',
        badgeType: 'havana',
        upvotes: 45,
        downvotes: 2,
        rank: 'vetted',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 43200000).toISOString(),
        userVote: null,
      }
      
      return mockSource
    } catch (error) {
      console.error('Sources API getById error:', error)
      throw new Error('Failed to fetch source')
    }
  }, [agent])

  const getComments = useCallback(async (sourceId: string): Promise<SourceComment[]> => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // const response = await agent.api.app.npwa.sources.getComments({sourceId})
      
      // Mock implementation for development
      await new Promise(resolve => setTimeout(resolve, 200))
      
      return generateMockComments(sourceId)
    } catch (error) {
      console.error('Sources API getComments error:', error)
      throw new Error('Failed to fetch comments')
    }
  }, [agent])

  const addComment = useCallback(async (params: CommentParams): Promise<SourceComment> => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // const response = await agent.api.app.npwa.sources.addComment(params)
      
      // Mock implementation for development
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const newComment: SourceComment = {
        id: `comment_${params.sourceId}_${Date.now()}`,
        sourceId: params.sourceId,
        author: {
          did: 'did:plc:currentuser',
          handle: 'you.bsky.social',
          displayName: 'You',
          avatar: undefined,
        },
        content: params.content,
        createdAt: new Date().toISOString(),
      }
      
      return newComment
    } catch (error) {
      console.error('Sources API addComment error:', error)
      throw new Error('Failed to add comment')
    }
  }, [agent])

  return {
    list,
    create,
    vote,
    getById,
    getComments,
    addComment,
  }
}