import ContactUpload from './ContactUpload'
import AccordionSection from './AccordionSection'

const ContactsSection = ({
  isExpanded,
  onToggle,
  contacts,
  isUploading,
  uploadError,
  onFileUpload,
  validationSummary
}) => {
  const contactsStatus = contacts.length > 0 ? 
    <span className="text-green-600 text-sm font-medium">✓ {validationSummary.summary.valid} valid contacts</span> : 
    <span className="text-red-600 text-sm font-medium">✗ No contacts</span>

  return (
    <AccordionSection
      id="contacts"
      title="Upload Contacts"
      status={contactsStatus}
      isExpanded={isExpanded}
      onToggle={onToggle}
      animationDelay="0.2s"
    >
      <ContactUpload
        contacts={contacts}
        isUploading={isUploading}
        uploadError={uploadError}
        onFileUpload={onFileUpload}
        validationSummary={validationSummary}
      />
    </AccordionSection>
  )
}

export default ContactsSection
