import {useState, useCallback} from 'react'
import {useAgent} from '#/state/session'
import {AppBskySourcesList} from '@atproto/api'

export interface Source extends AppBskySourcesList.Source {
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

// Sources API implementation using AT Protocol

export function useSourcesAPI() {
  const agent = useAgent()

  const list = useCallback(async (params: SourcesListParams): Promise<SourcesListResponse> => {
    try {
      // Comprehensive debugging to understand the agent structure
      console.log('=== SOURCES API DEBUG START ===')
      console.log('Agent type:', typeof agent)
      console.log('Agent constructor name:', agent?.constructor?.name)
      console.log('Agent service URL:', agent?.session?.did || agent?.serviceUrl || 'unknown')
      
      // Check agent.api structure (deprecated path)
      console.log('Agent.api exists:', !!agent.api)
      if (agent.api) {
        console.log('Agent.api.app exists:', !!agent.api.app)
        if (agent.api.app) {
          console.log('Agent.api.app.bsky exists:', !!agent.api.app.bsky)
          if (agent.api.app.bsky) {
            console.log('Available agent.api.app.bsky namespaces:', Object.keys(agent.api.app.bsky))
            console.log('agent.api.app.bsky.sources exists:', !!agent.api.app.bsky.sources)
          }
        }
      }
      
      // Check agent.app structure (new path)
      console.log('Agent.app exists:', !!agent.app)
      if (agent.app) {
        console.log('Agent.app.bsky exists:', !!agent.app.bsky)
        if (agent.app.bsky) {
          console.log('Available agent.app.bsky namespaces:', Object.keys(agent.app.bsky))
          console.log('agent.app.bsky.sources exists:', !!agent.app.bsky.sources)
          
          // If sources exists, log its methods
          if (agent.app.bsky.sources) {
            console.log('agent.app.bsky.sources methods:', Object.keys(agent.app.bsky.sources))
          }
        }
      }
      
      // Try both API paths to see which one works
      let sourcesAPI = null
      if (agent.app?.bsky?.sources) {
        console.log('Using agent.app.bsky.sources')
        sourcesAPI = agent.app.bsky.sources
      } else if (agent.api?.app?.bsky?.sources) {
        console.log('Using agent.api.app.bsky.sources')
        sourcesAPI = agent.api.app.bsky.sources
      } else {
        console.error('Sources API namespace not found in either location')
        console.log('=== SOURCES API DEBUG END ===')
        throw new Error('Sources API not available - namespace not found')
      }

      console.log('Calling sources.list with params:', params)
      const response = await sourcesAPI.list({
        limit: params.limit,
        cursor: params.cursor,
        badgeType: params.badgeType,
        rank: params.rank,
        search: params.search,
      })

      console.log('Sources API response received:', response)
      console.log('Response data:', response.data)
      console.log('Sources count:', response.data?.sources?.length || 0)
      console.log('=== SOURCES API DEBUG END ===')

      return {
        sources: response.data.sources,
        cursor: response.data.cursor,
      }
    } catch (error) {
      console.error('Sources API list error:', error)
      console.log('Error details:', error)
      console.log('=== SOURCES API DEBUG END ===')
      throw new Error('Failed to fetch sources')
    }
  }, [agent])

  const create = useCallback(async (params: CreateSourceParams): Promise<Source> => {
    try {
      const response = await agent.app.bsky.sources.create({
        name: params.name,
        url: params.url,
        documentId: params.documentId,
        badgeType: params.badgeType,
      })
      
      return response.data.source
    } catch (error) {
      console.error('Sources API create error:', error)
      throw new Error('Failed to create source')
    }
  }, [agent])

  const vote = useCallback(async (params: VoteParams): Promise<VoteResponse> => {
    try {
      const response = await agent.app.bsky.sources.vote({
        sourceId: params.sourceId,
        vote: params.vote,
      })
      
      return {
        source: response.data.source,
        userVote: params.vote,
      }
    } catch (error) {
      console.error('Sources API vote error:', error)
      throw new Error('Failed to vote on source')
    }
  }, [agent])

  const getById = useCallback(async (sourceId: string): Promise<Source> => {
    try {
      const response = await agent.app.bsky.sources.get({
        sourceId: sourceId,
      })
      
      return response.data.source
    } catch (error) {
      console.error('Sources API getById error:', error)
      throw new Error('Failed to fetch source')
    }
  }, [agent])

  const getComments = useCallback(async (sourceId: string): Promise<SourceComment[]> => {
    try {
      const response = await agent.app.bsky.sources.getComments({
        sourceId: sourceId,
      })
      
      return response.data.comments
    } catch (error) {
      console.error('Sources API getComments error:', error)
      throw new Error('Failed to fetch comments')
    }
  }, [agent])

  const addComment = useCallback(async (params: CommentParams): Promise<SourceComment> => {
    try {
      const response = await agent.app.bsky.sources.addComment({
        sourceId: params.sourceId,
        content: params.content,
      })
      
      return response.data.comment
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