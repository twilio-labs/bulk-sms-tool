import { useEffect, useMemo, useState } from 'react'
import { BarChart3, DollarSign, TrendingUp, Globe, Wifi, WifiOff, Calculator, RefreshCw } from 'lucide-react'
import { getSmsPricing, getWhatsAppRateCards } from '../services/smsService'
import {
  calculateSmsEstimatedTotal,
  calculateWhatsAppEstimatedTotal,
  normalizeWhatsAppTemplateCategory,
  personalizeMessageWithFirstContact,
} from '../utils/pricingUtils'

const AnalyticsPanel = ({
  message,
  contacts,
  getMessageAnalytics,
  twilioConfig,
  senderConfig,
  contentTemplate,
  smsPricingCountry = 'US',
  onSmsPricingCountryChange,
  whatsAppPricingCountry = 'US',
  onWhatsAppPricingCountryChange
}) => {
  const [pricingData, setPricingData] = useState(null)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [pricingError, setPricingError] = useState('')
  const [whatsAppRateCards, setWhatsAppRateCards] = useState([])
  const [whatsAppRatesLoading, setWhatsAppRatesLoading] = useState(false)
  const [whatsAppRatesError, setWhatsAppRatesError] = useState('')
  const [whatsAppTwilioFee, setWhatsAppTwilioFee] = useState(0.005)
  const [whatsAppRateSource, setWhatsAppRateSource] = useState('')
  const [whatsAppRateSourceUrl, setWhatsAppRateSourceUrl] = useState('')
  const [whatsAppRateUpdatedAt, setWhatsAppRateUpdatedAt] = useState('')

  const isWhatsAppChannel = senderConfig?.channel === 'whatsapp'

  // Use personalized message for analytics calculations
  const personalizedMessage = personalizeMessageWithFirstContact(message, contacts)
  const analytics = getMessageAnalytics ? getMessageAnalytics(personalizedMessage) : null
  const contactCount = contacts?.length || 0

  // Country picker list (for Twilio lookup)
  const supportedCountries = {
    'US': { name: 'United States', flag: '🇺🇸' },
    'CA': { name: 'Canada', flag: '🇨🇦' },
    'GB': { name: 'United Kingdom', flag: '🇬🇧' },
    'AU': { name: 'Australia', flag: '🇦🇺' },
    'DE': { name: 'Germany', flag: '🇩🇪' },
    'FR': { name: 'France', flag: '🇫🇷' },
    'JP': { name: 'Japan', flag: '🇯🇵' },
    'BR': { name: 'Brazil', flag: '🇧🇷' },
    'IN': { name: 'India', flag: '🇮🇳' },
    'MX': { name: 'Mexico', flag: '🇲🇽' }
  }

  const currentCountry = supportedCountries[smsPricingCountry]

  const loadWhatsAppRateCards = async () => {
    setWhatsAppRatesLoading(true)
    setWhatsAppRatesError('')

    try {
      const response = await getWhatsAppRateCards()
      const countries = Array.isArray(response?.countries) ? response.countries : []

      setWhatsAppRateCards(countries)
      setWhatsAppRateSource(response?.source || '')
      setWhatsAppRateSourceUrl(response?.sourceUrl || '')
      setWhatsAppRateUpdatedAt(response?.updatedAt || '')
      if (typeof response?.twilioFeePerMessage === 'number') {
        setWhatsAppTwilioFee(response.twilioFeePerMessage)
      }

      if (!countries.some(country => country.code === whatsAppPricingCountry) && countries[0]?.code) {
        onWhatsAppPricingCountryChange?.(countries[0].code)
      }
    } catch (error) {
      setWhatsAppRateCards([])
      setWhatsAppRateSource('')
      setWhatsAppRateSourceUrl('')
      setWhatsAppRateUpdatedAt('')
      setWhatsAppRatesError(error.message || 'Unable to load WhatsApp rate cards')
    } finally {
      setWhatsAppRatesLoading(false)
    }
  }

  useEffect(() => {
    if (!isWhatsAppChannel) {
      return
    }

    loadWhatsAppRateCards()
  }, [isWhatsAppChannel])

  useEffect(() => {
    if (isWhatsAppChannel) {
      setPricingData(null)
      setPricingError('')
      return
    }

    if (!twilioConfig?.accountSid || !twilioConfig?.authToken) {
      setPricingData(null)
      setPricingError('Add Twilio credentials in Settings to load account pricing.')
      return
    }

    const fetchPricing = async () => {
      setPricingLoading(true)
      setPricingError('')

      try {
        const pricing = await getSmsPricing({
          accountSid: twilioConfig.accountSid,
          authToken: twilioConfig.authToken,
          countryCode: smsPricingCountry,
        })

        setPricingData(pricing)
      } catch (error) {
        setPricingData(null)
        setPricingError(error.message || 'Unable to load SMS pricing from Twilio')
      } finally {
        setPricingLoading(false)
      }
    }

    fetchPricing()
  }, [isWhatsAppChannel, twilioConfig?.accountSid, twilioConfig?.authToken, smsPricingCountry])

  const estimatedRate = useMemo(() => {
    const rate = pricingData?.estimatedOutboundPrice
    return typeof rate === 'number' ? rate : null
  }, [pricingData])

  const segments = analytics?.segments || 1
  const { costPerMessage, totalCost } = calculateSmsEstimatedTotal({
    estimatedRate,
    segments,
    contactCount,
  })

  const getSelectedTemplateTypeLabel = (template) => {
    if (!template?.types || typeof template.types !== 'object') {
      return 'Unknown'
    }

    const keys = Object.keys(template.types)
    if (!keys.length) {
      return 'Unknown'
    }

    return keys[0]
  }

  const selectedTemplateCategory = normalizeWhatsAppTemplateCategory(contentTemplate?.whatsappCategory)
  const selectedTemplateType = getSelectedTemplateTypeLabel(contentTemplate)

  const messagesOutsideWindow = contactCount
  const {
    selectedMetaRate,
    isMetaRateAvailable,
    totalPerMessage,
    totalCost: whatsAppEstimatedTotal,
  } = useMemo(
    () => calculateWhatsAppEstimatedTotal({
      rateCards: whatsAppRateCards,
      countryCode: whatsAppPricingCountry,
      templateCategory: selectedTemplateCategory,
      twilioFeePerMessage: whatsAppTwilioFee,
      contactCount,
    }),
    [whatsAppRateCards, whatsAppPricingCountry, selectedTemplateCategory, whatsAppTwilioFee, contactCount]
  )

  if (isWhatsAppChannel) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Twilio Fee / Message</p>
                <p className="text-2xl font-bold">${whatsAppTwilioFee.toFixed(4)}</p>
              </div>
              <Calculator className="h-8 w-8 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Messages (Outside Window)</p>
                <p className="text-2xl font-bold">{messagesOutsideWindow.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Meta Fee / Message</p>
                <p className="text-2xl font-bold">{isMetaRateAvailable ? `$${selectedMetaRate.toFixed(4)}` : 'N/A'}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm">Estimated Total</p>
                <p className="text-2xl font-bold">{whatsAppEstimatedTotal !== null ? `$${whatsAppEstimatedTotal.toFixed(4)}` : '—'}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-200" />
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">WhatsApp Pricing Estimator</h3>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Select Country</label>
              <button
                type="button"
                onClick={loadWhatsAppRateCards}
                disabled={whatsAppRatesLoading}
                className="inline-flex items-center px-3 py-1 text-xs rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${whatsAppRatesLoading ? 'animate-spin' : ''}`} />
                Retry
              </button>
            </div>
            <select
              value={whatsAppPricingCountry}
              onChange={(e) => onWhatsAppPricingCountryChange?.(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow"
              disabled={whatsAppRatesLoading || !whatsAppRateCards.length}
            >
              {whatsAppRateCards.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            {whatsAppRatesLoading && (
              <p className="text-xs text-gray-500 mt-2">Loading country rates...</p>
            )}
            {whatsAppRatesError && (
              <p className="text-xs text-red-600 mt-2">{whatsAppRatesError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Selected Template Type</p>
              <p className="text-sm font-semibold text-gray-900">{selectedTemplateType}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Inferred Category</p>
              <p className="text-sm font-semibold text-gray-900 capitalize">{selectedTemplateCategory}</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
            {totalPerMessage !== null
              ? `Estimated total = ${messagesOutsideWindow.toLocaleString()} messages × ($${whatsAppTwilioFee.toFixed(4)} Twilio + $${selectedMetaRate.toFixed(4)} Meta ${selectedTemplateCategory}) = $${whatsAppEstimatedTotal.toFixed(4)}`
              : 'Selected country/category is unavailable in the rate card.'}
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-yellow-900 mb-2">⚠️ WhatsApp pricing note</h4>
          <p className="text-sm text-yellow-800">
            This assumes all sends are outside the customer service window and uses rate-card template fees by country/category.
          </p>
          {whatsAppRateSource && (
            <p className="text-xs text-yellow-900 mt-2">
              Source:{' '}
              {whatsAppRateSourceUrl ? (
                <a
                  href={whatsAppRateSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-medium"
                >
                  {whatsAppRateSource}
                </a>
              ) : (
                <span className="font-medium">{whatsAppRateSource}</span>
              )}
              . Last refresh: {whatsAppRateUpdatedAt ? new Date(whatsAppRateUpdatedAt).toLocaleString() : 'Unknown'}.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cost Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Cost per Message</p>
              <p className="text-2xl font-bold">{estimatedRate !== null ? `$${costPerMessage.toFixed(4)}` : '—'}</p>
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
              <p className="text-2xl font-bold">{estimatedRate !== null ? `$${totalCost.toFixed(2)}` : '—'}</p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-200" />
          </div>
        </div>
      </div>

      {/* Country Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Globe className="inline w-4 h-4 mr-2" />
          Select Country for SMS Pricing
        </label>
        <select
          value={smsPricingCountry}
          onChange={(e) => onSmsPricingCountryChange?.(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow"
        >
          {Object.entries(supportedCountries).map(([code, info]) => (
            <option key={code} value={code}>
              {info.flag} {info.name}
            </option>
          ))}
        </select>
        {pricingLoading && (
          <p className="text-xs text-gray-500 mt-2">Loading account pricing from Twilio...</p>
        )}
        {pricingError && (
          <p className="text-xs text-red-600 mt-2">{pricingError}</p>
        )}
        {!pricingLoading && !pricingError && estimatedRate !== null && (
          <p className="text-xs text-green-700 mt-2">
            Live account estimate: ${estimatedRate.toFixed(4)} per SMS segment ({pricingData?.priceUnit || 'USD'})
          </p>
        )}
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
            <span className="text-gray-600">Base rate ({currentCountry.flag} {currentCountry.name})</span>
            <span className="font-medium">
              {estimatedRate !== null ? `$${estimatedRate.toFixed(4)}/SMS segment` : 'Unavailable'}
            </span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Message segments</span>
            <span className="font-medium">×{segments}</span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Cost per message</span>
            <span className="font-medium">{estimatedRate !== null ? `$${costPerMessage.toFixed(4)}` : 'Unavailable'}</span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Total recipients</span>
            <span className="font-medium">{contactCount.toLocaleString()}</span>
          </div>
          
          <div className="flex justify-between items-center py-3 bg-gray-50 px-3 rounded-lg">
            <span className="font-semibold text-gray-900">Total estimated cost</span>
            <span className="font-bold text-xl text-purple-600">{estimatedRate !== null ? `$${totalCost.toFixed(2)}` : 'Unavailable'}</span>
          </div>
        </div>
      </div>

      {/* Cost Savings Tips */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-yellow-900 mb-2">💰 Cost Optimization Tips</h4>
        <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
          <li>Keep messages under 160 characters to avoid multi-part SMS charges</li>
          <li>Avoid special characters and emojis to prevent Unicode encoding</li>
          <li>Carrier routing can affect your effective rate by destination</li>
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
