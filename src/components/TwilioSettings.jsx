import React, { useState } from 'react'
import { Eye, EyeOff, Key, User, Trash2 } from 'lucide-react'

const TwilioSettings = ({ 
  twilioConfig, 
  updateTwilioConfig, 
  clearTwilioConfig 
}) => {
  const [showTokens, setShowTokens] = useState({
    authToken: false
  })

  const handleInputChange = (field, value) => {
    updateTwilioConfig({ [field]: value })
  }

  const toggleVisibility = (field) => {
    setShowTokens(prev => ({ ...prev, [field]: !prev[field] }))
  }

  return (
    <div className="space-y-6">
      {/* Account SID */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <User className="inline w-4 h-4 mr-2" />
          Account SID
        </label>
        <div className="relative">
          <input
            type="text"
            value={twilioConfig?.accountSid || ''}
            onChange={(e) => handleInputChange('accountSid', e.target.value)}
            placeholder="Enter your Twilio Account SID"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow"
          />
        </div>
      </div>

      {/* Auth Token */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Key className="inline w-4 h-4 mr-2" />
          Auth Token
        </label>
        <div className="relative">
          <input
            type={showTokens.authToken ? 'text' : 'password'}
            value={twilioConfig?.authToken || ''}
            onChange={(e) => handleInputChange('authToken', e.target.value)}
            placeholder="Enter your Twilio Auth Token"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow pr-12"
          />
          <button
            type="button"
            onClick={() => toggleVisibility('authToken')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            {showTokens.authToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Clear Configuration Button */}
      {(twilioConfig?.accountSid || twilioConfig?.authToken) && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all Twilio configuration?')) {
                clearTwilioConfig()
              }
            }}
            className="flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Configuration
          </button>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">
          <strong>Where to find these credentials:</strong>
        </p>
        <ol className="text-sm text-red-700 mt-2 space-y-1 list-decimal list-inside">
          <li>Log into your <a href="https://console.twilio.com/" target="_blank" rel="noopener noreferrer" className="underline">Twilio Console</a></li>
          <li>Account SID and Auth Token are on your main dashboard</li>
        </ol>
        <div className="mt-3 pt-3 border-t border-red-200">
          <p className="text-xs text-red-600">
            🔒 <strong>Security Notice:</strong> Your credentials are only stored in memory and will be cleared when you refresh the page.
          </p>
        </div>
      </div>
    </div>
  )
}

export default TwilioSettings
