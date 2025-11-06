//Copyright 2025 Twilio Inc.

import { useState, useMemo, useCallback } from 'react'

// Custom Hooks
import { useContacts } from './hooks/useContacts'
import { useSettings } from './hooks/useSettings'
import { useScheduler } from './hooks/useScheduler'
import { useSMS } from './hooks/useSMS'

// Components - Reorganized
import AppHeader from './components/AppHeader'
import Navigation from './components/Navigation'
import SettingsSection from './components/SettingsSection'
import ContactsSection from './components/ContactsSection'
import MessageSection from './components/MessageSection'
import AnalyticsSection from './components/AnalyticsSection'
import SendingSection from './components/SendingSection'

function App() {
  // Local state
  const [message, setMessage] = useState('')

  // Custom hooks
  const contactsHook = useContacts()
  const settingsHook = useSettings()
  const schedulerHook = useScheduler()
  const smsHook = useSMS()

  // Sidebar state - only one section can be active at a time
  const [activeSection, setActiveSection] = useState('settings') // Start with settings active
  
  // Helper function for sidebar navigation
  const handleSectionChange = (section) => {
    setActiveSection(section)
  }

  // Reset function - preserves Twilio and sender config, clears workflow data
  const handleReset = () => {
    // Clear contacts
    contactsHook.clearContacts()
    
    // Clear message
    setMessage('')
    
    // Clear SMS results and reset sending state
    smsHook.resetSendingState()
    
    // Reset to settings section
    setActiveSection('settings')
    
    // Note: Twilio config and sender config are preserved as requested
  }

  // Computed values
  const validationSummary = contactsHook.getValidationSummary()
  
  // Simple send handler
  const handleSendSMS = async () => {
    try {
      settingsHook.validateTwilioConfig()
      settingsHook.validateSenderConfig()
    } catch (error) {
      alert(`Configuration error: ${error.message}`)
      return
    }
    
    if (!message.trim() || validationSummary.summary.valid === 0) {
      alert('Please enter a message and upload valid contacts')
      return
    }
    
    try {
      await smsHook.sendBulkMessages({
        contacts: contactsHook.contacts,
        message: message,
        twilioConfig: settingsHook.twilioConfig,
        senderConfig: settingsHook.senderConfig,
        onContactUpdate: contactsHook.updateContactStatus,
        messageDelay: settingsHook.smsSettings.messageDelay
      })
    } catch (error) {
      console.error('Send error:', error)
      alert(`Failed to send messages: ${error.message}`)
    }
  }
  
  // Handle scheduling messages with delay
  const handleScheduleMessages = useCallback(async (params) => {
    return await schedulerHook.scheduleMessage({
      ...params,
      messageDelay: settingsHook.smsSettings.messageDelay
    })
  }, [schedulerHook.scheduleMessage, settingsHook.smsSettings.messageDelay])

  // Check if configurations are complete
  const isConfigurationComplete = useMemo(() => {
    try {
      settingsHook.validateTwilioConfig()
      settingsHook.validateSenderConfig()
      return true
    } catch (error) {
      return false
    }
  }, [settingsHook.twilioConfig, settingsHook.senderConfig, settingsHook.validateTwilioConfig, settingsHook.validateSenderConfig])
  
  const canSend = isConfigurationComplete && message.trim() && validationSummary.summary.valid > 0

  // Calculate section completion status
  const sectionStatus = useMemo(() => {
    return {
      settings: isConfigurationComplete,
      contacts: contactsHook.contacts.length > 0 && validationSummary.summary.valid > 0,
      message: message.trim().length > 0,
      analytics: message.trim().length > 0 && contactsHook.contacts.length > 0,
      sending: canSend
    }
  }, [isConfigurationComplete, contactsHook.contacts.length, validationSummary.summary.valid, message, canSend])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        
        <AppHeader />

        {/* Main Layout with Sidebar */}
        <div className="flex h-[calc(100vh-theme(spacing.20))]">
          {/* Navigation Sidebar */}
          <Navigation 
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            sectionStatus={sectionStatus}
            onReset={handleReset}
          />
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto px-6 py-8 max-w-4xl">
              
              {/* Render Active Section */}
              {activeSection === 'settings' && (
                <SettingsSection
                  isExpanded={true}
                  onToggle={() => {}}
                  twilioConfig={settingsHook.twilioConfig}
                  senderConfig={settingsHook.senderConfig}
                  updateTwilioConfig={settingsHook.updateTwilioConfig}
                  clearTwilioConfig={settingsHook.clearTwilioConfig}
                  updateSenderConfig={settingsHook.updateSenderConfig}
                  isConfigurationComplete={isConfigurationComplete}
                />
              )}

              {activeSection === 'contacts' && (
                <ContactsSection
                  isExpanded={true}
                  onToggle={() => {}}
                  contacts={contactsHook.contacts}
                  isUploading={contactsHook.isUploading}
                  uploadError={contactsHook.uploadError}
                  onFileUpload={contactsHook.handleFileUpload}
                  onClearContacts={contactsHook.clearContacts}
                  validationSummary={validationSummary}
                />
              )}

              {activeSection === 'message' && (
                <MessageSection
                  isExpanded={true}
                  onToggle={() => {}}
                  message={message}
                  onMessageChange={setMessage}
                  contacts={contactsHook.contacts}
                  validationSummary={validationSummary}
                  isConfigurationComplete={isConfigurationComplete}
                />
              )}

              {activeSection === 'analytics' && (
                <AnalyticsSection
                  isExpanded={true}
                  onToggle={() => {}}
                  message={message}
                  contacts={contactsHook.contacts}
                  getMessageAnalytics={smsHook.getMessageAnalytics}
                  validationSummary={validationSummary}
                  estimatedCostPerSegment={settingsHook.smsSettings.estimatedCostPerSegment}
                  twilioConfig={settingsHook.twilioConfig}
                  senderConfig={settingsHook.senderConfig}
                />
              )}

              {activeSection === 'sending' && (
                <SendingSection
                  isExpanded={true}
                  onToggle={() => {}}
                  canSend={canSend}
                  message={message}
                  contacts={contactsHook.contacts}
                  twilioConfig={settingsHook.twilioConfig}
                  senderConfig={settingsHook.senderConfig}
                  onSendMessages={handleSendSMS}
                  onScheduleMessages={handleScheduleMessages}
                  sending={smsHook.sending}
                  progress={smsHook.progress}
                  results={smsHook.results}
                  scheduledSending={schedulerHook.scheduledSending}
                  updateScheduling={schedulerHook.updateScheduling}
                  lastScheduledMessage={schedulerHook.lastScheduledMessage}
                  clearLastScheduledMessage={schedulerHook.clearLastScheduledMessage}
                  scheduledJobs={schedulerHook.scheduledJobs}
                  onCancelScheduledJob={schedulerHook.cancelScheduledJob}
                  onUpdateJobStatus={schedulerHook.updateJobStatus}
                  messageDelay={settingsHook.smsSettings.messageDelay}
                  onDelayChange={settingsHook.updateMessageDelay}
                  getEstimatedCompletionTime={settingsHook.getEstimatedCompletionTime}
                  formatEstimatedTime={settingsHook.formatEstimatedTime}
                />
              )}
              
            </div>
          </div>
        </div>
    </div>
  )
}

export default App
