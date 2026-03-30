import express from 'express';
import cors from 'cors';
import twilio from 'twilio';
import rateLimit from 'express-rate-limit';

const app = express();

// Vercel and other reverse proxies set X-Forwarded-* headers.
// trust proxy must be enabled so middleware like express-rate-limit can resolve client IPs correctly.
app.set('trust proxy', 1);

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

const DEFAULT_WHATSAPP_RATE_CARDS = [
  {
    code: 'US',
    name: 'United States',
    rates: {
      marketing: { rate: 0.025, available: true },
      utility: { rate: 0.004, available: true },
      authentication: { rate: 0.0135, available: true },
      service: { rate: 0, available: false }
    }
  },
  {
    code: 'CA',
    name: 'Canada',
    rates: {
      marketing: { rate: 0.025, available: true },
      utility: { rate: 0.008, available: true },
      authentication: { rate: 0.0135, available: true },
      service: { rate: 0, available: false }
    }
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    rates: {
      marketing: { rate: 0.039, available: true },
      utility: { rate: 0.02, available: true },
      authentication: { rate: 0.039, available: true },
      service: { rate: 0, available: false }
    }
  },
  {
    code: 'IN',
    name: 'India',
    rates: {
      marketing: { rate: 0.0113, available: true },
      utility: { rate: 0.0014, available: true },
      authentication: { rate: 0.0014, available: true },
      service: { rate: 0, available: false }
    }
  },
  {
    code: 'BR',
    name: 'Brazil',
    rates: {
      marketing: { rate: 0.0625, available: true },
      utility: { rate: 0.0315, available: true },
      authentication: { rate: 0.0315, available: true },
      service: { rate: 0, available: false }
    }
  }
];

const normalizeChannel = (channel) => (channel === 'whatsapp' ? 'whatsapp' : 'sms');

const toTwilioAddress = (phoneNumber, channel) => (
  normalizeChannel(channel) === 'whatsapp' ? `whatsapp:${phoneNumber}` : phoneNumber
);

const parseTemplateVariables = (variables) => {
  if (!variables) return {};
  if (typeof variables === 'string') {
    try {
      return JSON.parse(variables);
    } catch {
      return {};
    }
  }
  if (typeof variables === 'object') {
    return variables;
  }
  return {};
};

const resolveTemplateVariablesForContact = (contentTemplate, contact) => {
  const templateVariables = parseTemplateVariables(contentTemplate?.variables);
  const safeContact = (contact && typeof contact === 'object') ? contact : {};
  const resolvedVariables = {};

  Object.entries(templateVariables).forEach(([key, rawValue]) => {
    const valueAsString = String(rawValue ?? '');
    resolvedVariables[key] = personalizeMessage(valueAsString, safeContact);
  });

  return resolvedVariables;
};

