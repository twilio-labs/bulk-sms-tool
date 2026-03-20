import express from 'express';
import cors from 'cors';
import twilio from 'twilio';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import https from 'https';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many messaging requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// In-memory storage for scheduled jobs (in production, use a database)
const scheduledJobs = new Map();
const scheduledTimeouts = new Map(); // Store timeout IDs for cancellation
const SUPPORTED_CHANNELS = ['sms', 'whatsapp'];
const WHATSAPP_CATEGORY_DEFAULT = 'marketing';
const TWILIO_WHATSAPP_FEE_PER_MESSAGE = 0.005;
const WHATSAPP_RATE_CARD_SOURCE_URL = 'https://www.twilio.com/en-us/whatsapp/pricing';
const WHATSAPP_RATE_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
let whatsappRateCardCache = {
  updatedAt: null,
  countries: [],
};

// Validate phone number format
const isValidPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  const normalizedPhone = phone.replace(/^whatsapp:/i, '').trim();
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(normalizedPhone);
};

const normalizeChannel = (channel) => {
  if (!channel || typeof channel !== 'string') {
    return 'sms';
  }

  const normalized = channel.toLowerCase().trim();
  return SUPPORTED_CHANNELS.includes(normalized) ? normalized : null;
};

const formatAddressForChannel = (phone, channel) => {
  const normalizedPhone = phone.replace(/^whatsapp:/i, '').trim();

  if (channel === 'whatsapp') {
    return `whatsapp:${normalizedPhone}`;
  }

  return normalizedPhone;
};

// Store completed job results
const completedJobs = new Map();

// Function to personalize message with contact data
const personalizeMessage = (template, contact) => {
  console.log('Personalizing message for contact:', contact);
  console.log('Original template:', template);
  
  let personalizedMessage = template;
  
  // Replace all {fieldName} patterns with actual contact data
  Object.keys(contact).forEach(key => {
    const pattern = new RegExp(`\\{${key}\\}`, 'gi');
    const value = contact[key] || '';
    console.log(`Replacing {${key}} with "${value}"`);
    personalizedMessage = personalizedMessage.replace(pattern, value);
  });
  
  console.log('Final personalized message:', personalizedMessage);
  return personalizedMessage;
};

const personalizeTemplateVariables = (variables, contact) => {
  if (!variables || typeof variables !== 'object') {
    return {};
  }

  const personalizedVariables = {};

  Object.entries(variables).forEach(([key, value]) => {
    if (typeof value === 'string') {
      personalizedVariables[key] = personalizeMessage(value, contact);
      return;
    }

    personalizedVariables[key] = value;
  });

  return personalizedVariables;
};



const parseRateCardAttribute = (value) => {
  if (!value || typeof value !== 'string') {
    return { rate: null, tierLimit: null, available: false };
  }

  try {
    const parsed = JSON.parse(value);
    const [rawRate, rawTierLimit, rawAvailable] = Array.isArray(parsed) ? parsed : [];

    const rate = Number(rawRate);
    const tierLimit = Number(rawTierLimit);

    return {
      rate: Number.isFinite(rate) ? rate : null,
      tierLimit: Number.isFinite(tierLimit) ? tierLimit : null,
      available: Boolean(rawAvailable),
    };
  } catch (error) {
    return { rate: null, tierLimit: null, available: false };
  }
};

