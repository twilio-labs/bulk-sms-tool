/**
 * Date and time formatting utilities for scheduling
 */

/**
 * Combines date and time strings into ISO format
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {string} timeStr - Time string (HH:MM)
 * @returns {string} - ISO date string
 */
export const combineDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null
  
  const combinedDateTime = new Date(`${dateStr}T${timeStr}`)
  if (isNaN(combinedDateTime.getTime())) return null
  
  return combinedDateTime.toISOString()
}

/**
 * Validates if scheduled time is in the future
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {string} timeStr - Time string (HH:MM)
 * @returns {boolean} - True if in future, false otherwise
 */
export const isScheduledTimeValid = (dateStr, timeStr) => {
  const scheduledDateTime = new Date(`${dateStr}T${timeStr}`)
  const now = new Date()
  
  return scheduledDateTime > now
}
