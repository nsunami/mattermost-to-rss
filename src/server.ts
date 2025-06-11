import express, { Request, Response, NextFunction } from "express"
import axios, { AxiosInstance, AxiosResponse } from "axios"
import RSS from "rss"
import cors from "cors"
import dotenv from "dotenv"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Types
interface MattermostConfig {
  baseURL: string
  botToken: string
  teamId: string
  teamName: string
  newsChannelName: string
  newsChannelId?: string
}

interface MattermostPost {
  id: string
  message: string
  create_at: number
  update_at: number
  channel_id: string
  file_ids?: string[]
  type: string
  reply_count?: number
  props?: Record<string, any>
}

interface MattermostPostsResponse {
  order: string[]
  posts: Record<string, MattermostPost>
}

interface NewsPost {
  id: string
  message: string
  createAt: number
  updateAt: number
  channelId: string
  fileIds: string[]
  type: string
  replyCount: number
}

interface ChannelInfo {
  id: string
  display_name: string
  purpose: string
  header: string
  name: string
}

interface UserInfo {
  id: string
  username: string
  first_name: string
  last_name: string
  email?: string
}

interface HealthResponse {
  status: "healthy" | "unhealthy"
  timestamp: string
  mattermost?: string
  newsChannel?: string
  error?: string
}

interface ApiResponse {
  name: string
  version: string
  description: string
  endpoints: Record<string, string>
}

interface ErrorResponse {
  error: string
  message: string
}

// Configuration
const MATTERMOST_CONFIG: MattermostConfig = {
  baseURL: process.env.MATTERMOST_URL || "",
  botToken: process.env.MATTERMOST_BOT_TOKEN || "",
  teamId: process.env.MATTERMOST_TEAM_ID || "",
  teamName: process.env.MATTERMOST_TEAM_NAME || "",
  newsChannelName: process.env.MATTERMOST_NEWS_CHANNEL || "",
  newsChannelId: process.env.MATTERMOST_NEWS_CHANNEL_ID,
}

// Mattermost API client
class MattermostClient {
  private config: MattermostConfig
  private client: AxiosInstance

  constructor(config: MattermostConfig) {
    this.config = config
    this.client = axios.create({
      baseURL: `${config.baseURL}/api/v4`,
      headers: {
        Authorization: `Bearer ${config.botToken}`,
        "Content-Type": "application/json",
      },
    })
  }

  async getNewsChannelId(): Promise<string> {
    if (this.config.newsChannelId) {
      return this.config.newsChannelId
    }

    try {
      // Get channel by name if ID not provided
      const response: AxiosResponse<ChannelInfo> = await this.client.get(
        `/teams/${this.config.teamId}/channels/name/${this.config.newsChannelName}`
      )
      return response.data.id
    } catch (error: any) {
      console.error(
        "Error fetching news channel:",
        error.response?.data || error.message
      )
      throw new Error(
        `Failed to find news channel: ${this.config.newsChannelName}`
      )
    }
  }

  async getNewsPosts(limit: number = 50): Promise<NewsPost[]> {
    try {
      const channelId = await this.getNewsChannelId()

      // Get posts from the news channel
      const response: AxiosResponse<MattermostPostsResponse> =
        await this.client.get(`/channels/${channelId}/posts`, {
          params: {
            per_page: limit,
            page: 0,
          },
        })

      const posts = response.data
      const newsPosts: NewsPost[] = []

      // Process all posts from the channel
      for (const postId of posts.order) {
        const post = posts.posts[postId]

        // Get user info for the post author
        if (post.type === "") {
          newsPosts.push({
            id: post.id,
            message: post.message,
            createAt: post.create_at,
            updateAt: post.update_at,
            channelId: post.channel_id,
            fileIds: post.file_ids || [],
            type: post.type || "",
            replyCount: post.reply_count || 0,
          })
        }
      }

      return newsPosts.sort((a, b) => b.createAt - a.createAt)
    } catch (error: any) {
      console.error(
        "Error fetching news posts:",
        error.response?.data || error.message
      )
      throw new Error("Failed to fetch news posts from Mattermost")
    }
  }

  async getChannelInfo(): Promise<ChannelInfo> {
    try {
      const channelId = await this.getNewsChannelId()
      const response: AxiosResponse<ChannelInfo> = await this.client.get(
        `/channels/${channelId}`
      )
      return response.data
    } catch (error: any) {
      console.error(
        "Error fetching channel info:",
        error.response?.data || error.message
      )
      return {
        id: "",
        display_name: "News Channel",
        purpose: "News and updates feed",
        header: "",
        name: "news",
      }
    }
  }

  async getBotInfo(): Promise<UserInfo> {
    try {
      // Get current user info (the token owner)
      const response: AxiosResponse<UserInfo> = await this.client.get(
        "/users/me"
      )
      return response.data
    } catch (error: any) {
      console.error(
        "Error fetching user info:",
        error.response?.data || error.message
      )
      return {
        id: "",
        username: "api-user",
        first_name: "Mattermost",
        last_name: "API",
      }
    }
  }
}

// RSS Feed Generator
class RSSFeedGenerator {
  private mattermostClient: MattermostClient

  constructor(mattermostClient: MattermostClient) {
    this.mattermostClient = mattermostClient
  }

