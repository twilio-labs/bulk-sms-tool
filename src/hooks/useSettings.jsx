import { useState, useCallback } from 'react'
import { SMS_SETTINGS_DEFAULTS, DELAY_SETTINGS } from '../utils/constants'

export const useSettings = () => {
  const [smsSettings, setSmsSettings] = useState(SMS_SETTINGS_DEFAULTS)
  
  // Initialize Twilio config with empty values (no persistence)
  const [twilioConfig, setTwilioConfig] = useState({
    accountSid: '',
    authToken: ''
  })

  // Initialize sender configuration
  const [senderConfig, setSenderConfig] = useState({
    type: 'phone', // 'phone' or 'messaging-service'
    phoneNumber: '',
    messagingServiceSid: ''
  })
  
  const [showSettings, setShowSettings] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState('US')

  const updateSmsSettings = useCallback((newSettings) => {
    setSmsSettings(prev => ({ ...prev, ...newSettings }))
  }, [])

  const updateSenderConfig = useCallback((newConfig) => {
    setSenderConfig(prev => ({ ...prev, ...newConfig }))
  }, [])

  const updateMessageDelay = useCallback((delay) => {
    // Allow 0 for no delay, otherwise clamp to min/max range
    const clampedDelay = delay === 0 ? 0 : Math.max(DELAY_SETTINGS.MIN_DELAY, Math.min(DELAY_SETTINGS.MAX_DELAY, delay))
    setSmsSettings(prev => ({ ...prev, messageDelay: clampedDelay }))
  }, [])

  const updateTwilioConfig = useCallback((newConfig) => {
    setTwilioConfig(prev => ({ ...prev, ...newConfig }))
  }, [])

  const validateTwilioConfig = useCallback(() => {
    const { accountSid, authToken } = twilioConfig
    
    if (!accountSid || !authToken) {
      throw new Error('Please configure all Twilio credentials (Account SID and Auth Token)')
    }

    // Basic format validation
    if (!accountSid.startsWith('AC') || accountSid.length !== 34) {
      throw new Error('Invalid Account SID format. Should start with "AC" and be 34 characters long')
    }

    if (authToken.length < 20) {
      throw new Error('Invalid Auth Token format. Token appears too short')
    }

    return true
  }, [twilioConfig])

  const validateSenderConfig = useCallback(() => {
    if (senderConfig.type === 'phone') {
      if (!senderConfig.phoneNumber) {
        throw new Error('Please enter a phone number')
      }
      
      if (!senderConfig.phoneNumber.startsWith('+')) {
        throw new Error('Phone number must include country code (e.g., +1234567890)')
      }
    } else if (senderConfig.type === 'messaging-service') {
      if (!senderConfig.messagingServiceSid) {
        throw new Error('Please select a messaging service')
      }
    }

    return true
  }, [senderConfig])

  const toggleSettings = useCallback(() => {
    setShowSettings(prev => !prev)
  }, [])

  const closeSettings = useCallback(() => {
    setShowSettings(false)
  }, [])

  const resetSettings = useCallback(() => {
    setSmsSettings(SMS_SETTINGS_DEFAULTS)
  }, [])

  const clearTwilioConfig = useCallback(() => {
    setTwilioConfig({
      accountSid: '',
      authToken: ''
    })

    setSenderConfig({
      type: 'phone',
      phoneNumber: '',
      messagingServiceSid: ''
    })
  }, [])

  const handleCountryChange = useCallback((countryCode) => {
    setSelectedCountry(countryCode)
  }, [])

  const getEstimatedCost = useCallback((message, contactCount) => {
    if (!message || contactCount === 0) return 0
    
    // Calculate segments (160 chars per segment for GSM, 70 for Unicode)
    const hasUnicode = /[^\x00-\x7F]/.test(message)
    const segmentLength = hasUnicode ? 70 : 160
    const segments = Math.ceil(message.length / segmentLength)
    
    return segments * contactCount * smsSettings.estimatedCostPerSegment
  }, [smsSettings.estimatedCostPerSegment])

  const getEstimatedCompletionTime = useCallback((contactCount) => {
    if (!contactCount || contactCount === 0) return 0
    
    // Calculate total time: (contacts - 1) * delay (no delay after last message)
    // Return time in seconds, not milliseconds
    const totalDelayMs = Math.max(0, contactCount - 1) * smsSettings.messageDelay
    const totalDelaySeconds = totalDelayMs / 1000 // Convert to seconds
    
    return totalDelaySeconds
  }, [smsSettings.messageDelay])

  const formatEstimatedTime = useCallback((timeSeconds) => {
    if (timeSeconds === 0) return '0s'
    if (timeSeconds < 0.1) return `${Math.round(timeSeconds * 1000)}ms`
    if (timeSeconds < 1) return `${(timeSeconds).toFixed(1)}s`
    if (timeSeconds < 60) return `${timeSeconds.toFixed(1)}s`
    
    const minutes = Math.floor(timeSeconds / 60)
    const seconds = Math.round(timeSeconds % 60)
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  }, [])

  return {
    smsSettings,
    twilioConfig,
    senderConfig,
    showSettings,
    selectedCountry,
    updateSmsSettings,
    updateTwilioConfig,
    updateSenderConfig,
    updateMessageDelay,
    validateTwilioConfig,
    validateSenderConfig,
    toggleSettings,
    closeSettings,
    resetSettings,
    clearTwilioConfig,
    handleCountryChange,
    getEstimatedCost,
    getEstimatedCompletionTime,
    formatEstimatedTime
  }
}
