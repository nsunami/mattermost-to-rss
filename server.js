const express = require("express")
const axios = require("axios")
const RSS = require("rss")
const cors = require("cors")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Configuration
const MATTERMOST_CONFIG = {
  baseURL: process.env.MATTERMOST_URL,
  botToken: process.env.MATTERMOST_BOT_TOKEN,
  teamId: process.env.MATTERMOST_TEAM_ID,
  teamName: process.env.MATTERMOST_TEAM_NAME,
  newsChannelName: process.env.MATTERMOST_NEWS_CHANNEL,
  newsChannelId: process.env.MATTERMOST_NEWS_CHANNEL_ID,
}

// Mattermost API client
class MattermostClient {
  constructor(config) {
    this.config = config
    this.client = axios.create({
      baseURL: `${config.baseURL}/api/v4`,
      headers: {
        Authorization: `Bearer ${config.botToken}`,
        "Content-Type": "application/json",
      },
    })
  }

  async getNewsChannelId() {
    if (this.config.newsChannelId) {
      return this.config.newsChannelId
    }

    try {
      // Get channel by name if ID not provided
      const response = await this.client.get(
        `/teams/${this.config.teamId}/channels/name/${this.config.newsChannelName}`
      )
      return response.data.id
    } catch (error) {
      console.error(
        "Error fetching news channel:",
        error.response?.data || error.message
      )
      throw new Error(
        `Failed to find news channel: ${this.config.newsChannelName}`
      )
    }
  }

  async getNewsPosts(limit = 50) {
    try {
      const channelId = await this.getNewsChannelId()

      // Get posts from the news channel
      const response = await this.client.get(`/channels/${channelId}/posts`, {
        params: {
          per_page: limit,
          page: 0,
        },
      })

      const posts = response.data

      const newsPosts = []

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
    } catch (error) {
      console.error(
        "Error fetching news posts:",
        error.response?.data || error.message
      )
      throw new Error("Failed to fetch news posts from Mattermost")
    }
  }

  async getChannelInfo() {
    try {
      const channelId = await this.getNewsChannelId()
      const response = await this.client.get(`/channels/${channelId}`)
      return response.data
    } catch (error) {
      console.error(
        "Error fetching channel info:",
        error.response?.data || error.message
      )
      return { display_name: "News Channel", purpose: "News and updates feed" }
    }
  }

  async getBotInfo() {
    try {
      // Get current user info (the token owner)
      const response = await this.client.get("/users/me")
      return response.data
    } catch (error) {
      console.error(
        "Error fetching user info:",
        error.response?.data || error.message
      )
      return {
        username: "api-user",
        first_name: "Mattermost",
        last_name: "API",
      }
    }
  }
}

// RSS Feed Generator
class RSSFeedGenerator {
  constructor(mattermostClient) {
    this.mattermostClient = mattermostClient
  }

  async generateFeed() {
    try {
      const [newsPosts, channelInfo, apiUserInfo] = await Promise.all([
        this.mattermostClient.getNewsPosts(50),
        this.mattermostClient.getChannelInfo(),
        this.mattermostClient.getBotInfo(),
      ])

      const feed = new RSS({
        title: `${channelInfo.display_name} - News Feed`,
        description:
          channelInfo.purpose ||
          `Latest posts from ${channelInfo.display_name}`,
        feed_url: `${process.env.BASE_URL || "http://localhost:3000"}/rss`,
        site_url: MATTERMOST_CONFIG.baseURL,
        image_url: `${MATTERMOST_CONFIG.baseURL}/api/v4/channels/${channelInfo.id}/image`,
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
        ttl: "60",
      })

      // Add news posts as RSS items
      newsPosts.forEach((post) => {
        const postUrl = `${MATTERMOST_CONFIG.baseURL}/${MATTERMOST_CONFIG.teamName}/pl/${post.id}`

        feed.item({
          title: this.extractTitle(post.message),
          description: this.formatDescription(post.message, post.props, post),
          url: postUrl,
          guid: post.id,
          date: new Date(post.createAt),
        })
      })

      return feed.xml({ indent: true })
    } catch (error) {
      console.error("Error generating RSS feed:", error)
      throw new Error("Failed to generate RSS feed")
    }
  }

  extractTitle(message, author) {
    // Extract first line or first 60 characters as title, include author
    const firstLine = message.split("\n")[0]

    function truncateTitle(title, maxLength = 120) {
      if (title.length > maxLength) {
        return title.substring(0, maxLength) + "..."
      } else {
        return title || "News Post"
      }
    }

    return truncateTitle(firstLine)
  }

  formatDescription(message) {
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
app.get("/", (req, res) => {
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

app.get("/rss", async (req, res) => {
  try {
    const rssXml = await rssGenerator.generateFeed()
    res.set("Content-Type", "application/rss+xml")
    res.send(rssXml)
  } catch (error) {
    console.error("RSS endpoint error:", error)
    res
      .status(500)
      .json({ error: "Failed to generate RSS feed", message: error.message })
  }
})

app.get("/rss.xml", async (req, res) => {
  // Alternative endpoint for RSS feed
  try {
    const rssXml = await rssGenerator.generateFeed()
    res.set("Content-Type", "application/rss+xml")
    res.send(rssXml)
  } catch (error) {
    console.error("RSS.xml endpoint error:", error)
    res
      .status(500)
      .json({ error: "Failed to generate RSS feed", message: error.message })
  }
})

app.get("/posts", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const newsPosts = await mattermostClient.getNewsPosts(limit)
    res.json({
      posts: newsPosts,
      count: newsPosts.length,
      timestamp: new Date().toISOString(),
      channel: MATTERMOST_CONFIG.newsChannelName,
    })
  } catch (error) {
    console.error("News posts endpoint error:", error)
    res
      .status(500)
      .json({ error: "Failed to fetch news posts", message: error.message })
  }
})

app.get("/health", async (req, res) => {
  try {
    // Test Mattermost connection and news channel access
    const [channelInfo] = await Promise.all([
      mattermostClient.getBotInfo(),
      mattermostClient.getChannelInfo(),
    ])

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      mattermost: "connected",
      newsChannel: channelInfo.display_name,
    })
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
    })
  }
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err)
  res.status(500).json({ error: "Internal server error", message: err.message })
})

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
    console.warn(
      '⚠️  No news channel specified. Using default "news" channel name.'
    )
  }
})

module.exports = app