  async generateFeed(): Promise<string> {
    try {
      const [newsPosts, channelInfo, apiUserInfo] = await Promise.all([
        this.mattermostClient.getNewsPosts(50),
        this.mattermostClient.getChannelInfo(),
        this.mattermostClient.getBotInfo(),
      ])

      const feed = new RSS({
        title: `${MATTERMOST_CONFIG.teamName} - News Feed`,
        description:
          channelInfo.purpose ||
          `Latest posts from ${channelInfo.display_name}`,
        feed_url: `${process.env.BASE_URL || "http://localhost:3000"}/rss`,
        site_url: MATTERMOST_CONFIG.baseURL,
        image_url: `${MATTERMOST_CONFIG.baseURL}/api/v4/brand/image`,
        managingEditor: `${apiUserInfo.email || "noreply@mattermost.com"} (${
          apiUserInfo.first_name
        } ${apiUserInfo.last_name})`,
        webMaster: `${apiUserInfo.email || "noreply@mattermost.com"} (${
          apiUserInfo.first_name
        } ${apiUserInfo.last_name})`,
        copyright: `Copyright ${new Date().getFullYear()}`,
        language: "en",
        categories: ["Mattermost", "News", "Updates"],
        pubDate: new Date(),
        ttl: 60,
      })

      // Add news posts as RSS items
      newsPosts.forEach((post: NewsPost) => {
        const postUrl = `${MATTERMOST_CONFIG.baseURL}/${MATTERMOST_CONFIG.teamName}/pl/${post.id}`

        feed.item({
          title: this.extractTitle(post.message),
          description: this.formatDescription(post.message),
          url: postUrl,
          guid: post.id,
          date: new Date(post.createAt),
        })
      })

      return feed.xml({ indent: true })
    } catch (error: any) {
      console.error("Error generating RSS feed:", error)
      throw new Error("Failed to generate RSS feed")
    }
  }

  private extractTitle(message: string, maxLength: number = 120): string {
    const firstLine = message.split("\n")[0]

    if (firstLine.length > maxLength) {
      return firstLine.substring(0, maxLength) + "..."
    }
    return firstLine || "News Post"
  }

  private formatDescription(message: string): string {
    // Convert markdown-style formatting to HTML
    return message
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>")
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
  }
}

// Initialize clients
const mattermostClient = new MattermostClient(MATTERMOST_CONFIG)
const rssGenerator = new RSSFeedGenerator(mattermostClient)

// Routes
app.get("/", (req: Request, res: Response<ApiResponse>) => {
  res.json({
    name: "Mattermost RSS API",
    version: "1.0.0",
    description: "Converts posts from Mattermost news channel to RSS feed",
    endpoints: {
      "GET /rss": "Get RSS feed of news channel posts",
      "GET /rss.xml": "Get RSS feed of news posts (alternative endpoint)",
      "GET /health": "Health check endpoint",
    },
  })
})

app.get("/rss", async (req: Request, res: Response) => {
  try {
    const rssXml = await rssGenerator.generateFeed()
    res.set("Content-Type", "application/rss+xml")
    res.send(rssXml)
  } catch (error: any) {
    console.error("RSS endpoint error:", error)
    res
      .status(500)
      .json({ error: "Failed to generate RSS feed", message: error.message })
  }
})

app.get("/rss.xml", async (req: Request, res: Response) => {
  // Alternative endpoint for RSS feed
  try {
    const rssXml = await rssGenerator.generateFeed()
    res.set("Content-Type", "application/rss+xml")
    res.send(rssXml)
  } catch (error: any) {
    console.error("RSS.xml endpoint error:", error)
    res
      .status(500)
      .json({ error: "Failed to generate RSS feed", message: error.message })
  }
})

app.get("/health", async (req: Request, res: Response<HealthResponse>) => {
  try {
    // Test Mattermost connection and news channel access
    const [botInfo, channelInfo] = await Promise.all([
      mattermostClient.getBotInfo(),
      mattermostClient.getChannelInfo(),
    ])

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      mattermost: "connected",
      newsChannel: channelInfo.display_name,
    })
  } catch (error: any) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
    })
  }
})

// Error handling middleware
app.use(
  (
    err: Error,
    req: Request,
    res: Response<ErrorResponse>,
    next: NextFunction
  ) => {
    console.error("Unhandled error:", err)
    res
      .status(500)
      .json({ error: "Internal server error", message: err.message })
  }
)

// Start server
app.listen(PORT, () => {
  console.log(`Mattermost RSS API server running on port ${PORT}`)
  console.log(`RSS Feed available at: http://localhost:${PORT}/rss`)
  console.log(`Health check at: http://localhost:${PORT}/health`)
  console.log(
    `📰 Monitoring "${MATTERMOST_CONFIG.newsChannelName}" channel for news posts...`
  )

  // Validate configuration
  const requiredEnvVars = ["MATTERMOST_BOT_TOKEN", "MATTERMOST_TEAM_ID"]
  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar])

  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(", ")}`)
    console.warn("Please check your .env file configuration")
  }

  if (!MATTERMOST_CONFIG.newsChannelId && !MATTERMOST_CONFIG.newsChannelName) {
    console.warn("⚠️  No news channel specified. ")
  }
})

export default app
