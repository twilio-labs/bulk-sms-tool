import { useState } from 'react'
import { BarChart3, DollarSign, TrendingUp, Globe, Wifi, WifiOff, Calculator } from 'lucide-react'

const AnalyticsPanel = ({
  message,
  contacts,
  getMessageAnalytics
}) => {
  const [selectedCountry, setSelectedCountry] = useState('US')

  // Function to personalize message with first contact's data for analytics
  const getPersonalizedMessage = () => {
    if (!message.trim() || !contacts?.length) return message
    
    const firstContact = contacts[0]
    let personalizedMessage = message
    
    // Replace all {fieldName} patterns with actual contact data
    Object.keys(firstContact).forEach(key => {
      const pattern = new RegExp(`\\{${key}\\}`, 'gi')
      const value = firstContact[key] || ''
      personalizedMessage = personalizedMessage.replace(pattern, value)
    })
    
    return personalizedMessage
  }

  // Use personalized message for analytics calculations
  const personalizedMessage = getPersonalizedMessage()
  const analytics = getMessageAnalytics ? getMessageAnalytics(personalizedMessage) : null
  const contactCount = contacts?.length || 0

  // Country pricing data
  const countryPricing = {
    'US': { name: 'United States', price: 0.0075, flag: '🇺🇸' },
    'CA': { name: 'Canada', price: 0.0075, flag: '🇨🇦' },
    'GB': { name: 'United Kingdom', price: 0.04, flag: '🇬🇧' },
    'AU': { name: 'Australia', price: 0.0075, flag: '🇦🇺' },
    'DE': { name: 'Germany', price: 0.075, flag: '🇩🇪' },
    'FR': { name: 'France', price: 0.075, flag: '🇫🇷' },
    'JP': { name: 'Japan', price: 0.075, flag: '🇯🇵' },
    'BR': { name: 'Brazil', price: 0.025, flag: '🇧🇷' },
    'IN': { name: 'India', price: 0.0075, flag: '🇮🇳' },
    'MX': { name: 'Mexico', price: 0.0075, flag: '🇲🇽' }
  }

  const currentPricing = countryPricing[selectedCountry]
  const segments = analytics?.segments || 1
  const costPerMessage = currentPricing.price * segments
  const totalCost = costPerMessage * contactCount

  return (
    <div className="space-y-6">
      {/* Cost Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Cost per Message</p>
              <p className="text-2xl font-bold">${costPerMessage.toFixed(4)}</p>
            </div>
            <Calculator className="h-8 w-8 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Recipients</p>
              <p className="text-2xl font-bold">{contactCount.toLocaleString()}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Total Cost</p>
              <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-200" />
          </div>
        </div>
      </div>

      {/* Country Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Globe className="inline w-4 h-4 mr-2" />
          Select Country for Pricing
        </label>
        <select
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow"
        >
          {Object.entries(countryPricing).map(([code, info]) => (
            <option key={code} value={code}>
              {info.flag} {info.name} - ${info.price}/SMS
            </option>
          ))}
        </select>
      </div>

      {/* Message Analytics */}
      {message && analytics && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Message Analysis
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{personalizedMessage.length}</div>
              <div className="text-sm text-gray-600">Characters</div>
            </div>
            
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{segments}</div>
              <div className="text-sm text-gray-600">Segments</div>
            </div>
            
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{analytics.encoding}</div>
              <div className="text-sm text-gray-600">Encoding</div>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Breakdown */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <DollarSign className="w-5 h-5 mr-2" />
          Pricing Breakdown
        </h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Base rate ({currentPricing.flag} {currentPricing.name})</span>
            <span className="font-medium">${currentPricing.price}/SMS</span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Message segments</span>
            <span className="font-medium">×{segments}</span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Cost per message</span>
            <span className="font-medium">${costPerMessage.toFixed(4)}</span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Total recipients</span>
            <span className="font-medium">{contactCount.toLocaleString()}</span>
          </div>
          
          <div className="flex justify-between items-center py-3 bg-gray-50 px-3 rounded-lg">
            <span className="font-semibold text-gray-900">Total estimated cost</span>
            <span className="font-bold text-xl text-purple-600">${totalCost.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Cost Savings Tips */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-yellow-900 mb-2">💰 Cost Optimization Tips</h4>
        <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
          <li>Keep messages under 160 characters to avoid multi-part SMS charges</li>
          <li>Avoid special characters and emojis to prevent Unicode encoding</li>
          <li>Consider different pricing for international numbers</li>
          <li>Test with a small group first to verify costs</li>
        </ul>
      </div>

      {/* Live Status Indicator */}
      <div className="flex items-center justify-center py-2">
        <div className="flex items-center text-sm text-gray-600">
          {navigator.onLine ? (
            <>
              <Wifi className="w-4 h-4 text-green-500 mr-2" />
              <span>Live pricing data</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-500 mr-2" />
              <span>Using cached pricing</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AnalyticsPanel
