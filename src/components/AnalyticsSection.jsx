import AnalyticsPanel from './AnalyticsPanel'
import AccordionSection from './AccordionSection'

const AnalyticsSection = ({
  isExpanded,
  onToggle,
  message,
  contacts,
  getMessageAnalytics,
  validationSummary,
  estimatedCostPerSegment
}) => {
  const analyticsStatus = (
    <span className={`text-sm font-medium ${
      validationSummary.summary.valid > 0 && message.trim() 
        ? 'text-green-600' 
        : 'text-red-600'
    }`}>
      {validationSummary.summary.valid > 0 && message.trim() ? 
        `✓ Est. $${((getMessageAnalytics?.(message)?.segments || 1) * validationSummary.summary.valid * (estimatedCostPerSegment || 0.0075)).toFixed(2)}` : 
        '✗ No estimate'
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
        contacts={contacts}
        getMessageAnalytics={getMessageAnalytics}
      />
    </AccordionSection>
  )
}

export default AnalyticsSection
