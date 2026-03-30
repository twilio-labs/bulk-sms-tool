# Conversation & Reply Management Feature

This document explains the new conversation/reply feature added to the bulk SMS/WhatsApp tool.

## Overview

The tool now supports receiving and managing replies from contacts. Users can:
- View all incoming messages in a clean conversation list
- See full chat history with each contact
- Send replies directly within the tool
- Track message delivery status (sent, delivered, read, failed)
- View conversation metadata (channel type, contact name, last message time)

## Features

### 1. Conversations List (Left Panel)
- **Contact Information**: Display contact name or phone number
- **Last Message Preview**: Shows the beginning of the most recent message
- **Unread Badge**: Red badge with count of unread messages
- **Channel Indicator**: Shows whether channel is SMS or WhatsApp
- **Last Message Time**: Timestamp of the most recent message
- **Sorting**: Conversations sorted by most recent message first

### 2. Conversation Detail View (Right Panel)
- **Message Bubbles**: 
  - Blue bubbles: Messages you sent (outbound)
  - Gray bubbles: Messages from contacts (inbound)
- **Status Indicators**: 
  - ✓ = Sent
  - ✓✓ = Delivered
  - ✗ = Failed
  - ... = Pending
- **Timestamps**: Shows exact time for each message
- **Reply Input**: Text area to compose and send replies
- **Send Button**: Disabled if message is empty or Twilio credentials not configured

### 3. Auto-Polling
- **Conversations List**: Updates every 5 seconds to show new messages
- **Active Conversation**: Updates every 3 seconds to show incoming replies
- **Automatic Refresh**: No manual interaction required after initial setup

## Configuration

### Prerequisites
1. **Twilio Account**: Already needed for sending messages
2. **Twilio Credentials**: AccountSID and AuthToken (configured in Settings tab)
3. **Sender Number**: SMS number or WhatsApp sender configured (in Settings tab)
4. **Webhook URL**: Your server endpoint must be publicly accessible

### Setting Up Webhooks in Twilio

#### For SMS:
1. Go to Twilio Console → Phone Numbers → Active Numbers
2. Select your SMS number
3. Scroll to "SMS Fallback Settings"
4. Set **SMS Fallback URL** to: `https://your-domain/api/incoming-message`
5. Set method to **HTTP POST**
6. Save

#### For WhatsApp:
1. Go to Twilio Console → Messaging → Services
2. Select your WhatsApp sender (or Sandbox)
3. Scroll to "Webhook Settings"
4. Set **Webhook URL** to: `https://your-domain/api/incoming-message`
5. Set method to **HTTP POST**
6. Save

## How It Works

### Receiving Messages
1. Contact sends SMS or WhatsApp message to your Twilio number
2. Twilio sends webhook POST to `/api/incoming-message` endpoint
3. Server stores message in conversation storage
4. Message appears in Conversations tab

### Sending Replies
1. Click on conversation to open in detail view
2. Type reply in text area at bottom
3. Click "Send Reply" button
4. Message sent via Twilio API
5. Status updates as "sent" → "delivered"
6. Message appears in blue bubble (as outbound)

### Understanding Status

| Status | Meaning |
|--------|---------|
| **Sent** | Message delivered to Twilio, queued for delivery |
| **Delivered** | Message successfully delivered to contact's device |
| **Read** | Contact has read the message (WhatsApp only) |
| **Failed** | Message could not be delivered (check error message) |

## API Endpoints

All conversation endpoints are available at `/api/`:

### GET /api/conversations
**Returns**: List of all conversations
```json
{
  "conversations": [
    {
      "phone": "+1234567890",
      "channel": "sms",
      "lastMessage": "Thanks for the update!",
      "lastMessageTime": "2024-01-15T14:30:00Z",
      "contactName": "John Doe",
      "unreadCount": 2,
      "hasReply": true,
      "messageCount": 5
    }
  ],
  "total": 1
}
```

### GET /api/conversations/:phone
**Returns**: Full conversation with all messages
```json
{
  "phone": "+1234567890",
  "channel": "sms",
  "contactName": "John Doe",
  "messages": [
    {
      "id": "uuid",
      "conversationPhone": "+1234567890",
      "sender": "+1234567890",
      "text": "Hi, confirming your order",
      "timestamp": "2024-01-15T14:30:00Z",
      "status": "delivered",
      "direction": "inbound"
    }
  ],
  "messageCount": 5
}
```

### POST /api/send-reply
**Parameters**:
```json
{
  "phone": "+1234567890",
  "message": "Thanks for your message!",
  "twilioConfig": {
    "accountSid": "AC...",
    "authToken": "..."
  },
  "senderConfig": {
    "fromNumber": "+1987654321",
    "channel": "sms"
  }
}
```

