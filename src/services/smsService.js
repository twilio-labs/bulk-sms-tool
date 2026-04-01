import { API_ENDPOINTS } from '../utils/constants'

/**
 * Sends bulk messages (SMS or WhatsApp)
 * @param {Object} params - Bulk SMS parameters
 * @param {Array} params.contacts - Array of contacts
 * @param {string} params.message - Message content
 * @param {Object} params.twilioConfig - Twilio configuration
 * @param {Object} params.senderConfig - Sender configuration
 * @param {number} params.messageDelay - Delay between messages in milliseconds
 * @returns {Promise<Object>} - API response
 */
export const sendBulkSMS = async ({ contacts, message, contentTemplate = null, twilioConfig, senderConfig, channel = senderConfig?.channel || 'sms', messageDelay = 1000 }) => {
  const response = await fetch(API_ENDPOINTS.SEND_BULK_SMS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contacts,
      message,
      contentTemplate,
      twilioConfig,
      senderConfig,
      channel,
      messageDelay
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Schedules messages (SMS or WhatsApp) for later delivery
 * @param {Object} params - Scheduling parameters
 * @param {Array} params.contacts - Array of contacts
 * @param {string} params.message - Message content
 * @param {Object} params.twilioConfig - Twilio configuration
 * @param {Object} params.senderConfig - Sender configuration
 * @param {string} params.scheduledDateTime - ISO date string
 * @param {number} params.messageDelay - Delay between messages in milliseconds
 * @returns {Promise<Object>} - API response with job ID
 */
export const scheduleSMS = async ({ contacts, message, contentTemplate = null, twilioConfig, senderConfig, channel = senderConfig?.channel || 'sms', scheduledDateTime, messageDelay = 1000 }) => {
  const response = await fetch(API_ENDPOINTS.SCHEDULE_SMS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contacts,
      message,
      contentTemplate,
      twilioConfig,
      senderConfig,
      channel,
      scheduledDateTime,
      messageDelay
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

export const getContentTemplates = async ({ accountSid, authToken, apiKeySid, apiKeySecret, includeUnapproved = false }) => {
  const response = await fetch(API_ENDPOINTS.CONTENT_TEMPLATES, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret,
      includeUnapproved,
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

export const getSmsPricing = async ({ accountSid, authToken, countryCode }) => {
  const response = await fetch(API_ENDPOINTS.SMS_PRICING, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountSid,
      authToken,
      countryCode,
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

export const getWhatsAppRateCards = async () => {
  const response = await fetch(API_ENDPOINTS.WHATSAPP_RATE_CARDS)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Gets scheduled jobs status
 * @returns {Promise<Object>} - List of scheduled jobs
 */
export const getScheduledJobs = async () => {
  const response = await fetch(API_ENDPOINTS.SCHEDULED_JOBS)
  
  if (!response.ok) {
    throw new Error('Failed to fetch scheduled jobs')
  }
  
  return response.json()
}

/**
 * Gets results for a specific job
 * @param {string} jobId - Job ID to check
 * @returns {Promise<Object>} - Job results
 */
export const getJobResults = async (jobId) => {
  const response = await fetch(`${API_ENDPOINTS.JOB_RESULTS}/${jobId}`)
  
  if (response.status === 404) {
    return null // Job not found or still pending
  }
  
  if (!response.ok) {
    throw new Error('Failed to fetch job results')
  }

  return response.json()
}

/**
 * Cancels a scheduled job
 * @param {string} jobId - Job ID to cancel
 * @returns {Promise<Object>} - Cancellation response
 */
export const cancelScheduledJob = async (jobId) => {
  const response = await fetch(`${API_ENDPOINTS.SCHEDULED_JOBS}/${jobId}`, {
    method: 'DELETE',
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to cancel job: ${response.statusText}`)
  }

  return response.json()
}