import express from 'express';
import cors from 'cors';
import twilio from 'twilio';
import rateLimit from 'express-rate-limit';

const app = express();

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many SMS requests from this IP, please try again later.'
});

app.use('/api/', limiter);

const isValidPhoneNumber = (phone) => {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

const SCHEDULE_CONSTRAINTS = {
  MIN_MINUTES_AHEAD: 15,
  MAX_DAYS_AHEAD: 7,
};

const personalizeMessage = (template, contact) => {
  let personalizedMessage = template;

  Object.keys(contact).forEach(key => {
    const pattern = new RegExp(`\\{${key}\\}`, 'gi');
    const value = contact[key] || '';
    personalizedMessage = personalizedMessage.replace(pattern, value);
  });

  return personalizedMessage;
};

const validateSenderConfig = (senderConfig) => {
  if (!senderConfig) {
    return 'Sender configuration is required';
  }

  if (senderConfig.type === 'phone') {
    if (!senderConfig.phoneNumber) {
      return 'Phone number is required when using phone sender type';
    }
    if (!isValidPhoneNumber(senderConfig.phoneNumber)) {
      return 'Invalid phone number format';
    }
    return null;
  }

  if (senderConfig.type === 'messaging-service') {
    if (!senderConfig.messagingServiceSid) {
      return 'Messaging Service SID is required when using messaging service sender type';
    }
    return null;
  }

  return 'Invalid sender type. Must be "phone" or "messaging-service"';
};

app.post('/api/messaging-services', async (req, res) => {
  try {
    const { accountSid, authToken } = req.body;

    if (!accountSid || !authToken) {
      return res.status(400).json({ error: 'Missing required Twilio credentials' });
    }

    const client = twilio(accountSid, authToken);
    const services = await client.messaging.v1.services.list();

    const formattedServices = services.map(service => ({
      sid: service.sid,
      friendlyName: service.friendlyName,
      dateCreated: service.dateCreated,
      dateUpdated: service.dateUpdated
    }));

    res.json(formattedServices);
  } catch (error) {
    if (error.code === 20003) {
      return res.status(401).json({ error: 'Authentication failed - check your Account SID and Auth Token' });
    }

    res.status(500).json({ error: error.message || 'Failed to fetch messaging services' });
  }
});

app.post('/api/send-bulk-sms', async (req, res) => {
  try {
    const { contacts, message, twilioConfig, senderConfig, messageDelay = 1000 } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array is required and must not be empty' });
    }

    if (contacts.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 contacts allowed per request' });
    }

    const { accountSid, authToken } = twilioConfig || {};

    if (!accountSid || !authToken) {
      return res.status(400).json({ error: 'Missing Twilio credentials (Account SID and Auth Token required)' });
    }

    const senderError = validateSenderConfig(senderConfig);
    if (senderError) {
      return res.status(400).json({ error: senderError });
    }

    const client = twilio(accountSid, authToken);
    const results = { successful: [], failed: [] };

    for (let index = 0; index < contacts.length; index++) {
      const contact = contacts[index];

      try {
        const phoneNumber = typeof contact === 'string' ? contact : contact.phone;

        if (!isValidPhoneNumber(phoneNumber)) {
          results.failed.push({ phone: phoneNumber, error: 'Invalid phone number format' });
          continue;
        }

        const personalizedMessage = typeof contact === 'object'
          ? personalizeMessage(message, contact)
          : message;

        const messageParams = {
          body: personalizedMessage,
          to: phoneNumber
        };

        if (senderConfig.type === 'phone') {
          messageParams.from = senderConfig.phoneNumber;
        } else {
          messageParams.messagingServiceSid = senderConfig.messagingServiceSid;
        }

        const smsResponse = await client.messages.create(messageParams);

        results.successful.push({
          phone: phoneNumber,
          messageSid: smsResponse.sid,
          status: smsResponse.status
        });

        if (index < contacts.length - 1 && messageDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, messageDelay));
        }
      } catch (error) {
        const phoneNumber = typeof contact === 'string' ? contact : contact.phone;
        results.failed.push({
          phone: phoneNumber,
          error: error.message,
          code: error.code
        });
      }
    }

    res.json({
      success: true,
      summary: {
        total: contacts.length,
        successful: results.successful.length,
        failed: results.failed.length
      },
      results
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while sending bulk SMS' });
  }
});

