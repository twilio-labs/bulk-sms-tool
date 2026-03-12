import app from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`SMS Bulk Sender API running on http://localhost:${PORT}`);
  console.log('Ready to send SMS messages via Twilio');
});
