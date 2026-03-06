import MessageComposer from './MessageComposer'
import AccordionSection from './AccordionSection'

const MessageSection = ({
  isExpanded,
  onToggle,
  message,
  onMessageChange,
  contacts,
  twilioConfig,
  senderConfig,
  contentTemplate,
  onContentTemplateChange
}) => {
  const isWhatsAppChannel = senderConfig?.channel === 'whatsapp'
  const isTemplateMode = isWhatsAppChannel && !!contentTemplate?.contentSid
  const isTemplateConfigured = isTemplateMode && Object.values(contentTemplate?.variables || {}).every(value => String(value).trim().length > 0)
  const hasMessageContent = isWhatsAppChannel ? isTemplateConfigured : message.trim()

  const messageStatus = hasMessageContent ? 
    <span className="text-green-600 text-sm font-medium">✓ Ready ({isTemplateMode ? 'Template selected' : `${message.length} chars`})</span> : 
    <span className="text-red-600 text-sm font-medium">✗ {isWhatsAppChannel ? 'Template required' : 'No message'}</span>

  return (
    <AccordionSection
      id="message"
      title="Compose Message"
      status={messageStatus}
      isExpanded={isExpanded}
      onToggle={onToggle}
      animationDelay="0.3s"
    >
      <MessageComposer
        message={message}
        onMessageChange={onMessageChange}
        contacts={contacts}
        twilioConfig={twilioConfig}
        senderConfig={senderConfig}
        contentTemplate={contentTemplate}
        onContentTemplateChange={onContentTemplateChange}
      />
    </AccordionSection>
  )
}

export default MessageSection
