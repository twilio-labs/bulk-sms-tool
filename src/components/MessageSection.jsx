import MessageComposer from './MessageComposer'
import AccordionSection from './AccordionSection'

const MessageSection = ({
  isExpanded,
  onToggle,
  message,
  onMessageChange,
  contacts
}) => {
  const messageStatus = message.trim() ? 
    <span className="text-green-600 text-sm font-medium">✓ Ready ({message.length} chars)</span> : 
    <span className="text-red-600 text-sm font-medium">✗ No message</span>

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
      />
    </AccordionSection>
  )
}

export default MessageSection
