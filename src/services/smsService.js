import { API_ENDPOINTS } from '../utils/constants'

/**
 * Sends bulk SMS messages
 * @param {Object} params - Bulk SMS parameters
 * @param {Array} params.contacts - Array of contacts
 * @param {string} params.message - Message content
 * @param {Object} params.twilioConfig - Twilio configuration
 * @param {Object} params.senderConfig - Sender configuration
 * @param {number} params.messageDelay - Delay between messages in milliseconds
 * @returns {Promise<Object>} - API response
 */
export const sendBulkSMS = async ({ contacts, message, twilioConfig, senderConfig, messageDelay = 1000 }) => {
  const response = await fetch(API_ENDPOINTS.SEND_BULK_SMS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contacts,
      message,
      twilioConfig,
      senderConfig,
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
 * Schedules SMS messages for later delivery
 * @param {Object} params - Scheduling parameters
 * @param {Array} params.contacts - Array of contacts
 * @param {string} params.message - Message content
 * @param {Object} params.twilioConfig - Twilio configuration
 * @param {Object} params.senderConfig - Sender configuration
 * @param {string} params.scheduledDateTime - ISO date string
 * @param {number} params.messageDelay - Delay between messages in milliseconds
 * @returns {Promise<Object>} - API response with job ID
 */
export const scheduleSMS = async ({ contacts, message, twilioConfig, senderConfig, scheduledDateTime, messageDelay = 1000 }) => {
  const response = await fetch(API_ENDPOINTS.SCHEDULE_SMS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contacts,
      message,
      twilioConfig,
      senderConfig,
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