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
  baseURL: process.env.MATTERMOST_URL || "https://your-mattermost-instance.com",
  botToken: process.env.MATTERMOST_BOT_TOKEN,
  teamId: process.env.MATTERMOST_TEAM_ID,
  newsChannelName: process.env.MATTERMOST_NEWS_CHANNEL || "news",
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
        const authorInfo = await this.getUserInfo(post.user_id)

        newsPosts.push({
          id: post.id,
          message: post.message,
          createAt: post.create_at,
          updateAt: post.update_at,
          channelId: post.channel_id,
          userId: post.user_id,
          author: {
            id: authorInfo.id,
            username: authorInfo.username,
            firstName: authorInfo.first_name || "",
            lastName: authorInfo.last_name || "",
            nickname: authorInfo.nickname || "",
            email: authorInfo.email || "",
          },
          props: post.props || {},
          fileIds: post.file_ids || [],
          isPinned: post.is_pinned || false,
          hasReactions: post.has_reactions || false,
          replyCount: post.reply_count || 0,
        })
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

  async getUserInfo(userId) {
    try {
      const response = await this.client.get(`/users/${userId}`)
      return response.data
    } catch (error) {
      console.error(
        `Error fetching user info for ${userId}:`,
        error.response?.data || error.message
      )
      return {
        id: userId,
        username: "unknown_user",
        first_name: "Unknown",
        last_name: "User",
        nickname: "",
      }
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
        const postUrl = `${MATTERMOST_CONFIG.baseURL}/${MATTERMOST_CONFIG.teamId}/pl/${post.id}`
        const authorName = this.getAuthorDisplayName(post.author)

        feed.item({
          title: this.extractTitle(post.message, post.author),
          description: this.formatDescription(
            post.message,
            post.props,
            post.author,
            post
          ),
          url: postUrl,
          guid: post.id,
          categories: this.extractCategories(post.props, post),
          author: `${post.author.username}@mattermost.com (${authorName})`,
          enclosure: this.getEnclosure(post.fileIds),
          date: new Date(post.createAt),
          custom_elements: [
            { "mattermost:post_id": post.id },
            { "mattermost:channel_id": post.channelId },
            { "mattermost:author_id": post.userId },
            { "mattermost:author_username": post.author.username },
            { "mattermost:is_pinned": post.isPinned },
            { "mattermost:has_reactions": post.hasReactions },
            { "mattermost:reply_count": post.replyCount },
            { "mattermost:updated_at": new Date(post.updateAt).toISOString() },
          ],
        })
      })

      return feed.xml({ indent: true })
    } catch (error) {
      console.error("Error generating RSS feed:", error)
      throw new Error("Failed to generate RSS feed")
    }
  }

  getAuthorDisplayName(author) {
    if (author.nickname) {
      return author.nickname
    }
    if (author.firstName || author.lastName) {
      return `${author.firstName} ${author.lastName}`.trim()
    }
    return author.username
  }

  extractTitle(message, author) {
    // Extract first line or first 60 characters as title, include author
    const firstLine = message.split("\n")[0]
    const authorName = this.getAuthorDisplayName(author)

    let title
    if (firstLine.length > 50) {
      title = firstLine.substring(0, 50) + "..."
    } else {
      title = firstLine || "News Post"
    }

    return `${authorName}: ${title}`
  }

  formatDescription(message, props, author, post) {
    const authorName = this.getAuthorDisplayName(author)
    let description = `<strong>${authorName}</strong> posted:<br><br>`

    // Add post indicators
    const indicators = []
    if (post.isPinned) indicators.push("📌 Pinned")
    if (post.hasReactions) indicators.push("👍 Has reactions")
    if (post.replyCount > 0) indicators.push(`💬 ${post.replyCount} replies`)

    if (indicators.length > 0) {
      description += `<small><em>${indicators.join(" • ")}</em></small><br><br>`
    }

    // Convert markdown-style formatting to HTML
    let formattedMessage = message
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>")

    description += formattedMessage

    // Add any additional props information
    if (props && Object.keys(props).length > 0) {
      const relevantProps = { ...props }
      // Remove common internal props to keep description clean
      delete relevantProps.mentions
      delete relevantProps.channel_mentions

      if (Object.keys(relevantProps).length > 0) {
        description +=
          "<hr><small>Additional data: " +
          JSON.stringify(relevantProps) +
          "</small>"
      }
    }

    return description
  }

  extractCategories(props, post) {
    const categories = ["mattermost", "news"]

    if (post.isPinned) categories.push("pinned")
    if (post.hasReactions) categories.push("popular")
    if (post.replyCount > 0) categories.push("discussion")

    if (props) {
      // Extract categories from props if they exist
      if (props.tags) {
        categories.push(...props.tags.split(",").map((tag) => tag.trim()))
      }
      if (props.category) {
        categories.push(props.category)
      }
      if (props.type) {
        categories.push(props.type)
      }
    }

    return categories
  }

  getEnclosure(fileIds) {
    // If there are file attachments, we could potentially create enclosures
    // This would require additional API calls to get file info
    if (fileIds && fileIds.length > 0) {
      // Return null for now, but this could be extended to handle file attachments
      return null
    }
    return null
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
      "GET /posts": "Get raw news posts as JSON",
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
    const [userInfo, channelInfo] = await Promise.all([
      mattermostClient.getBotInfo(),
      mattermostClient.getChannelInfo(),
    ])

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      mattermost: "connected",
      user: userInfo.username,
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
