import SendingPanel from './SendingPanel'
import ScheduledJobsSection from './ScheduledJobsSection'
import DelayConfiguration from './DelayConfiguration'
import AccordionSection from './AccordionSection'

const SendingSection = ({
  isExpanded,
  onToggle,
  canSend,
  message,
  contacts,
  twilioConfig,
  senderConfig,
  onSendMessages,
  onScheduleMessages,
  sending,
  progress,
  results,
  scheduledSending,
  updateScheduling,
  lastScheduledMessage,
  clearLastScheduledMessage,
  scheduledJobs = [],
  onCancelScheduledJob,
  onUpdateJobStatus,
  onRefreshJobs,
  messageDelay,
  onDelayChange,
  getEstimatedCompletionTime,
  formatEstimatedTime
}) => {
  const sendingStatus = canSend ? 
    <span className="text-green-600 text-sm font-medium">✓ Ready to send</span> : 
    <span className="text-red-600 text-sm font-medium">✗ Not ready</span>

  return (
    <AccordionSection
      id="sending"
      title="Send Messages"
      status={sendingStatus}
      isExpanded={isExpanded}
      onToggle={onToggle}
      animationDelay="0.5s"
    >
      {/* Delay Configuration */}
      <div className="mb-8">
        <DelayConfiguration
          messageDelay={messageDelay}
          onDelayChange={onDelayChange}
          contactCount={contacts?.length || 0}
          getEstimatedCompletionTime={getEstimatedCompletionTime}
          formatEstimatedTime={formatEstimatedTime}
        />
      </div>

      <SendingPanel
        message={message}
        contacts={contacts}
        twilioConfig={twilioConfig}
        senderConfig={senderConfig}
        canSend={canSend}
        onSendMessages={onSendMessages}
        onScheduleMessages={onScheduleMessages}
        sending={sending}
        progress={progress}
        results={results}
        scheduledSending={scheduledSending}
        updateScheduling={updateScheduling}
        lastScheduledMessage={lastScheduledMessage}
        clearLastScheduledMessage={clearLastScheduledMessage}
        messageDelay={messageDelay}
      />
      
      {/* Scheduled Jobs Section */}
      {scheduledJobs && scheduledJobs.length > 0 && (
        <div className="mt-8">
          <ScheduledJobsSection 
            scheduledJobs={scheduledJobs}
            onCancelScheduledJob={onCancelScheduledJob}
            onUpdateJobStatus={onUpdateJobStatus}
          />
        </div>
      )}
    </AccordionSection>
  )
}

export default SendingSection