**Returns**:
```json
{
  "success": true,
  "messageId": "uuid",
  "twilioMessageSid": "SM...",
  "status": "sent"
}
```

### POST /api/incoming-message
**Webhook endpoint** - Twilio sends POST data:
```
From: +1234567890
To: +1987654321
Body: Message text...
MessageSid: SM...
NumMedia: 0
```

### POST /api/conversations/:phone/mark-read
**Returns**:
```json
{
  "success": true
}
```

### GET /api/message-status/:messageId
**Returns**:
```json
{
  "id": "uuid",
  "status": "delivered",
  "timestamp": "2024-01-15T14:30:00Z",
  "direction": "outbound"
}
```

## Storage (Current)

Currently uses **in-memory storage** with JavaScript Maps:
- `conversations`: Stores conversation metadata
- `messages`: Stores individual message data
- **Duration**: Data persists only while server is running
- **Scope**: All conversations and messages cleared on server restart

## Production Considerations

### 1. Persistent Storage
Replace in-memory Maps with a database:
- **PostgreSQL**: Recommended for reliability
- **MongoDB**: Good for flexible message schema
- **Redis**: For caching high-frequency data

### 2. Message Status Updates
Currently messages stay as "sent" by default. To get real status updates:
- Enable Twilio message status callbacks
- Configure webhook URL for status updates
- Update message status in database when callbacks received

### 3. Scalability
- Implement message pagination (show only recent 100 messages per conversation)
- Add message archiving (move old messages to archive storage)
- Implement database indexes on phone numbers and timestamps
- Consider message queue (e.g., RabbitMQ) for high volume

### 4. Security
- Add authentication to conversation endpoints
- Validate phone numbers before allowing replies
- Rate limit webhook endpoint to prevent abuse
- Implement message encryption if handling sensitive data
- Add audit logging for compliance

### 5. Performance
- Implement pagination for conversation lists
- Cache frequently accessed conversations
- Use lazy loading for message history
- Debounce polling requests if high latency

## Troubleshooting

### No messages appearing
1. ✓ Check Twilio webhook URL is configured correctly
2. ✓ Verify webhook method is set to **POST**
3. ✓ Test webhook by sending test message from Twilio console
4. ✓ Check server logs for webhook delivery errors
5. ✓ Ensure server is publicly accessible (not localhost)

### Can't send replies
1. ✓ Verify Twilio credentials configured in Settings tab
2. ✓ Verify sender number is configured
3. ✓ Check that phone number is in valid format (+1234567890)
4. ✓ Check server logs for Twilio API errors

### Status not updating
- Status updates from delivered → read require Twilio callbacks
- Message status callback webhook not yet implemented
- Check Twilio console for message delivery reports

## Example Workflow

1. **Setup** (First time)
   - Go to Settings tab
   - Enter Twilio credentials
   - Configure sender number
   - Configure Twilio webhooks (see section above)

2. **Send Messages**
   - Upload contacts in Contacts tab
   - Compose message in Message tab
   - Send via Sending tab
   - (Contacts may start replying)

3. **Manage Replies**
   - Go to Conversations tab
   - See new conversations with unread badges
   - Click conversation to view messages
   - Type reply and click "Send Reply"
   - See status update from "sent" to "delivered"

4. **Monitor**
   - Refresh button manually updates if needed
   - Auto-polling updates conversations every 5 seconds
   - Check unread badges to identify new messages

## Known Limitations

1. **Data Persistence**: No database, in-memory only
2. **Message Status**: Limited update (mostly "sent/delivered")
3. **No Media**: Text messages only
4. **No Groups**: One-to-one conversations only
5. **No Threading**: Messages shown in flat chronological order
6. **No Mentions**: Cannot mention or tag contacts
7. **No Search**: Cannot search conversations or messages
8. **No Export**: Cannot export conversation history

## Future Enhancements

- [ ] Database persistence
- [ ] Real-time message status from Twilio callbacks
- [ ] Media/attachment support
- [ ] Conversation search and filtering
- [ ] Bulk reply templates
- [ ] Read receipts (WhatsApp)
- [ ] Conversation archiving
- [ ] Message pagination
- [ ] Conversation export to PDF/CSV
- [ ] User authentication and permissions
- [ ] Canned responses / quick replies
- [ ] Auto-responder rules
- [ ] Conversation analytics
- [ ] Contact profile information
- [ ] Message scheduling

## Support

For issues or questions about the conversation feature:
1. Check logs: `server/server.js` (console.log statements)
2. Check Twilio console for webhook delivery status
3. Verify network/firewall allows webhook delivery to your server
4. Test webhook manually in Twilio console
