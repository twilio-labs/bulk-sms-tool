import { useState, useEffect, useMemo, useRef } from 'react'
import { Send, Clock, Calendar, Users, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react'
import ScheduleSuccessModal from './ScheduleSuccessModal'
import { getSmsPricing, getWhatsAppRateCards } from '../services/smsService'
import {
  calculateSmsEstimatedTotal,
  calculateWhatsAppEstimatedTotal,
  normalizeWhatsAppTemplateCategory,
  personalizeMessageWithFirstContact,
} from '../utils/pricingUtils'
import { getScheduledTimeValidationError, SCHEDULE_CONSTRAINTS } from '../utils/dateUtils'

const SendingPanel = ({ 
  isMessageConfigured = false,
  contentTemplate = null,
  message, 
  contacts, 
  getMessageAnalytics,
  smsPricingCountry = 'US',
  whatsAppPricingCountry = 'US',
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
  const panelRef = useRef(null)
  const [sendingMode, setSendingMode] = useState('immediate')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [smsEstimatedRate, setSmsEstimatedRate] = useState(null)
  const [smsPricingLoading, setSmsPricingLoading] = useState(false)
  const [whatsAppRateCards, setWhatsAppRateCards] = useState([])
  const [whatsAppRatesLoading, setWhatsAppRatesLoading] = useState(false)
  const [whatsAppTwilioFee, setWhatsAppTwilioFee] = useState(0.005)
  const isTemplateMode = !!contentTemplate?.contentSid
  const isWhatsAppChannel = senderConfig?.channel === 'whatsapp'
  const contactCount = contacts?.length || 0

  const analytics = getMessageAnalytics
    ? getMessageAnalytics(personalizeMessageWithFirstContact(message, contacts))
    : null
  const smsSegments = analytics?.segments || 1

  useEffect(() => {
    if (isWhatsAppChannel) {
      setSmsEstimatedRate(null)
      return
    }

    if (!twilioConfig?.accountSid || !twilioConfig?.authToken) {
      setSmsEstimatedRate(null)
      return
    }

    const loadSmsRate = async () => {
      setSmsPricingLoading(true)
      try {
        const pricing = await getSmsPricing({
          accountSid: twilioConfig.accountSid,
          authToken: twilioConfig.authToken,
          countryCode: smsPricingCountry,
        })

        const rate = typeof pricing?.estimatedOutboundPrice === 'number' ? pricing.estimatedOutboundPrice : null
        setSmsEstimatedRate(rate)
      } catch {
        setSmsEstimatedRate(null)
      } finally {
        setSmsPricingLoading(false)
      }
    }

    loadSmsRate()
  }, [isWhatsAppChannel, twilioConfig?.accountSid, twilioConfig?.authToken, smsPricingCountry])

  useEffect(() => {
    if (!isWhatsAppChannel) {
      return
    }

    const loadWhatsAppRates = async () => {
      setWhatsAppRatesLoading(true)
      try {
        const response = await getWhatsAppRateCards()
        const countries = Array.isArray(response?.countries) ? response.countries : []
        setWhatsAppRateCards(countries)
        if (typeof response?.twilioFeePerMessage === 'number') {
          setWhatsAppTwilioFee(response.twilioFeePerMessage)
        }
      } catch {
        setWhatsAppRateCards([])
      } finally {
        setWhatsAppRatesLoading(false)
      }
    }

    loadWhatsAppRates()
  }, [isWhatsAppChannel])

  const estimatedCost = useMemo(() => {
    if (isWhatsAppChannel) {
      const selectedTemplateCategory = normalizeWhatsAppTemplateCategory(contentTemplate?.whatsappCategory)
      const { totalCost } = calculateWhatsAppEstimatedTotal({
        rateCards: whatsAppRateCards,
        countryCode: whatsAppPricingCountry,
        templateCategory: selectedTemplateCategory,
        twilioFeePerMessage: whatsAppTwilioFee,
        contactCount,
      })

      return totalCost ?? 0
    }

    const { totalCost } = calculateSmsEstimatedTotal({
      estimatedRate: smsEstimatedRate,
      segments: smsSegments,
      contactCount,
    })

    return totalCost
  }, [
    isWhatsAppChannel,
    contentTemplate?.whatsappCategory,
    whatsAppRateCards,
    whatsAppPricingCountry,
    whatsAppTwilioFee,
    contactCount,
    smsEstimatedRate,
    smsSegments,
  ])
  const hasMessagingServiceConfigured = senderConfig?.type === 'messaging-service' && Boolean(senderConfig?.messagingServiceSid)
  const pricingLoading = isWhatsAppChannel ? whatsAppRatesLoading : smsPricingLoading
  const scheduleWindowError = getScheduledTimeValidationError(
    scheduledSending?.scheduledDate,
    scheduledSending?.scheduledTime
  )

  // Show modal when a message is scheduled
  useEffect(() => {
    if (lastScheduledMessage && !showSuccessModal) {
      setShowSuccessModal(true)
    }
  }, [lastScheduledMessage, showSuccessModal])

  useEffect(() => {
    if (!showSuccessModal || typeof window === 'undefined') {
      return
    }

    const isScrollable = (element) => {
      if (!element) return false

      const style = window.getComputedStyle(element)
      const overflowY = style.overflowY
      return (overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight
    }

    let scrollParent = panelRef.current?.parentElement || null
    while (scrollParent && !isScrollable(scrollParent)) {
      scrollParent = scrollParent.parentElement
    }

    if (scrollParent) {
      scrollParent.scrollTo({ top: 0, behavior: 'smooth' })
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [showSuccessModal])

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
    if (!canSend || !scheduledSending.scheduledDate || !scheduledSending.scheduledTime || !hasMessagingServiceConfigured || scheduleWindowError) return
    
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
    <div ref={panelRef} className="space-y-6">
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

        {pricingLoading && (
          <div className="flex items-center bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-800 text-sm font-medium mb-4">
            <Clock className="w-4 h-4 mr-2 animate-spin" />
            Updating {isWhatsAppChannel ? 'WhatsApp' : 'SMS'} pricing...
          </div>
        )}
        
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 ${pricingLoading ? 'opacity-75' : ''}`}>
          <div className={`bg-blue-50 rounded-lg p-3 text-center ${pricingLoading ? 'animate-pulse' : ''}`}>
            <div className="flex items-center justify-center mb-2">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600">{contacts?.length || 0}</div>
            <div className="text-sm text-gray-600">Recipients</div>
          </div>
          
          <div className={`bg-green-50 rounded-lg p-3 text-center ${pricingLoading ? 'animate-pulse' : ''}`}>
            <div className="flex items-center justify-center mb-2">
              <Send className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">{isTemplateMode ? 'TPL' : message.length}</div>
            <div className="text-sm text-gray-600">{isTemplateMode ? 'Template' : 'Characters'}</div>
          </div>
          
          <div className={`bg-purple-50 rounded-lg p-3 text-center ${pricingLoading ? 'animate-pulse' : ''}`}>
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {pricingLoading ? 'Loading...' : `$${estimatedCost.toFixed(4)}`}
            </div>
            <div className="text-sm text-gray-600">Est. Cost</div>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Based on {isWhatsAppChannel ? `WhatsApp ${whatsAppPricingCountry}` : `SMS ${smsPricingCountry}`} pricing selection from Analytics.
        </p>

        {/* Readiness Checks */}
        <div className="space-y-2">
          <div className={`flex items-center text-sm ${canSend ? 'text-green-600' : 'text-red-600'}`}>
            {canSend ? <CheckCircle className="w-4 h-4 mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
            <span>{canSend ? 'All requirements met' : 'Requirements not met'}</span>
          </div>
          
          {!canSend && !isMessageConfigured && (
            <div className="flex items-center text-sm text-red-600">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span>{isTemplateMode ? 'Template variables are incomplete' : 'Message is required'}</span>
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
              <span className="text-right">
                {results.success || 0} sent, {results.failed || 0} failed{' '}
                <a
                  href="https://console.twilio.com/us1/monitor/logs/sms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-600 hover:text-blue-700"
                >
                  More details
                </a>
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
          <div
            className="flex-1"
            title={!hasMessagingServiceConfigured ? 'Scheduling requires Sender Type: Messaging Service with a Messaging Service SID.' : ''}
          >
            <button
              onClick={handleSchedule}
              disabled={!canSend || !scheduledSending.scheduledDate || !scheduledSending.scheduledTime || !hasMessagingServiceConfigured || Boolean(scheduleWindowError) || isProcessing}
              className={`w-full inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg text-base font-medium text-white transition-colors ${
                canSend && scheduledSending.scheduledDate && scheduledSending.scheduledTime && hasMessagingServiceConfigured && !scheduleWindowError && !isProcessing
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
          </div>
        )}
      </div>

      {sendingMode === 'scheduled' && !hasMessagingServiceConfigured && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Scheduling requires <strong>Sender Type = Messaging Service</strong> with a valid Messaging Service SID.
        </div>
      )}

      {sendingMode === 'scheduled' && scheduleWindowError && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          {scheduleWindowError}
        </div>
      )}

      {/* Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-yellow-900 mb-2">⚠️ Important Notes</h4>
        <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
          <li>Messages will be charged to your Twilio account</li>
          <li>Make sure you have sufficient Twilio account balance</li>
          <li>Test with a small group first if unsure</li>
          <li>Scheduled messages must be at least {SCHEDULE_CONSTRAINTS.MIN_MINUTES_AHEAD} minutes ahead and within {SCHEDULE_CONSTRAINTS.MAX_DAYS_AHEAD} days</li>
          <li>
            View and cancel scheduled messages in the{' '}
            <a
              href="https://console.twilio.com/us1/monitor/insights/sms?frameUrl=%2Fconsole%2Fsms%2Finsights%2Fdelivery%3Fx-target-region%3Dus1&q=tabKey%3Dscheduled%26timeRangeFilterPreset%3DPAST_D_7"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-yellow-900 hover:text-yellow-950"
            >
              Twilio Console Scheduled Messages
            </a>
          </li>
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
