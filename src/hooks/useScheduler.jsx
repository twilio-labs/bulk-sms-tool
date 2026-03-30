import { useState, useEffect, useCallback } from 'react'
import { scheduleSMS } from '../services/smsService'
import { isScheduledTimeValid, combineDateTime } from '../utils/dateUtils'

const SCHEDULED_JOBS_STORAGE_KEY = 'twilio-bulk-scheduled-jobs'

const getStoredScheduledJobs = () => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const stored = window.localStorage.getItem(SCHEDULED_JOBS_STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to read scheduled jobs from local storage:', error)
    return []
  }
}

export const useScheduler = () => {
  const [scheduledSending, setScheduledSending] = useState({
    enabled: false,
    scheduledDate: '',
    scheduledTime: '',
    lastJobId: null
  })
  const [hasActiveScheduledJobs, setHasActiveScheduledJobs] = useState(false)
  const [jobResults, setJobResults] = useState(null)
  const [lastScheduledMessage, setLastScheduledMessage] = useState(null)
  const [scheduledJobs, setScheduledJobs] = useState(getStoredScheduledJobs)

  const checkActiveJobs = useCallback(async () => {
    const activeJobs = scheduledJobs.filter(job => job.status === 'scheduled')
    const data = {
      totalJobs: activeJobs.length,
      jobs: scheduledJobs
    }
    setHasActiveScheduledJobs(activeJobs.length > 0)
    return data
  }, [scheduledJobs])

  const checkJobResults = useCallback(async (jobId) => {
    const job = scheduledJobs.find(item => item.id === jobId)
    if (!job) return null

    const localResult = {
      jobId: job.id,
      status: job.status || 'scheduled',
      scheduledTime: job.scheduledTime,
      channel: job.channel,
      contactCount: job.contactCount || job.recipients?.length || 0,
      messageSids: job.messageSids || []
    }

    setJobResults(localResult)
    return localResult
  }, [scheduledJobs])

  const scheduleMessage = useCallback(async ({ contacts, message, contentTemplate = null, twilioConfig, senderConfig, messageDelay = 1000 }) => {
    const { scheduledDate, scheduledTime } = scheduledSending

    // Validation
    if (!scheduledDate || !scheduledTime) {
      throw new Error('Please set both date and time for scheduled sending')
    }

    if (!isScheduledTimeValid(scheduledDate, scheduledTime)) {
      throw new Error('Scheduled time must be in the future')
    }

    const scheduledDateTime = combineDateTime(scheduledDate, scheduledTime)
    if (!scheduledDateTime) {
      throw new Error('Invalid date or time format')
    }

    try {
      const selectedChannel = senderConfig?.channel || 'sms'

      const result = await scheduleSMS({
        contacts,
        message,
        contentTemplate,
        twilioConfig,
        senderConfig,
        channel: selectedChannel,
        scheduledDateTime,
        messageDelay
      })

      const resolvedJobId = result?.jobId || result?.messageSids?.[0] || `scheduled_${Date.now()}`
      const nowIso = new Date().toISOString()

      // Store job ID and message details for tracking
      setScheduledSending(prev => ({
        ...prev,
        lastJobId: resolvedJobId
      }))

      // Store the scheduled message details
      setLastScheduledMessage({
        jobId: resolvedJobId,
        message: message,
        contentTemplate,
        channel: selectedChannel,
        contacts: contacts,
        scheduledDateTime: scheduledDateTime,
        scheduledFor: new Date(scheduledDateTime).toLocaleString(),
        contactCount: contacts.length,
        createdAt: nowIso
      })

      // Add to scheduled jobs list
      const newJob = {
        id: resolvedJobId,
        contentTemplate,
        channel: selectedChannel,
        status: 'scheduled',
        contactCount: contacts.length,
        scheduledTime: scheduledDateTime,
        message,
        recipients: contacts,
        messageSids: result?.messageSids || [],
        schedulingMode: 'twilio-native',
        totalDuration: new Date(scheduledDateTime).getTime() - Date.now(),
        createdAt: nowIso
      }

      setScheduledJobs(prev => {
        const withoutDuplicate = prev.filter(job => job.id !== newJob.id)
        return [...withoutDuplicate, newJob]
      })

      return {
        ...result,
        jobId: resolvedJobId
      }
    } catch (error) {
      throw new Error(`Failed to schedule messages: ${error.message}`)
    }
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

  const cancelScheduledJob = useCallback(async (jobId) => {
    try {
      // Vercel/serverless deployments do not maintain in-memory job stores.
      // We only remove local tracking here; cancellation in Twilio must be managed in Twilio Console.
      setScheduledJobs(prev => prev.filter(job => job.id !== jobId))
      
      // If cancelling the last scheduled message, clear it
      if (lastScheduledMessage && lastScheduledMessage.jobId === jobId) {
        setLastScheduledMessage(null)
      }
      
      // Update scheduled sending state if this was the current job
      if (scheduledSending.lastJobId === jobId) {
        setScheduledSending(prev => ({ ...prev, lastJobId: null }))
      }
      
      console.log(`Removed scheduled job ${jobId} from local tracking`)
      return { success: true, localOnly: true }
      
    } catch (error) {
      console.error(`❌ Failed to cancel job ${jobId}:`, error)
      throw error
    }
  }, [lastScheduledMessage, scheduledSending.lastJobId])

  const updateJobStatus = useCallback((jobId, status) => {
    setScheduledJobs(prev => 
      prev.map(job => 
        job.id === jobId ? { ...job, status } : job
      )
    )
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(SCHEDULED_JOBS_STORAGE_KEY, JSON.stringify(scheduledJobs))
    } catch (error) {
      console.error('Failed to persist scheduled jobs:', error)
    }
  }, [scheduledJobs])

  const refreshJobs = useCallback(async () => {
    return {
      totalJobs: scheduledJobs.length,
      jobs: scheduledJobs
    }
  }, [scheduledJobs])

  useEffect(() => {
    setHasActiveScheduledJobs(scheduledJobs.some(job => job.status === 'scheduled'))
  }, [scheduledJobs])

  return {
    scheduledSending,
    hasActiveScheduledJobs,
    jobResults,
    lastScheduledMessage,
    scheduledJobs,
    checkActiveJobs,
    checkJobResults,
    scheduleMessage,
    updateScheduling,
    toggleScheduledSending,
    validateScheduling,
    clearScheduling,
    clearLastScheduledMessage,
    cancelScheduledJob,
    updateJobStatus,
    refreshJobs // Add manual refresh function
  }
}
