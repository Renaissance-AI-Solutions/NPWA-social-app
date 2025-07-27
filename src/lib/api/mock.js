import * as data from './fake-data.json'

// Helper to simulate network delay
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetches a paginated feed timeline.
 * @param {string} [cursor] - The cursor for pagination.
 * @param {number} [limit] - The number of items to return.
 * @returns {Promise<{cursor: string|undefined, feed: Array<object>}>}
 */
export async function getFeedTimeline(cursor, limit = 30) {
  await sleep(500) // Simulate network latency

  const posts = data.posts || []
  // In a real API, the cursor would be used for pagination.
  // Here, we'll just find the index and return the next slice.
  const cursorIndex = cursor ? posts.findIndex(p => p.uri === cursor) : -1
  const startIndex = cursorIndex !== -1 ? cursorIndex + 1 : 0

  const feedSlice = posts.slice(startIndex, startIndex + limit)

  // Create a new cursor from the last item in the slice
  const newCursor =
    feedSlice.length > 0 ? feedSlice[feedSlice.length - 1].uri : undefined

  return {
    cursor: newCursor,
    feed: feedSlice,
  }
}

/**
 * Fetches a user profile.
 * @param {string} handle - The user's handle.
 * @returns {Promise<object>}
 */
export async function getProfile(handle) {
  await sleep(300)
  const user = data.users.find(u => u.handle === handle)
  if (!user) {
    // In a real app, this would be a proper API error
    throw new Error('Profile not found')
  }
  return user
}

// You can continue to add more mock API functions here as needed,
// for example: getPostThread, getNotifications, etc.