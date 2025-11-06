import { useState, useEffect } from 'react'
import { Send, Clock, Calendar, Users, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react'
import ScheduleSuccessModal from './ScheduleSuccessModal'

const SendingPanel = ({ 
  message, 
  contacts, 
  twilioConfig,
  senderConfig,
  canSend = false,
  onSendMessages, 
  onScheduleMessages,
  sending = false,
  progress = 0,
  results = null,
  scheduledSending = {},
  updateScheduling,
  lastScheduledMessage = null,
  clearLastScheduledMessage,
  messageDelay = 1000
}) => {
  const [sendingMode, setSendingMode] = useState('immediate')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const estimatedCost = (contacts?.length || 0) * 0.0075 // Base cost estimation

  // Show modal when a message is scheduled
  useEffect(() => {
    if (lastScheduledMessage && !showSuccessModal) {
      setShowSuccessModal(true)
    }
  }, [lastScheduledMessage, showSuccessModal])

  // Handle modal close - also clear the scheduled message notification
  const handleModalClose = () => {
    setShowSuccessModal(false)
    if (clearLastScheduledMessage) {
      clearLastScheduledMessage()
    }
  }

  const handleSendNow = async () => {
    if (!canSend) return

    setIsProcessing(true)

    try {
      if (onSendMessages) {
        await onSendMessages()
      }
    } catch (error) {
      console.error('Send error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSchedule = async () => {
    if (!canSend || !scheduledSending.scheduledDate || !scheduledSending.scheduledTime) return
    
    setIsProcessing(true)
    try {
      if (onScheduleMessages) {
        const result = await onScheduleMessages({
          message,
          contacts,
          twilioConfig,
          senderConfig,
          messageDelay
        })
        // Show success modal instead of alert
        setShowSuccessModal(true)
      }
    } catch (error) {
      console.error('Schedule error:', error)
      alert(`Failed to schedule messages: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const getMinDateTime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 5) // Minimum 5 minutes from now
    return now.toISOString().slice(0, 16)
  }

  return (
    <div className="space-y-6">
      {/* Sending Mode Selection */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Sending Method</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setSendingMode('immediate')}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              sendingMode === 'immediate'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center mb-2">
              <Send className="w-6 h-6 text-green-500 mr-3" />
              <span className="font-semibold text-gray-900">Send Now</span>
            </div>
            <p className="text-sm text-gray-600">Send messages immediately to all contacts</p>
          </button>

          <button
            onClick={() => setSendingMode('scheduled')}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              sendingMode === 'scheduled'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center mb-2">
              <Clock className="w-6 h-6 text-blue-500 mr-3" />
              <span className="font-semibold text-gray-900">Schedule</span>
            </div>
            <p className="text-sm text-gray-600">Schedule messages for later delivery</p>
          </button>
        </div>
      </div>

      {/* Scheduling Options */}
      {sendingMode === 'scheduled' && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Schedule Details
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={scheduledSending.scheduledDate || ''}
                onChange={(e) => updateScheduling && updateScheduling({ scheduledDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={scheduledSending.scheduledTime || ''}
                onChange={(e) => updateScheduling && updateScheduling({ scheduledTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow"
              />
            </div>
          </div>
          
          {scheduledSending.scheduledDate && scheduledSending.scheduledTime && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Scheduled for:</strong> {new Date(`${scheduledSending.scheduledDate}T${scheduledSending.scheduledTime}`).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pre-Send Summary */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">Send Summary</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-2">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600">{contacts?.length || 0}</div>
            <div className="text-sm text-gray-600">Recipients</div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-2">
              <Send className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">{message.length}</div>
            <div className="text-sm text-gray-600">Characters</div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-600">${estimatedCost.toFixed(2)}</div>
            <div className="text-sm text-gray-600">Est. Cost</div>
          </div>
        </div>

        {/* Readiness Checks */}
        <div className="space-y-2">
          <div className={`flex items-center text-sm ${canSend ? 'text-green-600' : 'text-red-600'}`}>
            {canSend ? <CheckCircle className="w-4 h-4 mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
            <span>{canSend ? 'All requirements met' : 'Requirements not met'}</span>
          </div>
          
          {!canSend && !message.trim() && (
            <div className="flex items-center text-sm text-red-600">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span>Message is required</span>
            </div>
          )}
          
          {!canSend && (!contacts || contacts.length === 0) && (
            <div className="flex items-center text-sm text-red-600">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span>No contacts uploaded</span>
            </div>
          )}
          
          {!canSend && (!twilioConfig?.accountSid || !twilioConfig?.authToken) && (
            <div className="flex items-center text-sm text-red-600">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span>Twilio credentials incomplete</span>
            </div>
          )}

          {!canSend && twilioConfig?.accountSid && twilioConfig?.authToken && (
            <div className="flex items-center text-sm text-red-600">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span>Sender configuration incomplete</span>
            </div>
          )}
        </div>
      </div>

      {/* Send Progress */}
      {(sending || progress > 0) && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Sending Progress</h4>
          
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div 
              className="bg-green-500 h-3 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="flex justify-between text-sm text-gray-600">
            <span>{Math.round(progress)}% complete</span>
            {results && (
              <span>
                {results.success || 0} sent, {results.failed || 0} failed
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        {sendingMode === 'immediate' ? (
          <button
            onClick={handleSendNow}
            disabled={!canSend || isProcessing}
            className={`flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg text-base font-medium text-white transition-colors ${
              canSend && !isProcessing
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <>
                <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Send Now
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleSchedule}
            disabled={!canSend || !scheduledSending.scheduledDate || !scheduledSending.scheduledTime || isProcessing}
            className={`flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg text-base font-medium text-white transition-colors ${
              canSend && scheduledSending.scheduledDate && scheduledSending.scheduledTime && !isProcessing
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <>
                <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                Scheduling...
              </>
            ) : (
              <>
                <Clock className="w-5 h-5 mr-2" />
                Schedule Messages
              </>
            )}
          </button>
        )}
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-yellow-900 mb-2">⚠️ Important Notes</h4>
        <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
          <li>Messages will be charged to your Twilio account</li>
          <li>Make sure you have sufficient Twilio account balance</li>
          <li>Test with a small group first if unsure</li>
          <li>Scheduled messages can be cancelled before sending time</li>
        </ul>
      </div>

      {/* Schedule Success Modal */}
      <ScheduleSuccessModal 
        isOpen={showSuccessModal}
        onClose={handleModalClose}
        scheduledMessage={lastScheduledMessage}
      />
    </div>
  )
}

export default SendingPanel
