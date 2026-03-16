import AnalyticsPanel from './AnalyticsPanel'
import AccordionSection from './AccordionSection'

const AnalyticsSection = ({
  isExpanded,
  onToggle,
  message,
  contentTemplate,
  smsPricingCountry,
  onSmsPricingCountryChange,
  whatsAppPricingCountry,
  onWhatsAppPricingCountryChange,
  contacts,
  getMessageAnalytics,
  validationSummary,
  estimatedCostPerSegment,
  twilioConfig,
  senderConfig
}) => {
  const isWhatsAppChannel = senderConfig?.channel === 'whatsapp'

  const analyticsStatus = (
    <span className={`text-sm font-medium ${
      isWhatsAppChannel
        ? 'text-blue-600'
        : validationSummary.summary.valid > 0 && message.trim()
        ? 'text-green-600' 
        : 'text-red-600'
    }`}>
      {isWhatsAppChannel
        ? '✓ WhatsApp estimate'
        : validationSummary.summary.valid > 0 && message.trim()
        ? `✓ Est. $${((getMessageAnalytics?.(message)?.segments || 1) * validationSummary.summary.valid * (estimatedCostPerSegment || 0.0075)).toFixed(2)}`
        : '✗ No estimate'
      }
    </span>
  )

  return (
    <AccordionSection
      id="analytics"
      title="Analytics & Pricing"
      status={analyticsStatus}
      isExpanded={isExpanded}
      onToggle={onToggle}
      animationDelay="0.4s"
    >
      <AnalyticsPanel
        message={message}
        contentTemplate={contentTemplate}
        smsPricingCountry={smsPricingCountry}
        onSmsPricingCountryChange={onSmsPricingCountryChange}
        whatsAppPricingCountry={whatsAppPricingCountry}
        onWhatsAppPricingCountryChange={onWhatsAppPricingCountryChange}
        contacts={contacts}
        getMessageAnalytics={getMessageAnalytics}
        twilioConfig={twilioConfig}
        senderConfig={senderConfig}
      />
    </AccordionSection>
  )
}

export default AnalyticsSection
