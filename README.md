# Mattermost RSS Creator for a Channel

Creating an RSS feed from a Mattermost Channel

👉 Note: Currently, only the posts that have a reaction with an admin account are included in the RSS feed.

## API Endpoints

| Endpoint   | Method | Description                             |
| ---------- | ------ | --------------------------------------- |
| `/`        | GET    | API information and available endpoints |
| `/rss`     | GET    | RSS feed of messages mentioning the bot |
| `/rss.xml` | GET    | RSS feed (alternative endpoint)         |
| `/health`  | GET    | Health check endpoint                   |

## Installation

### Prerequisites

- Node.js 16+
- A Mattermost instance with bot account configured
- Bot access token with appropriate permissions

### Local Development

1. Clone the repository:

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
MATTERMOST_URL=
MATTERMOST_BOT_TOKEN=
MATTERMOST_TEAM_ID=
MATTERMOST_TEAM_NAME=
MATTERMOST_BOT_USER_ID=
MATTERMOST_NEWS_CHANNEL=
MATTERMOST_NEWS_CHANNEL_ID=
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
version: "3.8"
services:
  mattermost-rss-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MATTERMOST_URL=
      - MATTERMOST_BOT_USER_ID=
      - MATTERMOST_BOT_TOKEN=
      - MATTERMOST_TEAM_ID=
      - MATTERMOST_TEAM_NAME=
      - MATTERMOST_NEWS_CHANNEL=
      - MATTERMOST_NEWS_CHANNEL_ID=
    restart: unless-stopped
```

## Configuration

### Environment Variables

| Variable                     | Required | Description                           |
| ---------------------------- | -------- | ------------------------------------- |
| `MATTERMOST_URL`             | Yes      | Base URL of your Mattermost instance  |
| `MATTERMOST_BOT_USER_ID`     | Yes      | User ID of the bot account            |
| `MATTERMOST_BOT_TOKEN`       | Yes      | Bot access token                      |
| `MATTERMOST_TEAM_ID`         | Yes      | Team ID where the bot operates        |
| `MATTERMOST_TEAM_NAME`       | Yes      | Team Name where the bot operates      |
| `MATTERMOST_NEWS_CHANNEL`    | Yes      | News Channel Name to fetch posts from |
| `MATTERMOST_NEWS_CHANNEL_ID` | Yes      | News Channel ID to fetch posts from   |
| `PORT`                       | No       | Server port (default: 3000)           |
| `BASE_URL`                   | No       | Base URL for RSS feed links           |
| `NODE_ENV`                   | No       | Environment (development/production)  |

### Getting Mattermost IDs

To find the required IDs:

#### Using browser

1. **Team ID**: Go to System Console → Teams, or check the URL when viewing your team
2. **Channel ID**: Go to System Console → Channels, or use the API: `GET /api/v4/teams/{team_id}/channels`
3. **Bot User ID**: Go to System Console → Integrations → Bot Accounts, or use: `GET /api/v4/users/username/{bot_username}`

#### Using `mmctl` CLI

1. Install `mmctl` from your Mattermost instance
2. To get the channel ID and the team ID, run the command below, replacing the `NAME_OF_YOUR_TEAM` with your actual team name:

```bash
mmctl team list NAME_OF_YOUR_TEAM --json
```

This will return a JSON object. The `id` field in the object is the channel ID, and the `team_id` field is the team ID.

3. To get the bot user ID, run:

```bash
mmctl bot list
```

This will list all bot accounts. The first column is the bot ID.

### Bot Token Setup

1. Go to Mattermost → Integrations → Bot Accounts
2. Create a new bot or use existing
3. Generate an access token
4. Ensure the bot has permissions to read the target channel

## License

MIT License - see LICENSE file for details.
