import { useState, useEffect } from 'react'
import { Clock, Calendar, Users, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react'

const ScheduledJobsSection = ({ 
  scheduledJobs = [], 
  onCancelScheduledJob,
  onUpdateJobStatus,
  className = '' 
}) => {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [cancellingJobs, setCancellingJobs] = useState(new Set())

  // Remove periodic timer updates - only update when jobs actually complete
  // No more constant polling for time updates
  useEffect(() => {
    // Set initial time only
    setCurrentTime(new Date())
  }, []) // Only run once on mount

  // Handle job cancellation with loading state
  const handleCancelJob = async (jobId) => {
    if (cancellingJobs.has(jobId)) return // Prevent double-clicks
    
    setCancellingJobs(prev => new Set([...prev, jobId]))
    
    try {
      await onCancelScheduledJob(jobId)
    } catch (error) {
      console.error('Failed to cancel job:', error)
      // Optionally show error notification here
    } finally {
      setCancellingJobs(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
    }
  }

  // Calculate time remaining for a scheduled job (static calculation, no live updates)
  const getTimeRemaining = (scheduledTime, jobStatus = null) => {
    // Show status based on job status from server
    if (jobStatus === 'sent') {
      return { sent: true, display: "Sent" }
    }
    
    if (jobStatus === 'failed') {
      return { failed: true, display: "Failed" }
    }

    if (jobStatus === 'running') {
      return { running: true, display: "Sending..." }
    }

    // For scheduled jobs, check if time has passed
    const scheduledDate = new Date(scheduledTime)
    const now = new Date()
    
    if (scheduledDate <= now && !jobStatus) {
      // Time has passed but no status update yet - assume pending
      return { pending: true, display: "Pending" }
    }

    // Show as scheduled with time
    return { 
      scheduled: true, 
      display: `Scheduled for ${scheduledDate.toLocaleString()}` 
    }
  }

  if (scheduledJobs.length === 0) {
    return (
      <div className={`bg-gray-50 rounded-lg p-6 text-center ${className}`}>
        <Clock className="h-8 w-8 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No scheduled messages</p>
        <p className="text-sm text-gray-500 mt-1">
          Scheduled SMS jobs will appear here
        </p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center mb-4">
        <Clock className="h-5 w-5 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">
          Scheduled Messages ({scheduledJobs.length})
        </h3>
      </div>

      {scheduledJobs.map((job) => {
        const timeInfo = getTimeRemaining(job.scheduledTime, job.status)
        const isSent = timeInfo.sent
        const isFailed = timeInfo.failed
        const isRunning = timeInfo.running
        const isPending = timeInfo.pending
        const isScheduled = timeInfo.scheduled

        return (
          <div 
            key={job.id}
            className={`bg-white rounded-lg border p-4 ${
              isSent ? 'border-green-200 bg-green-50' : 
              isFailed ? 'border-red-200 bg-red-50' :
              isRunning ? 'border-yellow-200 bg-yellow-50' :
              isPending ? 'border-orange-200 bg-orange-50' : 'border-gray-200'
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                {/* Job Status & Time */}
                <div className="flex items-center mb-3">
                  <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
                    isSent 
                      ? 'bg-green-100 text-green-700'
                      : isFailed
                      ? 'bg-red-100 text-red-700'
                      : isRunning
                      ? 'bg-yellow-100 text-yellow-700'
                      : isPending
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {isSent ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isFailed ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : isRunning ? (
                      <Clock className="h-4 w-4 animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                    <span>{timeInfo.display}</span>
                  </div>
                  {(isPending || isRunning) && !isSent && !isFailed && (
                    <div className="h-4 w-4 ml-2 rounded-full bg-blue-500 animate-pulse" />
                  )}
                </div>

                {/* Scheduled Time */}
                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>
                    Scheduled for: {new Date(job.scheduledTime).toLocaleString()}
                  </span>
                </div>

                {/* Recipients Count */}
                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <Users className="h-4 w-4 mr-2" />
                  <span>{job.recipients?.length || 0} recipients</span>
                </div>

                {/* Message Preview */}
                <div className="flex items-start text-sm text-gray-600">
                  <MessageSquare className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="line-clamp-2">
                      {(() => {
                        // Replace variables with first contact's data for preview
                        if (job.recipients && job.recipients.length > 0) {
                          const firstContact = job.recipients[0]
                          let preview = job.message || ''
                          Object.keys(firstContact).forEach(key => {
                            if (key !== 'id' && key !== 'status') {
                              const pattern = new RegExp(`\\{${key}\\}`, 'gi')
                              const value = firstContact[key] || ''
                              preview = preview.replace(pattern, value)
                            }
                          })
                          return preview.substring(0, 100) + (preview.length > 100 ? '...' : '')
                        }
                        return (job.message?.substring(0, 100) || '') + (job.message?.length > 100 ? '...' : '')
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cancel Button */}
              <button
                onClick={() => handleCancelJob(job.id)}
                disabled={isPending || isSent || isFailed || isRunning || cancellingJobs.has(job.id)}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                  isPending || isSent || isFailed || isRunning
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : cancellingJobs.has(job.id)
                    ? 'bg-orange-100 text-orange-700 cursor-wait'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
                title={isPending || isSent || isFailed || isRunning ? 'Cannot cancel' : cancellingJobs.has(job.id) ? 'Cancelling...' : 'Cancel scheduled job'}
              >
                {cancellingJobs.has(job.id) ? 'Cancelling...' : 'Cancel'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ScheduledJobsSection