app.post('/api/schedule-sms', async (req, res) => {
  try {
    const { contacts, message, twilioConfig, senderConfig, scheduledDateTime, messageDelay = 1000 } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array is required and must not be empty' });
    }

    if (contacts.length > 1000) {
      return res.status(400).json({ error: 'Maximum 1000 contacts allowed for scheduled SMS' });
    }

    if (!scheduledDateTime) {
      return res.status(400).json({ error: 'Scheduled date and time is required' });
    }

    const scheduleDate = new Date(scheduledDateTime);

    if (Number.isNaN(scheduleDate.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduled date/time format' });
    }

    const now = new Date();
    const minAllowedDate = new Date(now.getTime() + SCHEDULE_CONSTRAINTS.MIN_MINUTES_AHEAD * 60 * 1000);
    const maxAllowedDate = new Date(now.getTime() + SCHEDULE_CONSTRAINTS.MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000);

    if (scheduleDate < minAllowedDate) {
      return res.status(400).json({
        error: `Scheduled time must be at least ${SCHEDULE_CONSTRAINTS.MIN_MINUTES_AHEAD} minutes in the future`
      });
    }

    if (scheduleDate > maxAllowedDate) {
      return res.status(400).json({
        error: `Scheduled time must be no more than ${SCHEDULE_CONSTRAINTS.MAX_DAYS_AHEAD} days in advance`
      });
    }

    const { accountSid, authToken } = twilioConfig || {};

    if (!accountSid || !authToken) {
      return res.status(400).json({ error: 'Missing Twilio credentials (Account SID and Auth Token required)' });
    }

    if (!senderConfig || senderConfig.type !== 'messaging-service' || !senderConfig.messagingServiceSid) {
      return res.status(400).json({
        error: 'Twilio scheduled messages require sender type "messaging-service" with a Messaging Service SID'
      });
    }

    const client = twilio(accountSid, authToken);
    const results = { successful: [], failed: [] };

    for (let index = 0; index < contacts.length; index++) {
      const contact = contacts[index];

      try {
        const phoneNumber = typeof contact === 'string' ? contact : contact.phone;

        if (!isValidPhoneNumber(phoneNumber)) {
          results.failed.push({ phone: phoneNumber, error: 'Invalid phone number format' });
          continue;
        }

        const personalizedMessage = typeof contact === 'object'
          ? personalizeMessage(message, contact)
          : message;

        const smsResponse = await client.messages.create({
          body: personalizedMessage,
          to: phoneNumber,
          messagingServiceSid: senderConfig.messagingServiceSid,
          scheduleType: 'fixed',
          sendAt: scheduleDate.toISOString()
        });

        results.successful.push({
          phone: phoneNumber,
          messageSid: smsResponse.sid,
          status: smsResponse.status
        });

        if (index < contacts.length - 1 && messageDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, messageDelay));
        }
      } catch (error) {
        const phoneNumber = typeof contact === 'string' ? contact : contact.phone;
        results.failed.push({
          phone: phoneNumber,
          error: error.message,
          code: error.code
        });
      }
    }

    res.json({
      success: true,
      scheduledDateTime: scheduleDate.toISOString(),
      contactCount: contacts.length,
      messageSids: results.successful.map(item => item.messageSid),
      summary: {
        scheduled: results.successful.length,
        failedToSchedule: results.failed.length
      },
      message: 'SMS messages were submitted to Twilio scheduling'
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while scheduling SMS' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    schedulerMode: 'twilio-native-no-cron'
  });
});

export default app;
