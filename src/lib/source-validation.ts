/**
 * Source validation utilities for URL validation and metadata extraction
 */

export interface SourceMetadata {
  title?: string
  description?: string
  favicon?: string
  image?: string
  siteName?: string
}

export interface ValidationResult {
  isValid: boolean
  error?: string
  metadata?: SourceMetadata
}

/**
 * Validates a URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return ['http:', 'https:'].includes(urlObj.protocol)
  } catch {
    return false
  }
}

/**
 * Validates a source URL and extracts metadata
 */
export async function validateSource(url: string): Promise<ValidationResult> {
  // Basic URL validation
  if (!url || !url.trim()) {
    return {
      isValid: false,
      error: 'URL is required',
    }
  }

  const trimmedUrl = url.trim()

  if (!isValidUrl(trimmedUrl)) {
    return {
      isValid: false,
      error: 'Invalid URL format. Must start with http:// or https://',
    }
  }

  try {
    // Attempt to fetch metadata
    const metadata = await extractMetadata(trimmedUrl)
    
    return {
      isValid: true,
      metadata,
    }
  } catch (error) {
    // URL is valid format but may not be accessible
    return {
      isValid: true,
      error: `Warning: Could not fetch metadata - ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Extracts metadata from a URL
 * In a real implementation, this would use a service like Open Graph or similar
 */
async function extractMetadata(url: string): Promise<SourceMetadata> {
  try {
    // For now, we'll use a simple fetch to get basic info
    // In production, you'd want to use a proper metadata extraction service
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'NPWA-SourceBot/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    
    // Extract basic metadata using simple regex (in production, use a proper HTML parser)
    const metadata: SourceMetadata = {}

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) {
      metadata.title = titleMatch[1].trim()
    }

    // Extract Open Graph title
    const ogTitleMatch = html.match(/<meta[^>]*property=['"](og:title)['"][^>]*content=['"]([^'"]+)['"]/i)
    if (ogTitleMatch) {
      metadata.title = ogTitleMatch[2].trim()
    }

    // Extract description
    const descMatch = html.match(/<meta[^>]*name=['"](description)['"][^>]*content=['"]([^'"]+)['"]/i)
    if (descMatch) {
      metadata.description = descMatch[2].trim()
    }

    // Extract Open Graph description
    const ogDescMatch = html.match(/<meta[^>]*property=['"](og:description)['"][^>]*content=['"]([^'"]+)['"]/i)
    if (ogDescMatch) {
      metadata.description = ogDescMatch[2].trim()
    }

    // Extract site name
    const siteNameMatch = html.match(/<meta[^>]*property=['"](og:site_name)['"][^>]*content=['"]([^'"]+)['"]/i)
    if (siteNameMatch) {
      metadata.siteName = siteNameMatch[2].trim()
    }

    // Extract favicon
    const faviconMatch = html.match(/<link[^>]*rel=['"](icon|shortcut icon)['"][^>]*href=['"]([^'"]+)['"]/i)
    if (faviconMatch) {
      const faviconUrl = faviconMatch[2]
      // Convert relative URLs to absolute
      if (faviconUrl.startsWith('/')) {
        const urlObj = new URL(url)
        metadata.favicon = `${urlObj.protocol}//${urlObj.host}${faviconUrl}`
      } else if (!faviconUrl.startsWith('http')) {
        const urlObj = new URL(url)
        metadata.favicon = `${urlObj.protocol}//${urlObj.host}/${faviconUrl}`
      } else {
        metadata.favicon = faviconUrl
      }
    }

    // Extract Open Graph image
    const ogImageMatch = html.match(/<meta[^>]*property=['"](og:image)['"][^>]*content=['"]([^'"]+)['"]/i)
    if (ogImageMatch) {
      metadata.image = ogImageMatch[2]
    }

    return metadata
  } catch (error) {
    throw new Error(`Failed to extract metadata: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Normalizes a URL by adding protocol if missing and removing trailing slashes
 */
export function normalizeUrl(url: string): string {
  let normalized = url.trim()
  
  // Add https:// if no protocol specified
  if (!normalized.match(/^https?:\/\//)) {
    normalized = `https://${normalized}`
  }
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '')
  
  return normalized
}

/**
 * Extracts domain from URL for display purposes
 */
export function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return url
  }
}

/**
 * Checks if a URL is from a trusted domain
 */
export function isTrustedDomain(url: string): boolean {
  const trustedDomains = [
    'gov',
    'edu',
    'org',
    'reuters.com',
    'ap.org',
    'bbc.com',
    'npr.org',
    'pbs.org',
    'arxiv.org',
    'pubmed.ncbi.nlm.nih.gov',
    'scholar.google.com',
  ]

  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    
    return trustedDomains.some(domain => {
      if (domain.includes('.')) {
        return hostname === domain || hostname.endsWith(`.${domain}`)
      } else {
        return hostname.endsWith(`.${domain}`)
      }
    })
  } catch {
    return false
  }
}

/**
 * Suggests initial rank based on URL domain
 */
export function suggestInitialRank(url: string): 'new' | 'slightly_vetted' {
  if (isTrustedDomain(url)) {
    return 'slightly_vetted'
  }
  return 'new'
} 