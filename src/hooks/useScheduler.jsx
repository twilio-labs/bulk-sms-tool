import { useState, useEffect, useCallback, useRef } from 'react'
import { getScheduledJobs, getJobResults, scheduleSMS, cancelScheduledJob as cancelScheduledJobAPI } from '../services/smsService'
import { isScheduledTimeValid, combineDateTime } from '../utils/dateUtils'

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
  const [scheduledJobs, setScheduledJobs] = useState([])
  
  // Ref to track completion monitoring timers
  const completionTimers = useRef(new Map())

  const checkActiveJobs = useCallback(async () => {
    try {
      const data = await getScheduledJobs()
      setHasActiveScheduledJobs(data.totalJobs > 0)
      return data
    } catch (error) {
      // Only log error if it's not a rate limiting issue
      if (!error.message.includes('429') && !error.message.includes('Too Many Requests')) {
        console.error('Error checking active jobs:', error)
      }
      return null
    }
  }, [])

  const checkJobResults = useCallback(async (jobId) => {
    try {
      const jobResult = await getJobResults(jobId)
      if (jobResult) {
        setJobResults(jobResult)
        return jobResult
      }
      return null
    } catch (error) {
      console.error('Error checking job results:', error)
      return null
    }
  }, [])

  // Monitor a specific job for completion
  const monitorJobCompletion = useCallback((jobId, scheduledTime) => {
    console.log(`Starting to monitor job completion for job ${jobId}`)
    
    // Clear any existing timer for this job
    if (completionTimers.current.has(jobId)) {
      clearInterval(completionTimers.current.get(jobId))
      completionTimers.current.delete(jobId)
    }

    const scheduledDate = new Date(scheduledTime)
    const now = new Date()
    
    // Calculate when to start checking (at scheduled time)
    const delayUntilScheduled = Math.max(0, scheduledDate.getTime() - now.getTime())
    
    console.log(`Job ${jobId} scheduled for ${scheduledDate.toLocaleString()}, will start monitoring in ${delayUntilScheduled}ms`)
    
    setTimeout(() => {
      console.log(`Starting monitoring interval for job ${jobId}`)
      
      // Start checking every 10 seconds once the job should have started
      const checkInterval = setInterval(async () => {
        console.log(`Checking completion status for job ${jobId}`)
        try {
          const data = await getScheduledJobs()
          const job = data.jobs?.find(j => j.jobId === jobId)
          
          console.log(`Job ${jobId} current status:`, job?.status)
          
          if (job && (job.status === 'sent' || job.status === 'failed')) {
            console.log(`Job ${jobId} completed with status: ${job.status}! Updating UI...`)
            // Job completed! Update the local state
            setScheduledJobs(prev => 
              prev.map(j => j.id === jobId ? { ...j, status: job.status } : j)
            )
            
            // Clear the monitoring interval
            clearInterval(checkInterval)
            completionTimers.current.delete(jobId)
          }
        } catch (error) {
          console.error('Error monitoring job completion:', error)
        }
      }, 5000) // Check every 5 seconds
      
      // Store the interval reference
      completionTimers.current.set(jobId, checkInterval)
      
      // Auto-cleanup after 30 minutes to prevent infinite polling
      setTimeout(() => {
        if (completionTimers.current.has(jobId)) {
          console.log(`Auto-cleanup: stopping monitoring for job ${jobId}`)
          clearInterval(completionTimers.current.get(jobId))
          completionTimers.current.delete(jobId)
        }
      }, 30 * 60 * 1000) // 30 minutes
      
    }, delayUntilScheduled)
  }, [])

  const scheduleMessage = useCallback(async ({ contacts, message, twilioConfig, senderConfig, messageDelay = 1000 }) => {
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
      const result = await scheduleSMS({
        contacts,
        message,
        twilioConfig,
        senderConfig,
        scheduledDateTime,
        messageDelay
      })

      // Store job ID and message details for tracking
      setScheduledSending(prev => ({
        ...prev,
        lastJobId: result.jobId
      }))

      // Store the scheduled message details
      setLastScheduledMessage({
        jobId: result.jobId,
        message: message,
        contacts: contacts,
        scheduledDateTime: scheduledDateTime,
        scheduledFor: new Date(scheduledDateTime).toLocaleString(),
        contactCount: contacts.length,
        createdAt: new Date().toISOString()
      })

      // Add to scheduled jobs list
      const newJob = {
        id: result.jobId || `job_${Date.now()}`,
        scheduledTime: scheduledDateTime,
        message,
        recipients: contacts,
        totalDuration: new Date(scheduledDateTime).getTime() - Date.now(),
        createdAt: new Date().toISOString()
      }
      setScheduledJobs(prev => [...prev, newJob])

      // Start monitoring this job for completion
      monitorJobCompletion(result.jobId, scheduledDateTime)

      return result
    } catch (error) {
      throw new Error(`Failed to schedule SMS: ${error.message}`)
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
      // Call backend API to actually cancel the job and clear timeout
      await cancelScheduledJobAPI(jobId)
      
      // Clear completion monitoring
      if (completionTimers.current.has(jobId)) {
        clearInterval(completionTimers.current.get(jobId))
        completionTimers.current.delete(jobId)
      }
      
      // Remove from local state only after successful API call
      setScheduledJobs(prev => prev.filter(job => job.id !== jobId))
      
      // If cancelling the last scheduled message, clear it
      if (lastScheduledMessage && lastScheduledMessage.jobId === jobId) {
        setLastScheduledMessage(null)
      }
      
      // Update scheduled sending state if this was the current job
      if (scheduledSending.lastJobId === jobId) {
        setScheduledSending(prev => ({ ...prev, lastJobId: null }))
      }
      
      console.log(`✅ Successfully cancelled job ${jobId}`)
      
    } catch (error) {
      console.error(`❌ Failed to cancel job ${jobId}:`, error)
      // Optionally show user error message
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

  // Manual refresh function for when users want to check job status
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      completionTimers.current.forEach((timer) => {
        clearInterval(timer)
      })
      completionTimers.current.clear()
    }
  }, [])

  const refreshJobs = useCallback(async () => {
    try {
      const data = await getScheduledJobs()
      if (data?.jobs) {
        setScheduledJobs(data.jobs.map(job => ({
          id: job.jobId,
          scheduledTime: job.scheduledDateTime,
          contactCount: job.contactCount,
          status: job.status,
          message: job.message
        })))
      }
    } catch (error) {
      console.error('Error refreshing jobs:', error)
    }
  }, [])

  // Remove automatic status checking - jobs will be updated when they actually complete
  // The server handles job execution and will mark jobs as complete

  // Auto-check for active jobs on mount only (disable periodic polling to prevent 429 errors)
  useEffect(() => {
    checkActiveJobs()
    // Removed setInterval to prevent 429 errors
    // const interval = setInterval(checkActiveJobs, POLLING_INTERVALS.ACTIVE_JOBS_CHECK)
    // return () => clearInterval(interval)
  }, [checkActiveJobs])

  // Remove all periodic polling - only check jobs when they actually complete
  // The server will handle job execution and completion
  useEffect(() => {
    // Only check once on mount, no more periodic polling
    checkActiveJobs()
  }, [checkActiveJobs])

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
