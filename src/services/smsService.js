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