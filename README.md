# Bulk SMS + WhatsApp Sender

A bulk messaging application built with React, Vite, and Twilio APIs for SMS, WhatsApp, scheduling, analytics, and two-way replies.

## Features

- CSV upload and contact validation
- Immediate send and scheduled sending
- SMS and WhatsApp sender configuration
- WhatsApp Content Template support
- Delivery progress and result tracking
- Replies (Beta): two-way conversation view for SMS and WhatsApp

## Replies (Beta)

The Replies section combines server-side conversation listing with realtime Twilio Conversations updates:

- Conversation list is fetched via backend `/api/conversations` (full SMS/WhatsApp list)
- Realtime updates use the Twilio Conversations browser SDK
- Conversations auto-subscribe when opened if needed
- "New messages" card badges appear for inbound updates
- Background badge sync runs every 3 minutes, plus an initial sync after page load

WhatsApp reply behavior:

- If last inbound user message is within 24 hours: free-text and template send are both available
- If last inbound user message is older than 24 hours: free-text is disabled, template send is required
- Inside 24 hours, the template picker shows approved + unapproved templates
- Outside 24 hours, the template picker shows approved templates only

For full implementation details, see [CONVERSATIONS_FEATURE.md](CONVERSATIONS_FEATURE.md).

## Quick Start

### Prerequisites

- Node.js 20.19+ (required by Vite 7)
- Twilio account credentials
  - Account SID
  - Auth Token
  - API Key SID + API Key Secret (for realtime Replies)
- Twilio sender setup
  - SMS number and/or
  - WhatsApp-enabled sender (Sandbox or approved production sender)

### Installation

1. Install dependencies:

   ```bash
   npm install
   cd server && npm install
   ```

2. Start backend:

   ```bash
   cd server && npm start
   ```

3. Start frontend:

   ```bash
   npm run dev
   ```

4. Open browser: http://localhost:5173

## Usage

1. Configure Twilio credentials and sender settings
2. Upload a CSV contact list
3. Compose SMS text or choose a WhatsApp template
4. Send now or schedule
5. Open Replies (Beta) to monitor and respond to inbound messages

## CSV Format

```csv
phone,name
+1234567890,John Doe
+1987654321,Jane Smith
```

## Code of Conduct

Your safety and comfort are important to us. The Code of Conduct lets everyone know what's expected, so we can do a better job of interacting with one another. All contributions to and interactions with Twilio's open-source projects have to adhere to our Code of Conduct. You can report violations at open-source@twilio.com.

[Read the Code of Conduct](https://github.com/twilio-labs/.github/blob/master/CODE_OF_CONDUCT.md)

## License

MIT License

