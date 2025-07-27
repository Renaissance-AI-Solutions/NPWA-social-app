import {logger} from '#/logger'

export function useShortenLink() {
  return async (inputUrl: string): Promise<{url: string}> => {
    // For local development, just return the original URL
    // In production, you could implement your own link shortening service
    if (window.location.hostname === 'localhost') {
      return {url: inputUrl}
    }

    const url = new URL(inputUrl)
    const res = await fetch('https://go.bsky.app/link', {
      method: 'POST',
      body: JSON.stringify({
        path: url.pathname,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      logger.error('Failed to shorten link', {safeMessage: res.status})
      return {url: inputUrl}
    }

    return res.json()
  }
}
