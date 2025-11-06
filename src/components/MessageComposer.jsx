import { MessageSquare, Type, Hash, Eye } from 'lucide-react'

const MessageComposer = ({
  message,
  onMessageChange,
  contacts
}) => {  
  // Get available variables from contacts
  const availableVariables = contacts.length > 0 
    ? Object.keys(contacts[0]).filter(key => !['id', 'status'].includes(key))
    : []

  const placeholderText = availableVariables.length > 0
    ? `Type your SMS message here... Available variables: ${availableVariables.map(v => `{${v}}`).join(', ')}`
    : "Type your SMS message here... Upload contacts first to see available variables like {name}, {phone}, {email}, etc."

  return (
    <div className="space-y-4">
      {/* Character Count */}
      <div className="flex items-center text-sm text-gray-600">
        <Type className="h-4 w-4 mr-1" />
        <span className="font-medium">{message.length}</span>
        <span className="text-gray-400 ml-2">characters</span>
      </div>

      {/* Message Textarea */}
      <div className="relative">
        <textarea
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          placeholder={placeholderText}
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow resize-none"
        />
      </div>

      {/* Available Variables */}
      {availableVariables.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center text-blue-900 text-sm font-medium mb-2">
            <Hash className="h-4 w-4 mr-1" />
            Available Variables
          </div>
          <div className="flex flex-wrap gap-2">
            {availableVariables.map((variable) => (
              <button
                key={variable}
                onClick={() => {
                  const cursorPos = document.activeElement === document.querySelector('textarea') 
                    ? document.querySelector('textarea').selectionStart 
                    : message.length;
                  const newMessage = message.substring(0, cursorPos) + `{${variable}}` + message.substring(cursorPos);
                  onMessageChange(newMessage);
                }}
                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors cursor-pointer"
              >
                {`{${variable}}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-blue-600 mt-2">
            Click any variable to insert it into your message, or type them manually.
          </p>
        </div>
      )}

      {/* Message Preview */}
      {message.trim() && (
        <div className="border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center">
              <Eye className="h-4 w-4 text-gray-500 mr-2" />
              <span className="text-sm font-medium text-gray-700">Message Preview</span>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {contacts.length > 0 && (
              <>
                <div>
                  <div className="text-xs text-gray-500 mb-2">📱 Preview with Sample Contact:</div>
                  <div className="bg-blue-500 text-white rounded-2xl rounded-bl-md px-4 py-3 max-w-sm ml-auto text-sm leading-relaxed">
                    {(() => {
                      const firstContact = contacts[0]
                      let preview = message
                      Object.keys(firstContact).forEach(key => {
                        const pattern = new RegExp(`\{${key}\}`, 'gi')
                        const value = firstContact[key] || ''
                        preview = preview.replace(pattern, value)
                      })
                      return preview
                    })()}
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-500 mb-2">📝 Raw Template:</div>
                  <div className="bg-gray-100 text-gray-700 rounded-2xl rounded-bl-md px-4 py-3 max-w-sm text-sm leading-relaxed border">
                    {message}
                  </div>
                </div>
              </>
            )}
            
            {contacts.length === 0 && (
              <div className="bg-gray-100 text-gray-700 rounded-2xl rounded-bl-md px-4 py-3 max-w-sm ml-auto text-sm leading-relaxed border">
                {message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tips */}
      {!message.trim() && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Message Tips:</h4>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Keep messages under 160 characters to avoid extra charges</li>
            <li>Use variables like {'{name}'} for personalization</li>
            <li>Include emojis sparingly (they use more characters)</li>
            <li>Test with a small group first</li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default MessageComposer
