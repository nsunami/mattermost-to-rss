// Types
export interface MattermostConfig {
  baseURL: string
  botToken: string
  teamId: string
  teamName: string
  newsChannelName: string
  newsChannelId?: string
}

export interface MattermostPost {
  id: string
  message: string
  create_at: number
  update_at: number
  channel_id: string
  file_ids?: string[]
  type: string
  reply_count?: number
  props?: Record<string, any>
  user_id: string
  metadata: PostMetadata
}

export interface PostMetadata {
  reactions: PostReaction[]
}

export interface PostReaction {
  emoji_name: string
  user_id: string
  post_id: string
  create_at: number
  update_at: number
  delete_at: number
  remote_id: string
  channel_id: string
}

export interface MattermostPostsResponse {
  order: string[]
  posts: Record<string, MattermostPost>
}

export interface NewsPost {
  id: string
  message: string
  createAt: number
  updateAt: number
  channelId: string
  fileIds: string[]
  type: string
  replyCount: number
}

export interface ChannelInfo {
  id: string
  display_name: string
  purpose: string
  header: string
  name: string
}

export interface UserInfo {
  id: string
  username: string
  first_name: string
  last_name: string
  email?: string
  roles:
    | "system_user"
    | "system_admin"
    | "channel_user"
    | "channel_admin"
    | string
}

export interface HealthResponse {
  status: "healthy" | "unhealthy"
  timestamp: string
  mattermost?: string
  newsChannel?: string
  error?: string
}

export interface ApiResponse {
  name: string
  version: string
  description: string
  endpoints: Record<string, string>
}

export interface ErrorResponse {
  error: string
  message: string
}
