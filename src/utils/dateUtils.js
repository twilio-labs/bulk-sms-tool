/**
 * Date and time formatting utilities for scheduling
 */

export const SCHEDULE_CONSTRAINTS = {
  MIN_MINUTES_AHEAD: 15,
  MAX_DAYS_AHEAD: 7,
}

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
 * Returns validation error for scheduling window constraints.
 * Constraints: at least 15 minutes in future and no more than 7 days ahead.
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {string} timeStr - Time string (HH:MM)
 * @returns {string|null} - Error message or null when valid
 */
export const getScheduledTimeValidationError = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return 'Please set both date and time for scheduled sending'

  const scheduledDateTime = new Date(`${dateStr}T${timeStr}`)
  if (isNaN(scheduledDateTime.getTime())) return 'Invalid date or time format'

  const now = new Date()
  const minAllowedTime = new Date(now.getTime() + SCHEDULE_CONSTRAINTS.MIN_MINUTES_AHEAD * 60 * 1000)
  const maxAllowedTime = new Date(now.getTime() + SCHEDULE_CONSTRAINTS.MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000)

  if (scheduledDateTime < minAllowedTime) {
    return `Scheduled time must be at least ${SCHEDULE_CONSTRAINTS.MIN_MINUTES_AHEAD} minutes in the future`
  }

  if (scheduledDateTime > maxAllowedTime) {
    return `Scheduled time must be no more than ${SCHEDULE_CONSTRAINTS.MAX_DAYS_AHEAD} days in advance`
  }

  return null
}

export const isScheduledTimeValid = (dateStr, timeStr) => {
  return !getScheduledTimeValidationError(dateStr, timeStr)
}
