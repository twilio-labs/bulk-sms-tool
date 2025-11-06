import React, { useState, useEffect } from 'react'
import { Phone, MessageSquare, RefreshCw, AlertCircle } from 'lucide-react'

const SenderConfiguration = ({ 
  twilioConfig, 
  senderConfig, 
  updateSenderConfig 
}) => {
  const [senderType, setSenderType] = useState(senderConfig?.type || 'phone')
  const [messagingServices, setMessagingServices] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
      type, 
      phoneNumber: type === 'phone' ? senderConfig?.phoneNumber || '' : null,
      messagingServiceSid: type === 'messaging-service' ? senderConfig?.messagingServiceSid || '' : null
    })
  }

  const handlePhoneNumberChange = (phoneNumber) => {
    updateSenderConfig({ 
      ...senderConfig,
      type: 'phone',
      phoneNumber,
      messagingServiceSid: null
    })
  }

  const handleMessagingServiceChange = (messagingServiceSid) => {
    updateSenderConfig({ 
      ...senderConfig,
      type: 'messaging-service',
      messagingServiceSid,
      phoneNumber: null
    })
  }

  // Check if Twilio credentials are configured
  const hasCredentials = twilioConfig?.accountSid && twilioConfig?.authToken

  return (
    <div className="space-y-6">
      {/* Sender Type Toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Sender Type
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
            placeholder="Enter your Twilio phone number (e.g., +1234567890)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow"
          />
          <p className="text-xs text-gray-500 mt-2">
            Must include country code (e.g., +1 for US, +57 for Colombia)
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
          <li><strong>Phone Number:</strong> Send from a single Twilio phone number</li>
          <li><strong>Messaging Service:</strong> Send from a pool of numbers with automatic failover and compliance features</li>
        </ul>
        <p className="text-xs text-blue-600 mt-3">
          💡 <strong>Tip:</strong> Messaging Services provide better deliverability and can handle higher volumes.
        </p>
      </div>
    </div>
  )
}

export default SenderConfiguration
