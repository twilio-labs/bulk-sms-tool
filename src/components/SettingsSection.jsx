import TwilioSettings from './TwilioSettings'
import SenderConfiguration from './SenderConfiguration'
import AccordionSection from './AccordionSection'

const SettingsSection = ({
  isExpanded,
  onToggle,
  twilioConfig,
  senderConfig,
  updateTwilioConfig,
  clearTwilioConfig,
  updateSenderConfig,
  isConfigurationComplete
}) => {
  const settingsStatus = isConfigurationComplete ? 
    <span className="text-green-600 text-sm font-medium">✓ Configured</span> : 
    <span className="text-red-600 text-sm font-medium">✗ Not Configured</span>

  return (
    <AccordionSection
      id="settings"
      title="Twilio Configuration"
      status={settingsStatus}
      isExpanded={isExpanded}
      onToggle={onToggle}
      animationDelay="0.1s"
    >
      <div className="space-y-8">
        {/* Twilio Configuration */}
        <div>
          <h3 className="text-base font-medium text-gray-900 mb-4">Twilio Configuration</h3>
          <TwilioSettings 
            twilioConfig={twilioConfig}
            updateTwilioConfig={updateTwilioConfig}
            clearTwilioConfig={clearTwilioConfig}
          />
        </div>

        {/* Sender Configuration */}
        <div>
          <h3 className="text-base font-medium text-gray-900 mb-4">Sender Configuration</h3>
          <SenderConfiguration
            twilioConfig={twilioConfig}
            senderConfig={senderConfig}
            updateSenderConfig={updateSenderConfig}
          />
        </div>
      </div>
    </AccordionSection>
  )
}

export default SettingsSection
