import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  StyleSheet,
} from 'react-native'
import { FontAwesome } from '@expo/vector-icons'

interface Source {
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

interface Comment {
  id: string
  author: string
  content: string
  createdAt: string
}

const BADGE_COLORS = {
  havana: '#FF6B6B',
  gangstalked: '#4ECDC4',
  targeted: '#45B7D1',
  whistleblower: '#96CEB4',
  retaliation: '#FFEAA7',
}

const RANK_COLORS = {
  new: '#95A5A6',
  debated: '#F39C12',
  debunked: '#E74C3C',
  slightly_vetted: '#F1C40F',
  vetted: '#27AE60',
  trusted: '#2ECC71',
}

const RANK_LABELS = {
  new: 'New',
  debated: 'Debated',
  debunked: 'Debunked',
  slightly_vetted: 'Slightly Vetted',
  vetted: 'Vetted',
  trusted: 'Trusted',
}

interface SourceDetailProps {
  route: {
    params: {
      sourceId: string
    }
  }
}

export function SourceDetail({ route }: SourceDetailProps) {
  const { sourceId } = route.params
  const [source, setSource] = useState<Source | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    fetchSourceDetail()
  }, [sourceId])

  const fetchSourceDetail = async () => {
    try {
      setLoading(true)
      
      // Mock data - replace with actual API call
      const mockSource: Source = {
        id: sourceId,
        name: 'Harvard Medical School Study on Havana Syndrome',
        url: 'https://www.health.harvard.edu/blog/havana-syndrome-what-we-know-202112062663',
        badgeType: 'havana',
        upvotes: 45,
        downvotes: 2,
        rank: 'vetted',
        createdAt: new Date().toISOString(),
      }

      const mockComments: Comment[] = [
        {
          id: '1',
          author: 'researcher123',
          content: 'This is a comprehensive study that provides valuable insights into the neurological symptoms.',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: '2',
          author: 'medicalexpert',
          content: 'The methodology appears sound, though more research is needed for definitive conclusions.',
          createdAt: new Date(Date.now() - 172800000).toISOString(),
        },
      ]

      setSource(mockSource)
      setComments(mockComments)
    } catch (error) {
      console.error('Error fetching source detail:', error)
      Alert.alert('Error', 'Failed to load source details')
    } finally {
      setLoading(false)
    }
  }

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!source) return

    try {
      // TODO: Replace with actual API call
      // await fetch(`/xrpc/app.npwa.sources.vote`, {
      //   method: 'POST',
      //   body: JSON.stringify({ sourceId: source.id, vote: voteType })
      // })

      // Update local state
      const newUpvotes = voteType === 'up' 
        ? source.upvotes + (userVote === 'up' ? -1 : 1)
        : userVote === 'down' ? source.upvotes + 1 : source.upvotes

      const newDownvotes = voteType === 'down'
        ? source.downvotes + (userVote === 'down' ? -1 : 1)
        : userVote === 'up' ? source.downvotes + 1 : source.downvotes

      setSource({
        ...source,
        upvotes: newUpvotes,
        downvotes: newDownvotes,
      })

      setUserVote(userVote === voteType ? null : voteType)
    } catch (error) {
      console.error('Error voting:', error)
      Alert.alert('Error', 'Failed to submit vote')
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    try {
      // TODO: Replace with actual API call
      const newCommentObj: Comment = {
        id: Date.now().toString(),
        author: 'currentUser', // Replace with actual user
        content: newComment.trim(),
        createdAt: new Date().toISOString(),
      }

      setComments([newCommentObj, ...comments])
      setNewComment('')
    } catch (error) {
      console.error('Error adding comment:', error)
      Alert.alert('Error', 'Failed to add comment')
    }
  }

  const handleOpenUrl = () => {
    if (source?.url) {
      Linking.openURL(source.url).catch(() => {
        Alert.alert('Error', 'Unable to open URL')
      })
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading...</Text>
      </View>
    )
  }

  if (!source) {
    return (
      <View style={styles.centerContainer}>
        <Text>Source not found</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{source.name}</Text>
        
        <View style={styles.metaContainer}>
          <View style={[styles.rankBadge, { backgroundColor: RANK_COLORS[source.rank] }]}>
            <Text style={styles.rankText}>
              {RANK_LABELS[source.rank]}
            </Text>
          </View>
          
          {source.badgeType && (
            <View style={[styles.badge, { backgroundColor: BADGE_COLORS[source.badgeType] }]}>
              <Text style={styles.badgeText}>
                {source.badgeType.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {source.url && (
          <TouchableOpacity style={styles.urlContainer} onPress={handleOpenUrl}>
            <FontAwesome name="external-link" size={16} color="#007AFF" />
            <Text style={styles.urlText} numberOfLines={2}>
              {source.url}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.voteContainer}>
          <TouchableOpacity
            style={[
              styles.voteButton,
              userVote === 'up' && styles.voteButtonActive,
            ]}
            onPress={() => handleVote('up')}>
            <FontAwesome 
              name="thumbs-up" 
              size={20} 
              color={userVote === 'up' ? '#fff' : '#27AE60'} 
            />
            <Text style={[
              styles.voteText,
              { color: userVote === 'up' ? '#fff' : '#27AE60' }
            ]}>
              {source.upvotes}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.voteButton,
              userVote === 'down' && styles.voteButtonActive,
            ]}
            onPress={() => handleVote('down')}>
            <FontAwesome 
              name="thumbs-down" 
              size={20} 
              color={userVote === 'down' ? '#fff' : '#E74C3C'} 
            />
            <Text style={[
              styles.voteText,
              { color: userVote === 'down' ? '#fff' : '#E74C3C' }
            ]}>
              {source.downvotes}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.dateText}>
          Added on {new Date(source.createdAt).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.commentsSection}>
        <Text style={styles.sectionTitle}>Comments ({comments.length})</Text>
        
        <View style={styles.addCommentContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
            placeholderTextColor="#666"
          />
          <TouchableOpacity
            style={[
              styles.addCommentButton,
              !newComment.trim() && styles.addCommentButtonDisabled,
            ]}
            onPress={handleAddComment}
            disabled={!newComment.trim()}>
            <Text style={[
              styles.addCommentButtonText,
              !newComment.trim() && styles.addCommentButtonTextDisabled,
            ]}>
              Post
            </Text>
          </TouchableOpacity>
        </View>

        {comments.map(comment => (
          <View key={comment.id} style={styles.commentCard}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentAuthor}>{comment.author}</Text>
              <Text style={styles.commentDate}>
                {new Date(comment.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.commentContent}>{comment.content}</Text>
          </View>
        ))}

        {comments.length === 0 && (
          <Text style={styles.noCommentsText}>
            No comments yet. Be the first to share your thoughts!
          </Text>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  rankBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  rankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  urlText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 8,
    flex: 1,
  },
  voteContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  voteButtonActive: {
    backgroundColor: '#007AFF',
  },
  voteText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  commentsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  addCommentContainer: {
    marginBottom: 20,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  addCommentButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  addCommentButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addCommentButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  addCommentButtonTextDisabled: {
    color: '#666',
  },
  commentCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  commentDate: {
    fontSize: 12,
    color: '#666',
  },
  commentContent: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  noCommentsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
}) 