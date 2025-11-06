import express from 'express';
import cors from 'cors';
import twilio from 'twilio';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many SMS requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// In-memory storage for scheduled jobs (in production, use a database)
const scheduledJobs = new Map();
const scheduledTimeouts = new Map(); // Store timeout IDs for cancellation

// Validate phone number format
const isValidPhoneNumber = (phone) => {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
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

// Function to send bulk SMS
const sendBulkSMSJob = async (jobData) => {
  const { contacts, message, twilioConfig, senderConfig, jobId, messageDelay = 1000 } = jobData;
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
      if (!isValidPhoneNumber(contact.phone)) {
        throw new Error('Invalid phone number format');
      }

      // Personalize the message for this contact
      const personalizedMessage = personalizeMessage(message, contact);

      // Prepare message parameters based on sender configuration
      const messageParams = {
        body: personalizedMessage,
        to: contact.phone
      };

      // Set sender based on configuration
      if (senderConfig.type === 'phone') {
        messageParams.from = senderConfig.phoneNumber;
      } else if (senderConfig.type === 'messaging-service') {
        messageParams.messagingServiceSid = senderConfig.messagingServiceSid;
      }

      const smsResponse = await client.messages.create(messageParams);

      successCount++;
      results.successful.push({
        phone: contact.phone,
        messageSid: smsResponse.sid,
        status: smsResponse.status
      });
      console.log(`SMS sent to ${contact.phone}`);
      
      // Add delay to avoid rate limiting (skip if messageDelay is 0)
      if (messageDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, messageDelay));
      }
      
    } catch (error) {
      failedCount++;
      const errorMsg = `${contact.phone}: ${error.message}`;
      errors.push(errorMsg);
      results.failed.push({
        phone: contact.phone,
        error: error.message,
        code: error.code
      });
      console.error(`❌ Failed to send SMS to ${contact.phone}:`, error.message);
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

// Bulk SMS endpoint
app.post('/api/send-bulk-sms', async (req, res) => {
  try {
    const { contacts, message, twilioConfig, senderConfig, messageDelay = 1000 } = req.body;

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

    // Send SMS to each contact with delay to avoid rate limiting
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      try {
        // Handle both contact objects and simple phone number strings
        const phoneNumber = typeof contact === 'string' ? contact : contact.phone;
        
        if (!isValidPhoneNumber(phoneNumber)) {
          results.failed.push({
            phone: phoneNumber,
            error: 'Invalid phone number format'
          });
          continue;
        }

        // Personalize the message if contact is an object with data
        const personalizedMessage = typeof contact === 'object' 
          ? personalizeMessage(message, contact)
          : message;

        // Prepare message parameters based on sender configuration
        const messageParams = {
          body: personalizedMessage,
          to: phoneNumber
        };

        // Set sender based on configuration
        if (senderConfig.type === 'phone') {
          messageParams.from = senderConfig.phoneNumber;
        } else if (senderConfig.type === 'messaging-service') {
          messageParams.messagingServiceSid = senderConfig.messagingServiceSid;
        }

        const smsResponse = await client.messages.create(messageParams);

        results.successful.push({
          phone: phoneNumber,
          messageSid: smsResponse.sid,
          status: smsResponse.status
        });

        // Add delay between messages to respect rate limits (skip if messageDelay is 0)
        if (i < contacts.length - 1 && messageDelay > 0) {
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
    console.error('Bulk SMS error:', error);
    res.status(500).json({ 
      error: 'Internal server error while sending bulk SMS' 
    });
  }
});

// Scheduled SMS endpoint
app.post('/api/schedule-sms', async (req, res) => {
  try {
    const { contacts, message, twilioConfig, senderConfig, scheduledDateTime, messageDelay = 1000 } = req.body;

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
      contacts: contacts.filter(contact => isValidPhoneNumber(contact.phone)),
      message,
      twilioConfig,
      senderConfig,
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
      scheduledDateTime: scheduleDate.toISOString(),
      contactCount: jobData.contacts.length,
      message: 'SMS successfully scheduled'
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
    scheduledDateTime: job.scheduledDateTime,
    contactCount: job.contacts.length,
    status: job.status,
    message: job.message.substring(0, 50) + (job.message.length > 50 ? '...' : '')
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
  console.log(`SMS Bulk Sender API running on http://localhost:${PORT}`);
  console.log(`Ready to send SMS messages via Twilio`);
});