const fetchTextFromUrl = (url) => {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Failed to fetch WhatsApp rate cards (HTTP ${response.statusCode})`));
          response.resume();
          return;
        }

        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          resolve(data);
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

const decodeHtmlEntities = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractWhatsAppRateCardsFromHtml = (html) => {
  if (!html || typeof html !== 'string') {
    return [];
  }

  const optionRegex = /<option[^>]*value="([A-Z]{2})"[^>]*data-utility-rates="([^"]*)"[^>]*data-authentication-rates="([^"]*)"[^>]*data-marketing-rates="([^"]*)"[^>]*data-service-rates="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi;

  const countries = [];
  let match;

  while ((match = optionRegex.exec(html)) !== null) {
    const [, code, utilityRaw, authenticationRaw, marketingRaw, serviceRaw, rawLabel] = match;
    const name = decodeHtmlEntities(rawLabel.replace(/<[^>]+>/g, ''));

    if (!code || !name) {
      continue;
    }

    countries.push({
      code,
      name,
      rates: {
        utility: parseRateCardAttribute(utilityRaw),
        authentication: parseRateCardAttribute(authenticationRaw),
        marketing: parseRateCardAttribute(marketingRaw),
        service: parseRateCardAttribute(serviceRaw),
      },
    });
  }

  return countries.sort((a, b) => a.name.localeCompare(b.name));
};

const getWhatsAppRateCards = async () => {
  const now = Date.now();
  const isCacheValid = whatsappRateCardCache.updatedAt && now - whatsappRateCardCache.updatedAt < WHATSAPP_RATE_CACHE_TTL_MS;

  if (isCacheValid && whatsappRateCardCache.countries.length > 0) {
    return whatsappRateCardCache;
  }

  const html = await fetchTextFromUrl(WHATSAPP_RATE_CARD_SOURCE_URL);
  const countries = extractWhatsAppRateCardsFromHtml(html);

  if (!countries.length) {
    throw new Error('Unable to parse WhatsApp rate cards from source');
  }

  whatsappRateCardCache = {
    updatedAt: now,
    countries,
  };

  return whatsappRateCardCache;
};

const extractEstimatedSmsPrice = (countryData) => {
  const candidates = [];

  const maybePush = (value) => {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric) && numeric > 0) {
      candidates.push(numeric);
    }
  };

  const outboundPrices = countryData?.outboundSmsPrices || countryData?.outbound_sms_prices || [];

  if (Array.isArray(outboundPrices)) {
    outboundPrices.forEach((carrierPricing) => {
      maybePush(carrierPricing?.currentPrice);
      maybePush(carrierPricing?.current_price);
      maybePush(carrierPricing?.price);

      const nestedPrices = carrierPricing?.prices || [];
      if (Array.isArray(nestedPrices)) {
        nestedPrices.forEach((priceItem) => {
          maybePush(priceItem?.currentPrice);
          maybePush(priceItem?.current_price);
          maybePush(priceItem?.basePrice);
          maybePush(priceItem?.base_price);
          maybePush(priceItem?.price);
        });
      }
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  return Math.min(...candidates);
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase().trim() === 'true';
  }

  return false;
};

// Function to send bulk SMS
const sendBulkSMSJob = async (jobData) => {
  const { contacts, message, contentTemplate, twilioConfig, senderConfig, channel = 'sms', jobId, messageDelay = 1000 } = jobData;
  const client = twilio(twilioConfig.accountSid, twilioConfig.authToken);
  
  console.log(`Starting scheduled SMS job ${jobId} for ${contacts.length} contacts`);
  
  let successCount = 0;
  let failedCount = 0;
  const errors = [];
  const results = {
    successful: [],
    failed: []
  };

  for (const contact of contacts) {
    try {
      const contactPhone = typeof contact === 'string' ? contact : contact.phone;
      const normalizedPhone = contactPhone?.replace(/^whatsapp:/i, '').trim();

      if (!isValidPhoneNumber(normalizedPhone)) {
        throw new Error('Invalid phone number format');
      }

      // Prepare message parameters based on sender configuration
      const messageParams = {
        to: formatAddressForChannel(normalizedPhone, channel)
      };

      const useContentTemplate = channel === 'whatsapp' && contentTemplate?.contentSid;

      if (useContentTemplate) {
        const personalizedVariables = personalizeTemplateVariables(contentTemplate.variables, contact);
        messageParams.contentSid = contentTemplate.contentSid;
        if (Object.keys(personalizedVariables).length > 0) {
          messageParams.contentVariables = JSON.stringify(personalizedVariables);
        }
      } else {
        const personalizedMessage = personalizeMessage(message, contact);
        messageParams.body = personalizedMessage;
      }

      // Set sender based on configuration
      if (senderConfig.type === 'phone') {
        messageParams.from = formatAddressForChannel(senderConfig.phoneNumber, channel);
      } else if (senderConfig.type === 'messaging-service') {
        messageParams.messagingServiceSid = senderConfig.messagingServiceSid;
      }

      const smsResponse = await client.messages.create(messageParams);

      successCount++;
      results.successful.push({
        phone: normalizedPhone,
        messageSid: smsResponse.sid,
        status: smsResponse.status
      });
      console.log(`Message sent to ${normalizedPhone} via ${channel}`);
      
      // Add delay to avoid rate limiting (skip if messageDelay is 0)
      if (messageDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, messageDelay));
      }
      
    } catch (error) {
      failedCount++;
      const contactPhone = typeof contact === 'string' ? contact : contact.phone;
      const normalizedPhone = contactPhone?.replace(/^whatsapp:/i, '').trim();
      const errorMsg = `${normalizedPhone}: ${error.message}`;
      errors.push(errorMsg);
      results.failed.push({
        phone: normalizedPhone,
        error: error.message,
        code: error.code
      });
      console.error(`❌ Failed to send message to ${normalizedPhone}:`, error.message);
    }
  }

  console.log(`Job ${jobId} completed: ${successCount} sent, ${failedCount} failed`);
  
  // Mark job as sent instead of deleting it
  const job = scheduledJobs.get(jobId);
  if (job) {
    job.status = 'sent';
    job.completedAt = new Date().toISOString();
    job.results = {
      total: contacts.length,
      successful: successCount,
      failed: failedCount
    };
  }
  
  // Store completed job results for retrieval
  completedJobs.set(jobId, {
    jobId,
    completedAt: new Date().toISOString(),
    summary: {
      total: contacts.length,
      successful: successCount,
      failed: failedCount
    },
    results,
    errors
  });
  
  return { successCount, failedCount, errors, results };
};

// Fetch approved WhatsApp senders endpoint
app.post('/api/whatsapp-senders', async (req, res) => {
  try {
    const { accountSid, authToken } = req.body;

    if (!accountSid || !authToken) {
      return res.status(400).json({
        error: 'Missing required Twilio credentials'
      });
    }

    const client = twilio(accountSid, authToken);
    const senders = await client.messaging.v2.channelsSenders.list({
      channel: 'whatsapp',
      limit: 1000
    });

    const formattedSenders = senders.map((sender) => ({
      sid: sender.sid,
      phoneNumber: sender.senderId?.replace(/^whatsapp:/i, ''),
      friendlyName: sender.profile?.name || sender.senderId?.replace(/^whatsapp:/i, ''),
      status: sender.status,
      dateCreated: sender.dateCreated,
      dateUpdated: sender.dateUpdated
    }));

    res.json(formattedSenders);
  } catch (error) {
    console.error('Error fetching WhatsApp senders:', error);

    if (error.code === 20003) {
      return res.status(401).json({
        error: 'Authentication failed - check your Account SID and Auth Token'
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to fetch WhatsApp senders'
    });
  }
});

// Fetch messaging services endpoint
app.post('/api/messaging-services', async (req, res) => {
  try {
    const { accountSid, authToken } = req.body;

    // Validate required fields
    if (!accountSid || !authToken) {
      return res.status(400).json({ 
        error: 'Missing required Twilio credentials' 
      });
    }

    // Initialize Twilio client
    const client = twilio(accountSid, authToken);

    // Fetch messaging services
    const services = await client.messaging.v1.services.list();
    
    // Format the response
    const formattedServices = services.map(service => ({
      sid: service.sid,
      friendlyName: service.friendlyName,
      dateCreated: service.dateCreated,
      dateUpdated: service.dateUpdated
    }));

    res.json(formattedServices);
  } catch (error) {
    console.error('Error fetching messaging services:', error);
    
    // Handle specific Twilio errors
    if (error.code === 20003) {
      return res.status(401).json({ 
        error: 'Authentication failed - check your Account SID and Auth Token' 
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to fetch messaging services' 
    });
  }
});

app.post('/api/content-templates', async (req, res) => {
  try {
    const { accountSid, authToken, includeUnapproved = false } = req.body;
    const shouldIncludeUnapproved = parseBoolean(includeUnapproved);

    if (!accountSid || !authToken) {
      return res.status(400).json({
        error: 'Missing required Twilio credentials'
      });
    }

    const client = twilio(accountSid, authToken);
    const contentAndApprovals = await client.content.v1.contentAndApprovals.list({ limit: 200 });

    const filteredTemplates = contentAndApprovals
      .filter((template) => {
        const approval = template.approvalRequests;
        if (!approval) return false;
        if (!shouldIncludeUnapproved && approval.status !== 'approved') return false;
        return true;
      })
      .map((template) => {
        const approval = template.approvalRequests;
        return {
          sid: template.sid,
          friendlyName: template.friendlyName,
          language: template.language,
          variables: template.variables || {},
          types: template.types || {},
          dateCreated: template.dateCreated,
          dateUpdated: template.dateUpdated,
          whatsappApprovalStatus: approval.status,
          whatsappCategory: (approval.category || WHATSAPP_CATEGORY_DEFAULT).toLowerCase(),
        };
      });

    res.json(filteredTemplates);
  } catch (error) {
    console.error('Error fetching content templates:', error);

    if (error.code === 20003) {
      return res.status(401).json({
        error: 'Authentication failed - check your Account SID and Auth Token'
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to fetch content templates'
    });
  }
});

app.get('/api/whatsapp-rate-cards', async (_req, res) => {
  try {
    const rateCards = await getWhatsAppRateCards();

    res.json({
      source: 'twilio-whatsapp-pricing-calculator',
      sourceUrl: WHATSAPP_RATE_CARD_SOURCE_URL,
      twilioFeePerMessage: TWILIO_WHATSAPP_FEE_PER_MESSAGE,
      updatedAt: new Date(rateCards.updatedAt).toISOString(),
      countries: rateCards.countries,
    });
  } catch (error) {
    console.error('Error loading WhatsApp rate cards:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to load WhatsApp rate cards',
    });
  }
});

app.post('/api/sms-pricing', async (req, res) => {
  try {
    const { accountSid, authToken, countryCode } = req.body;

    if (!accountSid || !authToken) {
      return res.status(400).json({
        error: 'Missing required Twilio credentials'
      });
    }

    if (!countryCode || typeof countryCode !== 'string') {
      return res.status(400).json({
        error: 'Country code is required (ISO-2, e.g., US, GB, FR)'
      });
    }

    const normalizedCountryCode = countryCode.toUpperCase().trim();
    const client = twilio(accountSid, authToken);
    const country = await client.pricing.v1.messaging.countries(normalizedCountryCode).fetch();

    const estimatedOutboundPrice = extractEstimatedSmsPrice(country);

    res.json({
      countryCode: normalizedCountryCode,
      country: country?.country || normalizedCountryCode,
      priceUnit: country?.priceUnit || country?.price_unit || 'USD',
      estimatedOutboundPrice,
      source: 'twilio-pricing-api'
    });
  } catch (error) {
    console.error('Error fetching SMS pricing:', error);

    if (error.code === 20003) {
      return res.status(401).json({
        error: 'Authentication failed - check your Account SID and Auth Token'
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to fetch SMS pricing'
    });
  }
});

// Bulk SMS endpoint
app.post('/api/send-bulk-sms', async (req, res) => {
  try {
    const { contacts, message, contentTemplate, twilioConfig, senderConfig, channel = 'sms', messageDelay = 1000 } = req.body;
    const normalizedChannel = normalizeChannel(channel);

    if (!normalizedChannel) {
      return res.status(400).json({
        error: `Invalid channel. Must be one of: ${SUPPORTED_CHANNELS.join(', ')}`
      });
    }

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ 
        error: 'Contacts array is required and must not be empty' 
      });
    }

    if (contacts.length > 100) {
      return res.status(400).json({ 
        error: 'Maximum 100 contacts allowed per request' 
      });
    }

    const { accountSid, authToken } = twilioConfig;

    if (!accountSid || !authToken) {
      return res.status(400).json({ 
        error: 'Missing Twilio credentials (Account SID and Auth Token required)' 
      });
    }

    // Validate sender configuration
    if (!senderConfig) {
      return res.status(400).json({ 
        error: 'Sender configuration is required' 
      });
    }

    if (senderConfig.type === 'phone') {
      if (!senderConfig.phoneNumber) {
        return res.status(400).json({ 
          error: 'Phone number is required when using phone sender type' 
        });
      }
      if (!isValidPhoneNumber(senderConfig.phoneNumber)) {
        return res.status(400).json({ 
          error: 'Invalid phone number format' 
        });
      }
    } else if (senderConfig.type === 'messaging-service') {
      if (!senderConfig.messagingServiceSid) {
        return res.status(400).json({ 
          error: 'Messaging Service SID is required when using messaging service sender type' 
        });
      }
    } else {
      return res.status(400).json({ 
        error: 'Invalid sender type. Must be "phone" or "messaging-service"' 
      });
    }

    const client = twilio(accountSid, authToken);
    const results = {
      successful: [],
      failed: []
    };

    const useContentTemplate = normalizedChannel === 'whatsapp' && contentTemplate?.contentSid;

    if (!useContentTemplate && (!message || !message.trim())) {
      return res.status(400).json({
        error: 'Message content is required when no content template is selected'
      });
    }

    if (normalizedChannel === 'whatsapp' && contentTemplate && !contentTemplate.contentSid) {
      return res.status(400).json({
        error: 'Invalid content template configuration'
      });
    }

    // Send SMS to each contact with delay to avoid rate limiting
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      try {
        // Handle both contact objects and simple phone number strings
        const phoneNumber = typeof contact === 'string' ? contact : contact.phone;
        const normalizedPhone = phoneNumber?.replace(/^whatsapp:/i, '').trim();
        
        if (!isValidPhoneNumber(normalizedPhone)) {
          results.failed.push({
            phone: normalizedPhone,
            error: 'Invalid phone number format'
          });
          continue;
        }

        // Prepare message parameters based on sender configuration
        const messageParams = {
          to: formatAddressForChannel(normalizedPhone, normalizedChannel)
        };

        if (useContentTemplate) {
          const personalizedVariables = personalizeTemplateVariables(contentTemplate.variables, contact);
          messageParams.contentSid = contentTemplate.contentSid;
          if (Object.keys(personalizedVariables).length > 0) {
            messageParams.contentVariables = JSON.stringify(personalizedVariables);
          }
        } else {
          const personalizedMessage = typeof contact === 'object'
            ? personalizeMessage(message, contact)
            : message;

          messageParams.body = personalizedMessage;
        }

        // Set sender based on configuration
        if (senderConfig.type === 'phone') {
          messageParams.from = formatAddressForChannel(senderConfig.phoneNumber, normalizedChannel);
        } else if (senderConfig.type === 'messaging-service') {
          messageParams.messagingServiceSid = senderConfig.messagingServiceSid;
        }

        const smsResponse = await client.messages.create(messageParams);

        results.successful.push({
          phone: normalizedPhone,
          messageSid: smsResponse.sid,
          status: smsResponse.status
        });

        // Add delay between messages to respect rate limits (skip if messageDelay is 0)
        if (i < contacts.length - 1 && messageDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, messageDelay));
        }

      } catch (error) {
        const phoneNumber = typeof contact === 'string' ? contact : contact.phone;
        const normalizedPhone = phoneNumber?.replace(/^whatsapp:/i, '').trim();
        results.failed.push({
          phone: normalizedPhone,
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
    console.error('Bulk SMS error:', error);
    res.status(500).json({ 
      error: 'Internal server error while sending bulk SMS' 
    });
  }
});

// Scheduled SMS endpoint
app.post('/api/schedule-sms', async (req, res) => {
  try {
    const { contacts, message, contentTemplate, twilioConfig, senderConfig, channel = 'sms', scheduledDateTime, messageDelay = 1000 } = req.body;
    const normalizedChannel = normalizeChannel(channel);

    if (!normalizedChannel) {
      return res.status(400).json({
        error: `Invalid channel. Must be one of: ${SUPPORTED_CHANNELS.join(', ')}`
      });
    }

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ 
        error: 'Contacts array is required and must not be empty' 
      });
    }

    if (contacts.length > 1000) {
      return res.status(400).json({ 
        error: 'Maximum 1000 contacts allowed for scheduled SMS' 
      });
    }

    if (!scheduledDateTime) {
      return res.status(400).json({ 
        error: 'Scheduled date and time is required' 
      });
    }

    const scheduleDate = new Date(scheduledDateTime);
    const now = new Date();

    if (scheduleDate <= now) {
      return res.status(400).json({ 
        error: 'Scheduled time must be in the future' 
      });
    }

    const { accountSid, authToken } = twilioConfig;

    if (!accountSid || !authToken) {
      return res.status(400).json({ 
        error: 'Missing Twilio credentials (Account SID and Auth Token required)' 
      });
    }

    const useContentTemplate = normalizedChannel === 'whatsapp' && contentTemplate?.contentSid;

    if (!useContentTemplate && (!message || !message.trim())) {
      return res.status(400).json({
        error: 'Message content is required when no content template is selected'
      });
    }

    if (normalizedChannel === 'whatsapp' && contentTemplate && !contentTemplate.contentSid) {
      return res.status(400).json({
        error: 'Invalid content template configuration'
      });
    }

    // Validate sender configuration
    if (!senderConfig) {
      return res.status(400).json({ 
        error: 'Sender configuration is required' 
      });
    }

    if (senderConfig.type === 'phone') {
      if (!senderConfig.phoneNumber) {
        return res.status(400).json({ 
          error: 'Phone number is required when using phone sender type' 
        });
      }
      if (!isValidPhoneNumber(senderConfig.phoneNumber)) {
        return res.status(400).json({ 
          error: 'Invalid phone number format' 
        });
      }
    } else if (senderConfig.type === 'messaging-service') {
      if (!senderConfig.messagingServiceSid) {
        return res.status(400).json({ 
          error: 'Messaging Service SID is required when using messaging service sender type' 
        });
      }
    } else {
      return res.status(400).json({ 
        error: 'Invalid sender type. Must be "phone" or "messaging-service"' 
      });
    }

    // Generate unique job ID
    const jobId = uuidv4();
    
    // Store job data
    const jobData = {
      jobId,
      contacts: contacts.filter(contact => {
        const phone = typeof contact === 'string' ? contact : contact.phone;
        return isValidPhoneNumber(phone);
      }),
      message,
      contentTemplate,
      twilioConfig,
      senderConfig,
      channel: normalizedChannel,
      scheduledDateTime: scheduleDate,
      status: 'scheduled',
      messageDelay
    };

    scheduledJobs.set(jobId, jobData);

    // Calculate time difference for setTimeout (more reliable for one-time jobs)
    const timeDifference = scheduleDate.getTime() - now.getTime();
    
    console.log(`SMS scheduled for ${scheduleDate.toLocaleString()} with job ID: ${jobId}`);
    console.log(`Will execute in ${Math.round(timeDifference / 1000)} seconds`);

    // Use setTimeout for one-time scheduled execution and store the timeout ID
    const timeoutId = setTimeout(async () => {
      console.log(`Executing scheduled SMS job ${jobId} at ${new Date().toLocaleString()}`);
      const job = scheduledJobs.get(jobId);
      
      if (job && job.status === 'scheduled') {
        job.status = 'running';
        await sendBulkSMSJob(job);
      } else {
        console.log(`❌ Job ${jobId} not found or already processed`);
      }
      
      // Clean up timeout reference after execution
      scheduledTimeouts.delete(jobId);
    }, timeDifference);

    // Store timeout ID for potential cancellation
    scheduledTimeouts.set(jobId, timeoutId);

    res.json({
      success: true,
      jobId,
      channel: normalizedChannel,
      scheduledDateTime: scheduleDate.toISOString(),
      contactCount: jobData.contacts.length,
      message: 'Messages successfully scheduled'
    });

  } catch (error) {
    console.error('Schedule SMS error:', error);
    res.status(500).json({ 
      error: 'Internal server error while scheduling SMS' 
    });
  }
});

// Get scheduled jobs endpoint
app.get('/api/scheduled-jobs', (req, res) => {
  const jobs = Array.from(scheduledJobs.values()).map(job => ({
    jobId: job.jobId,
    channel: job.channel || 'sms',
    contentTemplate: job.contentTemplate
      ? {
          contentSid: job.contentTemplate.contentSid,
          friendlyName: job.contentTemplate.friendlyName,
        }
      : null,
    scheduledDateTime: job.scheduledDateTime,
    contactCount: job.contacts.length,
    status: job.status,
    message: job.message
      ? job.message.substring(0, 50) + (job.message.length > 50 ? '...' : '')
      : `Template: ${job.contentTemplate?.friendlyName || job.contentTemplate?.contentSid || 'Twilio Content Template'}`
  }));

  res.json({ jobs, totalJobs: jobs.length });
});

// Cancel a scheduled job endpoint
app.delete('/api/scheduled-jobs/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  try {
    const job = scheduledJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ 
        error: 'Scheduled job not found' 
      });
    }
    
    if (job.status !== 'scheduled') {
      return res.status(400).json({ 
        error: `Cannot cancel job with status: ${job.status}` 
      });
    }
    
    // Clear the timeout to prevent execution
    const timeoutId = scheduledTimeouts.get(jobId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      scheduledTimeouts.delete(jobId);
      console.log(`⏹️  Cancelled scheduled timeout for job ${jobId}`);
    }
    
    // Remove from scheduled jobs
    scheduledJobs.delete(jobId);
    
    console.log(`🗑️  Successfully cancelled scheduled job ${jobId}`);
    
    res.json({ 
      success: true, 
      message: 'Scheduled job cancelled successfully',
      jobId: jobId 
    });
    
  } catch (error) {
    console.error(`Error cancelling job ${jobId}:`, error);
    res.status(500).json({ 
      error: 'Internal server error while cancelling job' 
    });
  }
});

// Get completed job results endpoint
app.get('/api/job-results/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  const jobResult = completedJobs.get(jobId);
  
  if (!jobResult) {
    return res.status(404).json({ 
      error: 'Job not found or still pending' 
    });
  }
  
  res.json(jobResult);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Bulk Sender API running on http://localhost:${PORT}`);
  console.log(`Ready to send SMS and WhatsApp messages via Twilio`);
});
