import React, { useState, useEffect } from 'react'
import { Phone, MessageSquare, RefreshCw, AlertCircle } from 'lucide-react'

const SenderConfiguration = ({ 
  twilioConfig, 
  senderConfig, 
  updateSenderConfig 
}) => {
  const [channel, setChannel] = useState(senderConfig?.channel || 'sms')
  const [senderType, setSenderType] = useState(senderConfig?.type || 'phone')
  const [messagingServices, setMessagingServices] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setChannel(senderConfig?.channel || 'sms')
    setSenderType(senderConfig?.type || 'phone')
  }, [senderConfig?.channel, senderConfig?.type])

  // Fetch messaging services when credentials are available
  useEffect(() => {
    if (twilioConfig?.accountSid && twilioConfig?.authToken && senderType === 'messaging-service') {
      fetchMessagingServices()
    }
  }, [twilioConfig?.accountSid, twilioConfig?.authToken, senderType])

  const fetchMessagingServices = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/messaging-services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountSid: twilioConfig.accountSid,
          authToken: twilioConfig.authToken
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch messaging services')
      }

      const services = await response.json()
      setMessagingServices(services)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching messaging services:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSenderTypeChange = (type) => {
    setSenderType(type)
    updateSenderConfig({ 
      channel,
      type, 
      phoneNumber: type === 'phone' ? senderConfig?.phoneNumber || '' : null,
      messagingServiceSid: type === 'messaging-service' ? senderConfig?.messagingServiceSid || '' : null
    })
  }

  const handleChannelChange = (nextChannel) => {
    setChannel(nextChannel)
    updateSenderConfig({
      ...senderConfig,
      channel: nextChannel,
      type: senderType
    })
  }

  const handlePhoneNumberChange = (phoneNumber) => {
    updateSenderConfig({ 
      ...senderConfig,
      channel,
      type: 'phone',
      phoneNumber,
      messagingServiceSid: null
    })
  }

  const handleMessagingServiceChange = (messagingServiceSid) => {
    updateSenderConfig({ 
      ...senderConfig,
      channel,
      type: 'messaging-service',
      messagingServiceSid,
      phoneNumber: null
    })
  }

  // Check if Twilio credentials are configured
  const hasCredentials = twilioConfig?.accountSid && twilioConfig?.authToken

  return (
    <div className="space-y-6">
      {/* Channel Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Channel
        </label>
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => handleChannelChange('sms')}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
              channel === 'sms'
                ? 'bg-white text-red-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            SMS
          </button>
          <button
            type="button"
            onClick={() => handleChannelChange('whatsapp')}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
              channel === 'whatsapp'
                ? 'bg-white text-red-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            WhatsApp
          </button>
        </div>
      </div>

      {/* Sender Type Toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Sender Type ({channel === 'whatsapp' ? 'WhatsApp' : 'SMS'})
        </label>
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => handleSenderTypeChange('phone')}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
              senderType === 'phone'
                ? 'bg-white text-red-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Phone className="w-4 h-4 mr-2" />
            Phone Number
          </button>
          <button
            type="button"
            onClick={() => handleSenderTypeChange('messaging-service')}
            disabled={!hasCredentials}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
              senderType === 'messaging-service'
                ? 'bg-white text-red-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            } ${!hasCredentials ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Messaging Service
          </button>
        </div>
        {!hasCredentials && (
          <p className="text-xs text-gray-500 mt-2">
            Configure Twilio credentials above to use Messaging Services
          </p>
        )}
      </div>

      {/* Phone Number Input */}
      {senderType === 'phone' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Phone className="inline w-4 h-4 mr-2" />
            From Number
          </label>
          <input
            type="text"
            value={senderConfig?.phoneNumber || ''}
            onChange={(e) => handlePhoneNumberChange(e.target.value)}
            placeholder={
              channel === 'whatsapp'
                ? 'Enter your WhatsApp-enabled Twilio number (e.g., +14155238886)'
                : 'Enter your Twilio phone number (e.g., +1234567890)'
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow"
          />
          <p className="text-xs text-gray-500 mt-2">
            Must include country code in E.164 format (e.g., +1 for US, +57 for Colombia).
            {channel === 'whatsapp' && ' The app will automatically send using the whatsapp: prefix.'}
          </p>
        </div>
      )}

      {/* Messaging Service Selection */}
      {senderType === 'messaging-service' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              <MessageSquare className="inline w-4 h-4 mr-2" />
              Messaging Service
            </label>
            {hasCredentials && (
              <button
                type="button"
                onClick={fetchMessagingServices}
                disabled={loading}
                className="flex items-center px-3 py-1 text-xs text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
          </div>

          {error && (
            <div className="flex items-center p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg mb-3">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Loading messaging services...
            </div>
          ) : (
            <select
              value={senderConfig?.messagingServiceSid || ''}
              onChange={(e) => handleMessagingServiceChange(e.target.value)}
              disabled={!hasCredentials || messagingServices.length === 0}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">
                {messagingServices.length === 0 
                  ? 'No messaging services found' 
                  : 'Select a messaging service'
                }
              </option>
              {messagingServices.map((service) => (
                <option key={service.sid} value={service.sid}>
                  {service.friendlyName} - {service.sid}
                </option>
              ))}
            </select>
          )}

          {hasCredentials && messagingServices.length === 0 && !loading && !error && (
            <p className="text-sm text-gray-500 mt-2">
              No messaging services found in your account. You can create one in the{' '}
              <a 
                href="https://console.twilio.com/us1/develop/sms/services" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-red-600 underline"
              >
                Twilio Console
              </a>
            </p>
          )}
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800 font-medium mb-2">
          Sender Configuration Options:
        </p>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li><strong>Phone Number:</strong> Send from a single Twilio number ({channel === 'whatsapp' ? 'WhatsApp-enabled required' : 'SMS-capable required'})</li>
          <li><strong>Messaging Service:</strong> Send from a pool of numbers with automatic failover and compliance features</li>
        </ul>
        <p className="text-xs text-blue-600 mt-3">
          💡 <strong>Tip:</strong> For WhatsApp, use a sender enabled in Twilio WhatsApp Sandbox or a production-approved WhatsApp sender.
        </p>
      </div>
    </div>
  )
}

export default SenderConfiguration
