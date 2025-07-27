import {BskyAgent} from '@atproto/api'
import {useAgent} from '#/state/session'

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
}

export interface SourcesListParams {
  limit?: number
  cursor?: string
  badgeType?: string
  rank?: string
  search?: string
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

export interface CreateSourceResponse {
  source: Source
}

export interface VoteSourceParams {
  sourceId: string
  vote: 'up' | 'down'
}

export interface VoteSourceResponse {
  source: Source
}

// Mock data for development - replace with actual API calls when backend is ready
const MOCK_SOURCES: Source[] = [
  {
    id: '1',
    name: 'Havana Syndrome Research Paper - NIH',
    url: 'https://www.nih.gov/news-events/news-releases/nih-study-havana-syndrome',
    badgeType: 'havana',
    upvotes: 45,
    downvotes: 3,
    rank: 'vetted',
    createdAt: '2024-01-15T10:30:00Z',
  },
  {
    id: '2',
    name: 'FBI FOIA Document - Gangstalking Investigation',
    url: 'https://vault.fbi.gov/gangstalking',
    badgeType: 'gangstalked',
    upvotes: 23,
    downvotes: 8,
    rank: 'slightly_vetted',
    createdAt: '2024-01-14T15:45:00Z',
  },
  {
    id: '3',
    name: 'NSA Whistleblower Report - Mass Surveillance',
    url: 'https://www.theguardian.com/world/2013/jun/06/nsa-phone-records-verizon-court-order',
    badgeType: 'whistleblower',
    upvotes: 156,
    downvotes: 12,
    rank: 'trusted',
    createdAt: '2024-01-13T09:20:00Z',
  },
  {
    id: '4',
    name: 'Congressional Hearing on Directed Energy Weapons',
    url: 'https://www.congress.gov/hearing/directed-energy-weapons',
    badgeType: 'targeted',
    upvotes: 67,
    downvotes: 5,
    rank: 'vetted',
    createdAt: '2024-01-12T14:10:00Z',
  },
  {
    id: '5',
    name: 'Retaliation Against Federal Employees - OIG Report',
    url: 'https://www.oig.gov/reports/retaliation-federal-employees',
    badgeType: 'retaliation',
    upvotes: 34,
    downvotes: 7,
    rank: 'slightly_vetted',
    createdAt: '2024-01-11T11:55:00Z',
  },
  {
    id: '6',
    name: 'Unverified Social Media Post',
    url: 'https://twitter.com/user/status/123456',
    upvotes: 2,
    downvotes: 15,
    rank: 'debunked',
    createdAt: '2024-01-10T16:30:00Z',
  },
]

export class SourcesAPI {
  constructor(private agent: BskyAgent) {}

  async list(params: SourcesListParams = {}): Promise<SourcesListResponse> {
    // TODO: Replace with actual API call when backend is ready
    // return this.agent.api.app.npwa.sources.list(params)
    
    // Mock implementation for development
    let filteredSources = [...MOCK_SOURCES]
    
    // Apply filters
    if (params.badgeType) {
      filteredSources = filteredSources.filter(s => s.badgeType === params.badgeType)
    }
    
    if (params.rank) {
      filteredSources = filteredSources.filter(s => s.rank === params.rank)
    }
    
    if (params.search) {
      const searchLower = params.search.toLowerCase()
      filteredSources = filteredSources.filter(s => 
        s.name.toLowerCase().includes(searchLower) ||
        (s.url && s.url.toLowerCase().includes(searchLower))
      )
    }
    
    // Sort by rank priority then by votes
    const rankOrder = ['trusted', 'vetted', 'slightly_vetted', 'debated', 'new', 'debunked']
    filteredSources.sort((a, b) => {
      const rankDiff = rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank)
      if (rankDiff !== 0) return rankDiff
      return b.upvotes - a.upvotes
    })
    
    // Apply pagination
    const limit = params.limit || 50
    const startIndex = params.cursor ? parseInt(params.cursor, 10) : 0
    const endIndex = startIndex + limit
    const paginatedSources = filteredSources.slice(startIndex, endIndex)
    
    return {
      sources: paginatedSources,
      cursor: endIndex < filteredSources.length ? endIndex.toString() : undefined,
    }
  }

  async create(params: CreateSourceParams): Promise<CreateSourceResponse> {
    // TODO: Replace with actual API call when backend is ready
    // return this.agent.api.app.npwa.sources.create(params)
    
    // Mock implementation for development
    const newSource: Source = {
      id: Date.now().toString(),
      name: params.name,
      url: params.url,
      documentId: params.documentId,
      badgeType: params.badgeType as any,
      upvotes: 0,
      downvotes: 0,
      rank: 'new',
      createdAt: new Date().toISOString(),
    }
    
    MOCK_SOURCES.unshift(newSource)
    
    return {
      source: newSource,
    }
  }

  async vote(params: VoteSourceParams): Promise<VoteSourceResponse> {
    // TODO: Replace with actual API call when backend is ready
    // return this.agent.api.app.npwa.sources.vote(params)
    
    // Mock implementation for development
    const sourceIndex = MOCK_SOURCES.findIndex(s => s.id === params.sourceId)
    if (sourceIndex === -1) {
      throw new Error('Source not found')
    }
    
    const source = MOCK_SOURCES[sourceIndex]
    if (params.vote === 'up') {
      source.upvotes += 1
    } else {
      source.downvotes += 1
    }
    
    // Recalculate rank based on vote ratio
    const totalVotes = source.upvotes + source.downvotes
    if (totalVotes >= 5) {
      const ratio = source.upvotes / totalVotes
      if (ratio >= 0.9) {
        source.rank = 'trusted'
      } else if (ratio >= 0.8) {
        source.rank = 'vetted'
      } else if (ratio >= 0.6) {
        source.rank = 'slightly_vetted'
      } else if (ratio >= 0.4) {
        source.rank = 'debated'
      } else {
        source.rank = 'debunked'
      }
    }
    
    return {
      source,
    }
  }
}

// Hook to get sources API instance
export function useSourcesAPI() {
  const agent = useAgent()
  return new SourcesAPI(agent)
} 