const extractWhatsAppApprovalStatus = (template) => {
  const normalizeStatus = (value) => {
    if (!value || typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();

    if (normalized.includes('approved') && !normalized.includes('unapproved')) return 'approved';
    if (normalized.includes('unapproved') || normalized.includes('rejected') || normalized.includes('denied')) return 'unapproved';
    if (normalized.includes('pending') || normalized.includes('submitted') || normalized.includes('in_review') || normalized.includes('in review')) return 'pending';

    return normalized;
  };

  const candidates = [];

  const pushCandidate = (value) => {
    if (!value) return;

    if (typeof value === 'string') {
      candidates.push(value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(pushCandidate);
      return;
    }

    if (typeof value === 'object') {
      if (typeof value.status === 'string') candidates.push(value.status);
      if (typeof value.name === 'string') candidates.push(value.name);
      if (typeof value.state === 'string') candidates.push(value.state);
      if (typeof value.approval_status === 'string') candidates.push(value.approval_status);
      if (typeof value.whatsapp === 'string') candidates.push(value.whatsapp);
      if (typeof value.channel === 'string' && value.channel.toLowerCase() === 'whatsapp') {
        if (typeof value.status === 'string') candidates.push(value.status);
      }

      Object.values(value).forEach(pushCandidate);
    }
  };

  pushCandidate(template?.approvalRequests);
  pushCandidate(template?.approvals);

  for (const candidate of candidates) {
    const normalized = normalizeStatus(candidate);
    if (normalized === 'approved' || normalized === 'unapproved' || normalized === 'pending') {
      return normalized;
    }
  }

  return null;
};

const inferWhatsAppCategory = (template) => {
  const candidate =
    template?.whatsappCategory ||
    template?.category ||
    template?.types?.['twilio/text']?.category ||
    template?.types?.['whatsapp/text']?.category ||
    template?.approvalRequests?.whatsapp?.category ||
    'marketing';

  return String(candidate).toLowerCase();
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

app.post('/api/content-templates', async (req, res) => {
  try {
    const { accountSid, authToken, includeUnapproved = false } = req.body || {};
    const includeUnapprovedTemplates = includeUnapproved === true || includeUnapproved === 'true';

    if (!accountSid || !authToken) {
      return res.status(400).json({ error: 'Missing required Twilio credentials' });
    }

    const client = twilio(accountSid, authToken);
    const templates = await client.content.v2.contents.list({ limit: 200 });

    const normalizedTemplates = templates
      .map((template) => {
        const types = (template?.types && typeof template.types === 'object') ? template.types : {};
        const typeKeys = Object.keys(types);
        const hasSupportedType = typeKeys.some((key) => {
          const normalizedKey = key.toLowerCase();
          return normalizedKey.startsWith('twilio/') || normalizedKey.includes('whatsapp');
        });
        const hasWhatsAppType = typeKeys.some((key) => key.toLowerCase().includes('whatsapp'));

        const whatsappApprovalStatusRaw = extractWhatsAppApprovalStatus(template);
        const whatsappApprovalStatus = whatsappApprovalStatusRaw ? String(whatsappApprovalStatusRaw).toLowerCase() : null;

        return {
          sid: template.sid,
          friendlyName: template.friendlyName,
          language: template.language || 'en',
          variables: parseTemplateVariables(template.variables),
          types,
          whatsappCategory: inferWhatsAppCategory(template),
          whatsappApprovalStatus,
          hasWhatsAppType,
          hasSupportedType
        };
      })
      .filter((template) => template.hasSupportedType)
      .filter((template) => {
        if (includeUnapprovedTemplates) {
          return true;
        }

        return template.whatsappApprovalStatus === 'approved';
      })
      .map(({ hasWhatsAppType, hasSupportedType, ...template }) => template);

    res.json(normalizedTemplates);
  } catch (error) {
    if (error.code === 20003) {
      return res.status(401).json({ error: 'Authentication failed - check your Account SID and Auth Token' });
    }

    res.status(500).json({ error: error.message || 'Failed to fetch content templates' });
  }
});

app.post('/api/sms-pricing', async (req, res) => {
  try {
    const { accountSid, authToken, countryCode = 'US' } = req.body || {};

    if (!accountSid || !authToken) {
      return res.status(400).json({ error: 'Missing required Twilio credentials' });
    }

    const client = twilio(accountSid, authToken);
    const country = await client.pricing.v1.messaging.countries(String(countryCode).toUpperCase()).fetch();

    const outboundPrices = Array.isArray(country?.outboundSmsPrices) ? country.outboundSmsPrices : [];
    const numericPrices = outboundPrices
      .map((entry) => Number(entry?.prices?.[0]?.currentPrice ?? entry?.prices?.[0]?.basePrice ?? entry?.currentPrice ?? entry?.basePrice))
      .filter((value) => Number.isFinite(value) && value > 0);

    const estimatedOutboundPrice = numericPrices.length > 0 ? Math.min(...numericPrices) : null;

    res.json({
      countryCode: country?.isoCountry || String(countryCode).toUpperCase(),
      countryName: country?.country || String(countryCode).toUpperCase(),
      estimatedOutboundPrice,
      priceUnit: 'USD',
      sampleSize: numericPrices.length
    });
  } catch (error) {
    if (error.code === 20003) {
      return res.status(401).json({ error: 'Authentication failed - check your Account SID and Auth Token' });
    }

    res.status(500).json({ error: error.message || 'Failed to fetch SMS pricing' });
  }
});

app.get('/api/whatsapp-rate-cards', async (_req, res) => {
  res.json({
    source: 'Bundled fallback rate card',
    sourceUrl: 'https://www.twilio.com/whatsapp/pricing',
    updatedAt: '2026-03-30T00:00:00.000Z',
    twilioFeePerMessage: 0.005,
    countries: DEFAULT_WHATSAPP_RATE_CARDS
  });
});

app.post('/api/whatsapp-senders', async (req, res) => {
  try {
    const { accountSid, authToken } = req.body || {};

    if (!accountSid || !authToken) {
      return res.status(400).json({ error: 'Missing required Twilio credentials' });
    }

    const client = twilio(accountSid, authToken);
    const senderMap = new Map();

    // Prefer channel senders attached to messaging services because they explicitly
    // represent approved channel identities (including WhatsApp senders).
    const services = await client.messaging.v1.services.list({ limit: 200 });

    for (const service of services) {
      try {
        const channelSenders = await client.messaging.v1.services(service.sid).channelSenders.list({ limit: 200 });

        channelSenders.forEach((channelSender) => {
          const rawAddress =
            channelSender?.sender ||
            channelSender?.address ||
            channelSender?.channelSender ||
            channelSender?.phoneNumber ||
            '';

          const normalizedAddress = String(rawAddress).trim().toLowerCase();
          if (!normalizedAddress.startsWith('whatsapp:')) {
            return;
          }

          const phoneNumber = rawAddress.replace(/^whatsapp:/i, '').trim();
          if (!phoneNumber) {
            return;
          }

          senderMap.set(phoneNumber, {
            sid: channelSender.sid,
            phoneNumber,
            friendlyName: service.friendlyName
              ? `${service.friendlyName} (${phoneNumber})`
              : phoneNumber,
            status: channelSender.status || null,
            source: 'messaging-service'
          });
        });
      } catch {
        // Some services may not expose channel senders. Ignore and continue.
      }
    }

    // Fallback: include numbers that explicitly expose WhatsApp capability.
    // We intentionally do not include generic incoming numbers to avoid false positives.
    if (senderMap.size === 0) {
      const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 200 });
      phoneNumbers.forEach((phoneNumberResource) => {
        if (phoneNumberResource?.capabilities?.whatsapp === true) {
          senderMap.set(phoneNumberResource.phoneNumber, {
            sid: phoneNumberResource.sid,
            phoneNumber: phoneNumberResource.phoneNumber,
            friendlyName: phoneNumberResource.friendlyName || phoneNumberResource.phoneNumber,
            status: 'approved',
            source: 'phone-number'
          });
        }
      });
    }

    const senders = [...senderMap.values()];

    const sandboxNumber = '+14155238886';
    const hasSandbox = senders.some((sender) => sender.phoneNumber === sandboxNumber);
    if (!hasSandbox) {
      senders.push({
        sid: 'whatsapp-sandbox',
        phoneNumber: sandboxNumber,
        friendlyName: 'Twilio WhatsApp Sandbox'
      });
    }

    res.json(senders);
  } catch (error) {
    if (error.code === 20003) {
      return res.status(401).json({ error: 'Authentication failed - check your Account SID and Auth Token' });
    }

    res.status(500).json({ error: error.message || 'Failed to fetch WhatsApp senders' });
  }
});

app.post('/api/send-bulk-sms', async (req, res) => {
  try {
    const {
      contacts,
      message,
      contentTemplate,
      channel = 'sms',
      twilioConfig,
      senderConfig,
      messageDelay = 1000
    } = req.body;

    const normalizedChannel = normalizeChannel(channel);
    const hasTemplate = !!contentTemplate?.contentSid;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array is required and must not be empty' });
    }

    if (contacts.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 contacts allowed per request' });
    }

    if (!hasTemplate && (!message || !String(message).trim())) {
      return res.status(400).json({ error: 'Message body is required when no content template is selected' });
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

        const destination = toTwilioAddress(phoneNumber, normalizedChannel);

        const messageParams = {
          to: destination
        };

        if (senderConfig.type === 'phone') {
          messageParams.from = toTwilioAddress(senderConfig.phoneNumber, normalizedChannel);
        } else {
          messageParams.messagingServiceSid = senderConfig.messagingServiceSid;
        }

        if (hasTemplate) {
          messageParams.contentSid = contentTemplate.contentSid;
          messageParams.contentVariables = JSON.stringify(resolveTemplateVariablesForContact(contentTemplate, contact));
        } else {
          const personalizedMessage = typeof contact === 'object'
            ? personalizeMessage(message, contact)
            : message;
          messageParams.body = personalizedMessage;
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
      channel: normalizedChannel,
      results
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while sending bulk SMS' });
  }
});

app.post('/api/schedule-sms', async (req, res) => {
  try {
    const {
      contacts,
      message,
      contentTemplate,
      channel = 'sms',
      twilioConfig,
      senderConfig,
      scheduledDateTime,
      messageDelay = 1000
    } = req.body;

    const normalizedChannel = normalizeChannel(channel);

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array is required and must not be empty' });
    }

    if (contacts.length > 1000) {
      return res.status(400).json({ error: 'Maximum 1000 contacts allowed for scheduled SMS' });
    }

    if (!scheduledDateTime) {
      return res.status(400).json({ error: 'Scheduled date and time is required' });
    }

    const hasTemplate = !!contentTemplate?.contentSid;
    if (!hasTemplate && (!message || !String(message).trim())) {
      return res.status(400).json({ error: 'Message body is required when no content template is selected' });
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

        const destination = toTwilioAddress(phoneNumber, normalizedChannel);

        const messageParams = {
          to: destination,
          messagingServiceSid: senderConfig.messagingServiceSid,
          scheduleType: 'fixed',
          sendAt: scheduleDate.toISOString()
        };

        if (hasTemplate) {
          messageParams.contentSid = contentTemplate.contentSid;
          messageParams.contentVariables = JSON.stringify(contentTemplate.variables || {});
        } else {
          const personalizedMessage = typeof contact === 'object'
            ? personalizeMessage(message, contact)
            : message;
          messageParams.body = personalizedMessage;
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
      channel: normalizedChannel,
      scheduledDateTime: scheduleDate.toISOString(),
      contactCount: contacts.length,
      messageSids: results.successful.map(item => item.messageSid),
      summary: {
        scheduled: results.successful.length,
        failedToSchedule: results.failed.length
      },
      message: `${normalizedChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} messages were submitted to Twilio scheduling`
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
