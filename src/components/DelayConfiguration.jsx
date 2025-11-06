import React from 'react'
import { Clock, Info, ExternalLink } from 'lucide-react'
import { DELAY_SETTINGS } from '../utils/constants'

const DelayConfiguration = ({ 
  messageDelay, 
  onDelayChange, 
  contactCount = 0,
  getEstimatedCompletionTime,
  formatEstimatedTime
}) => {
  // Derive no delay state directly from messageDelay prop
  const noDelayEnabled = messageDelay === 0

  // Convert milliseconds to seconds for display
  const minDelaySeconds = DELAY_SETTINGS.MIN_DELAY / 1000
  const maxDelaySeconds = DELAY_SETTINGS.MAX_DELAY / 1000

  const handleSliderChange = (e) => {
    const newDelaySeconds = parseFloat(e.target.value)
    const newDelayMs = Math.round(newDelaySeconds * 1000)
    onDelayChange(newDelayMs)
  }

  const handleInputChange = (e) => {
    const newDelaySeconds = parseFloat(e.target.value) || (DELAY_SETTINGS.DEFAULT_DELAY / 1000)
    const newDelayMs = Math.round(newDelaySeconds * 1000)
    onDelayChange(newDelayMs)
  }

  const handleNoDelayToggle = (enabled) => {
    if (enabled) {
      onDelayChange(0)
    } else {
      // When disabling no delay, reset to default value
      onDelayChange(DELAY_SETTINGS.DEFAULT_DELAY)
    }
  }

  const estimatedTime = getEstimatedCompletionTime(contactCount)

  const getDelayDescription = (delay) => {
    if (delay === 0) return 'No Delay (Check Twilio rate limits!)'
    if (delay < 200) return 'Very Fast (Higher risk of rate limiting)'
    if (delay < 500) return 'Fast (Some risk of rate limiting)'
    if (delay <= 700) return 'Balanced (Recommended for Toll-Free)'
    if (delay <= 1500) return 'Conservative (Very safe)'
    return 'Very Conservative (Maximum safety)'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Clock className="h-5 w-5 text-gray-600" />
        <h4 className="text-sm font-medium text-gray-900">Message Sending Delay</h4>
      </div>

      {/* Explanation Message */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <Info className="h-4 w-4 inline mr-1" />
          <strong>Note:</strong> This delay controls the time between message requests sent from our app to Twilio. 
          The actual delivery speed also depends on your phone number's "Messages per Second" limit and other Twilio factors.
        </p>
      </div>

      {/* No Delay Toggle */}
      <div className="p-4 border border-gray-200 rounded-lg">
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={noDelayEnabled}
            onChange={(e) => handleNoDelayToggle(e.target.checked)}
            className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
          />
          <span className="text-sm font-medium text-gray-900">No Delay (Send as fast as possible)</span>
        </label>
        
        {noDelayEnabled && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-yellow-800 font-medium">⚠️ Important: Check Twilio Rate Limits</p>
                <p className="text-yellow-700 mt-1">
                  Sending without delay may exceed your account's rate limits. 
                  <a 
                    href="https://help.twilio.com/articles/115002943027-Understanding-Twilio-Rate-Limits-and-Message-Queues" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center ml-1 text-yellow-700 hover:text-yellow-900 underline"
                  >
                    View Rate Limits <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delay Configuration - only show when no delay is disabled */}
      {!noDelayEnabled && (
        <>
          {/* Delay Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">
                Delay between requests: <span className="font-medium">{(messageDelay/1000).toFixed(1)}s</span>
              </label>
              <input
                type="number"
                min={minDelaySeconds}
                max={maxDelaySeconds}
                step="0.1"
                value={noDelayEnabled ? 0 : messageDelay/1000}
                onChange={handleInputChange}
                disabled={noDelayEnabled}
                className={`w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                  noDelayEnabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''
                }`}
              />
            </div>

            <input
              type="range"
              min={minDelaySeconds}
              max={maxDelaySeconds}
              step="0.1"
              value={noDelayEnabled ? minDelaySeconds : messageDelay/1000}
              onChange={handleSliderChange}
              disabled={noDelayEnabled}
              className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider ${
                noDelayEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />

            <div className="flex justify-between text-xs text-gray-500">
              <span>{minDelaySeconds}s</span>
              <span>{maxDelaySeconds}s</span>
            </div>
          </div>

          {/* Delay Description */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <span className="font-medium">{getDelayDescription(messageDelay)}</span>
            </p>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <h5 className="text-sm font-medium text-gray-700">Quick Presets:</h5>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Fast (0.1s)', value: DELAY_SETTINGS.PRESETS.FAST },
                { label: 'Default (0.3s)', value: DELAY_SETTINGS.PRESETS.DEFAULT },
                { label: 'Safe (0.6s)', value: DELAY_SETTINGS.PRESETS.SAFE },
                { label: 'Conservative (1s)', value: DELAY_SETTINGS.PRESETS.CONSERVATIVE }
              ].map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => onDelayChange(preset.value)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    messageDelay === preset.value
                      ? 'bg-red-100 text-red-700 border-red-300'
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Time Estimation */}
      {contactCount > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <div>
              <h5 className="text-sm font-medium text-blue-900">Estimated Completion Time</h5>
              <p className="text-sm text-blue-700 mt-1">
                Sending <span className="font-medium">{contactCount}</span> messages with{' '}
                {noDelayEnabled ? (
                  <span className="font-bold">no delay</span>
                ) : (
                  <>
                    <span className="font-medium">{(messageDelay/1000).toFixed(1)}s</span> delay
                  </>
                )} will take approximately{' '}
                <span className="font-bold">
                  {noDelayEnabled ? 'seconds (instant)' : formatEstimatedTime(estimatedTime)}
                </span>
              </p>
              {contactCount > 1 && !noDelayEnabled && (
                <p className="text-xs text-blue-600 mt-2">
                  * Time includes {contactCount - 1} delays between messages (no delay after the last message)
                </p>
              )}
              {noDelayEnabled && (
                <p className="text-xs text-blue-600 mt-2">
                  * Actual time depends on Twilio's rate limits and network conditions
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #dc2626;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #dc2626;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  )
}

export default DelayConfiguration