# Bulk SMS Sender

A bulk SMS application using Twilio API, built with React and Tailwind CSS.

## Features

- CSV upload for contact lists
- Message scheduling and immediate sending
- Real-time progress tracking
- Twilio integration with rate limiting
- Responsive design

## Quick Start

### Prerequisites

- Node.js 18+
- Twilio account (Account SID, Auth Token, phone number)

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

4. Open browser: `http://localhost:5173`

## Usage

1. Configure Twilio credentials in the app
2. Upload CSV file with phone numbers
3. Compose message
4. Send immediately or schedule for later

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

