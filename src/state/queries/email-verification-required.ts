import {useQuery} from '@tanstack/react-query'

interface ServiceConfig {
  checkEmailConfirmed: boolean
}

export function useServiceConfigQuery() {
  return useQuery({
    queryKey: ['service-config'],
    queryFn: async () => {
      // For local development, disable email confirmation requirement
      if (window.location.hostname === 'localhost') {
        return {
          checkEmailConfirmed: false,
        }
      }

      const res = await fetch(
        'https://api.bsky.app/xrpc/app.bsky.unspecced.getConfig',
      )
      if (!res.ok) {
        return {
          checkEmailConfirmed: false,
        }
      }

      const json = await res.json()
      return json as ServiceConfig
    },
    staleTime: 5 * 60 * 1000,
  })
}
