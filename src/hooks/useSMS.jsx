import { useState, useCallback } from 'react'
import { sendBulkSMS } from '../services/smsService'
import { validatePhoneNumber } from '../utils/phoneUtils'
import { SMS_LIMITS, CONTACT_STATUS } from '../utils/constants'

export const useSMS = () => {
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState({ success: 0, failed: 0, errors: [] })

  const sendBulkMessages = useCallback(async ({ contacts, message, twilioConfig, senderConfig, onContactUpdate, messageDelay = 1000 }) => {
    setSending(true)
    setProgress(0)
    setResults({ success: 0, failed: 0, errors: [] })

    try {
      const validContacts = contacts.filter(contact => validatePhoneNumber(contact.phone))
      
      if (validContacts.length === 0) {
        throw new Error('No valid phone numbers found')
      }

      if (validContacts.length > SMS_LIMITS.MAX_CONTACTS_PER_REQUEST) {
        throw new Error(`Maximum ${SMS_LIMITS.MAX_CONTACTS_PER_REQUEST} contacts allowed per request`)
      }

      // Use the bulk SMS API endpoint with personalization and sender config support
      const response = await sendBulkSMS({
        contacts: validContacts, // Send full contact objects
        message,
        twilioConfig,
        senderConfig,
        messageDelay
      })

      // Update contact statuses based on results
      if (response.results?.successful) {
        response.results.successful.forEach(result => {
          onContactUpdate?.(result.phone, CONTACT_STATUS.SENT)
        })
      }

      if (response.results?.failed) {
        response.results.failed.forEach(result => {
          onContactUpdate?.(result.phone, CONTACT_STATUS.FAILED)
        })
      }

      // Update progress to 100%
      setProgress(100)
      
      // Set final results
      const finalResults = {
        success: response.summary?.successful || 0,
        failed: response.summary?.failed || 0,
        errors: response.results?.failed?.map(f => `${f.phone}: ${f.error}`) || []
      }
      
      setResults(finalResults)

      return finalResults

    } catch (error) {
      setResults({
        success: 0,
        failed: contacts.length,
        errors: [error.message]
      })
      throw error
    } finally {
      setSending(false)
    }
  }, [])

  const validateMessage = useCallback((message) => {
    if (!message || !message.trim()) {
      throw new Error('Please enter a message')
    }

    if (message.length > SMS_LIMITS.MAX_MESSAGE_LENGTH) {
      throw new Error(`Message is too long. Maximum ${SMS_LIMITS.MAX_MESSAGE_LENGTH} characters allowed`)
    }

    return true
  }, [])

  const resetSendingState = useCallback(() => {
    setSending(false)
    setProgress(0)
    setResults({ success: 0, failed: 0, errors: [] })
  }, [])

  const getMessageAnalytics = useCallback((message) => {
    if (!message) return null

    // Check for Unicode characters
    const hasUnicode = /[^\x00-\x7F]/.test(message)
    const encoding = hasUnicode ? 'Unicode' : 'GSM 7-bit'
    const maxLength = hasUnicode ? 70 : 160
    const segments = Math.ceil(message.length / maxLength)
    
    const warnings = []
    if (hasUnicode) {
      warnings.push('Message contains special characters (Unicode encoding)')
    }
    if (segments > 1) {
      warnings.push(`Message will be split into ${segments} segments`)
    }
    if (message.length > SMS_LIMITS.MAX_MESSAGE_LENGTH) {
      warnings.push('Message exceeds maximum length')
    }

    return {
      length: message.length,
      segments,
      encoding,
      maxLength: SMS_LIMITS.MAX_MESSAGE_LENGTH,
      warnings,
      estimatedCost: segments * 0.0075 // Basic estimation
    }
  }, [])

  return {
    sending,
    progress,
    results,
    sendBulkMessages,
    validateMessage,
    resetSendingState,
    getMessageAnalytics
  }
}
