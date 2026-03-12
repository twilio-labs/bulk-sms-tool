import { useState, useCallback } from 'react'
import { scheduleSMS } from '../services/smsService'
import { isScheduledTimeValid, combineDateTime, getScheduledTimeValidationError } from '../utils/dateUtils'

export const useScheduler = () => {
  const [scheduledSending, setScheduledSending] = useState({
    enabled: false,
    scheduledDate: '',
    scheduledTime: '',
    lastJobId: null
  })

  const [lastScheduledMessage, setLastScheduledMessage] = useState(null)

  const scheduleMessage = useCallback(async ({ contacts, message, twilioConfig, senderConfig, messageDelay = 1000 }) => {
    const { scheduledDate, scheduledTime } = scheduledSending

    const scheduleError = getScheduledTimeValidationError(scheduledDate, scheduledTime)
    if (scheduleError) {
      throw new Error(scheduleError)
    }

    const scheduledDateTime = combineDateTime(scheduledDate, scheduledTime)
    if (!scheduledDateTime) {
      throw new Error('Invalid date or time format')
    }

    const result = await scheduleSMS({
      contacts,
      message,
      twilioConfig,
      senderConfig,
      scheduledDateTime,
      messageDelay
    })

    setScheduledSending(prev => ({
      ...prev,
      lastJobId: null
    }))

    setLastScheduledMessage({
      message,
      contacts,
      scheduledDateTime,
      scheduledFor: new Date(scheduledDateTime).toLocaleString(),
      contactCount: contacts.length,
      messageSids: result.messageSids || [],
      createdAt: new Date().toISOString()
    })

    return result
  }, [scheduledSending])

  const updateScheduling = useCallback((updates) => {
    setScheduledSending(prev => ({ ...prev, ...updates }))
  }, [])

  const toggleScheduledSending = useCallback((enabled) => {
    setScheduledSending(prev => ({ ...prev, enabled }))
  }, [])

  const validateScheduling = useCallback(() => {
    if (!scheduledSending.enabled) return true

    if (!scheduledSending.scheduledDate || !scheduledSending.scheduledTime) {
      return false
    }

    return isScheduledTimeValid(scheduledSending.scheduledDate, scheduledSending.scheduledTime)
  }, [scheduledSending])

  const clearScheduling = useCallback(() => {
    setScheduledSending({
      enabled: false,
      scheduledDate: '',
      scheduledTime: '',
      lastJobId: null
    })
    setLastScheduledMessage(null)
  }, [])

  const clearLastScheduledMessage = useCallback(() => {
    setLastScheduledMessage(null)
  }, [])

  return {
    scheduledSending,
    hasActiveScheduledJobs: false,
    jobResults: null,
    lastScheduledMessage,
    scheduledJobs: [],
    checkActiveJobs: async () => null,
    checkJobResults: async () => null,
    scheduleMessage,
    updateScheduling,
    toggleScheduledSending,
    validateScheduling,
    clearScheduling,
    clearLastScheduledMessage,
    cancelScheduledJob: async () => {
      throw new Error('Cancelling by internal job ID is not supported in stateless deployment mode')
    },
    updateJobStatus: () => {},
    refreshJobs: async () => null
  }
}
