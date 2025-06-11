# Mattermost RSS API

A REST API that fetches messages where a Mattermost bot account is mentioned (@bot) and publishes them as an RSS feed. This allows you to monitor and track conversations where your bot is mentioned through RSS readers, monitoring tools, or other systems that consume RSS feeds.

## Features

- ✅ Fetches messages mentioning a specific Mattermost bot account
- ✅ Detects multiple mention types (@username, @here, @channel, direct mentions)
- ✅ Converts mentions to RSS 2.0 format with author information
- ✅ RESTful API endpoints
- ✅ Configurable via environment variables
- ✅ Docker support
- ✅ Health check endpoint
- ✅ CORS enabled
- ✅ Markdown to HTML conversion
- ✅ Custom RSS elements for Mattermost metadata and mention types

## Mention Detection

The API detects when your bot is mentioned in several ways:

1. **Direct Mentions**: Using Mattermost's built-in mention system
2. **Username Mentions**: Text containing `@yourbotname`
3. **Channel Mentions**: Messages with `@here`, `@channel`, or `@all`
4. **Metadata Mentions**: Bot ID found in post mention metadata

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API information and available endpoints |
| `/rss` | GET | RSS feed of messages mentioning the bot |
| `/rss.xml` | GET | RSS feed (alternative endpoint) |
| `/posts` | GET | Raw bot mentions in JSON format |
| `/health` | GET | Health check endpoint |

## Installation

### Prerequisites

- Node.js 16+ 
- A Mattermost instance with bot account configured
- Bot access token with appropriate permissions

### Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd mattermost-rss-api
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file and configure:
```bash
cp .env.example .env
```

4. Edit `.env` with your Mattermost configuration:
```bash
MATTERMOST_URL=https://your-mattermost-instance.com
MATTERMOST_BOT_TOKEN=your_bot_access_token
MATTERMOST_TEAM_ID=team_id_here
MATTERMOST_CHANNEL_ID=channel_id_here  
MATTERMOST_BOT_USER_ID=bot_user_id_here
```

5. Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Docker Deployment

1. Build the Docker image:
```bash
npm run docker:build
```

2. Run with Docker:
```bash
npm run docker:run
```

Or use docker-compose:

```yaml
version: '3.8'
services:
  mattermost-rss-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MATTERMOST_URL=https://your-mattermost-instance.com
      - MATTERMOST_BOT_TOKEN=your_bot_token
      - MATTERMOST_TEAM_ID=your_team_id
      - MATTERMOST_CHANNEL_ID=your_channel_id
      - MATTERMOST_BOT_USER_ID=your_bot_user_id
    restart: unless-stopped
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MATTERMOST_URL` | Yes | Base URL of your Mattermost instance |
| `MATTERMOST_BOT_TOKEN` | Yes | Bot access token |
| `MATTERMOST_TEAM_ID` | Yes | Team ID where the bot operates |
| `MATTERMOST_CHANNEL_ID` | Yes | Channel ID to fetch posts from |
| `MATTERMOST_BOT_USER_ID` | Yes | User ID of the bot account |
| `PORT` | No | Server port (default: 3000) |
| `BASE_URL` | No | Base URL for RSS feed links |
| `NODE_ENV` | No | Environment (development/production) |

### Getting Mattermost IDs

To find the required IDs:

1. **Team ID**: Go to System Console → Teams, or check the URL when viewing your team
2. **Channel ID**: Go to System Console → Channels, or use the API: `GET /api/v4/teams/{team_id}/channels`
3. **Bot User ID**: Go to System Console → Integrations → Bot Accounts, or use: `GET /api/v4/users/username/{bot_username}`

### Bot Token Setup

1. Go to Mattermost → Integrations → Bot Accounts
2. Create a new bot or use existing
3. Generate an access token
4. Ensure the bot has permissions to read the target channel

## RSS Feed Format

The generated RSS feed includes:

- **Title**: "Author: Message preview" format showing who mentioned the bot
- **Description**: Full message content with author info and mention type indicator
- **Link**: Direct link to the Mattermost post
- **Date**: Post creation timestamp
- **Author**: Person who mentioned the bot (not the bot itself)
- **Categories**: Includes mention type and extracted properties
- **Custom Elements**: Mattermost-specific metadata (post ID, author info, mention type, etc.)

### Mention Type Indicators

- 🔔 **Direct mention**: Bot was explicitly mentioned via Mattermost's mention system
- 👤 **Username mention**: Message contains @botusername text
- 📢 **Channel mention**: Message contains @here, @channel, or @all
- ❓ **Mention detected**: Other mention detection methods

### Markdown Conversion

The API converts basic Markdown formatting to HTML:
- `**bold**` → `<strong>bold</strong>`
- `*italic*` → `<em>italic</em>`
- `` `code` `` → `<code>code</code>`
- Line breaks → `<br>` tags

## Usage Examples

### Fetch RSS Feed
```bash
curl http://localhost:3000/rss
```

### Get Raw Mentions
```bash
curl http://localhost:3000/posts?limit=10
```

### Health Check
```bash
curl http://localhost:3000/health
```

### Subscribe to RSS Feed
Add `http://your-server:3000/rss` to your RSS reader.

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Development Server
```bash
npm run dev
```

## Troubleshooting

### Common Issues

1. **403 Forbidden**: Check bot token permissions
2. **404 Not Found**: Verify team/channel/user IDs are correct
3. **Empty RSS Feed**: Ensure bot is being mentioned in messages in the specified channel
4. **Connection Issues**: Verify Mattermost URL and network connectivity
5. **No Mentions Detected**: Check that bot username is correct and mentions are being made properly

### Debugging

Enable debug logging by setting:
```bash
NODE_ENV=development
```

Check the health endpoint for connection status:
```bash
curl http://localhost:3000/health
```

## Security Considerations

- Keep bot tokens secure and never commit them to version control
- Use HTTPS in production
- Consider rate limiting for public deployments
- Regularly rotate bot tokens
- Limit bot permissions to minimum required

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section
- Review Mattermost API documentation
- Open an issue on GitHub
