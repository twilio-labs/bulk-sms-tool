import { CheckCircle, Clock, Users, MessageSquare, Calendar, X } from 'lucide-react'

const ScheduleSuccessModal = ({ 
  isOpen, 
  onClose, 
  scheduledMessage 
}) => {
  if (!isOpen || !scheduledMessage) return null

  // Replace variables in message preview with first contact data
  const getPreviewMessage = () => {
    if (!scheduledMessage.message || !scheduledMessage.contacts?.length) {
      return scheduledMessage.message || ''
    }

    const firstContact = scheduledMessage.contacts[0]
    let preview = scheduledMessage.message
    
    Object.keys(firstContact).forEach(key => {
      if (key !== 'id' && key !== 'status') {
        const pattern = new RegExp(`\\{${key}\\}`, 'gi')
        const value = firstContact[key] || ''
        preview = preview.replace(pattern, value)
      }
    })
    
    return preview
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop with blur - no dark overlay */}
      <div className="fixed inset-0 backdrop-blur-md transition-all duration-300" onClick={onClose} />
      
      {/* Modal */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 transform transition-all">
          {/* Header */}
          <div className="bg-green-50 px-6 py-4 rounded-t-xl border-b border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-green-900">
                    Message Scheduled Successfully!
                  </h3>
                  <p className="text-sm text-green-700">
                    Your SMS will be sent automatically
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-green-600 hover:text-green-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Job Details */}
            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-3 text-blue-500" />
                <div>
                  <span className="font-medium text-gray-900">Scheduled for:</span>
                  <div className="text-gray-700">{scheduledMessage.scheduledFor}</div>
                </div>
              </div>

              <div className="flex items-center text-sm text-gray-600">
                <Users className="w-4 h-4 mr-3 text-purple-500" />
                <div>
                  <span className="font-medium text-gray-900">Recipients:</span>
                  <div className="text-gray-700">{scheduledMessage.contactCount} contacts</div>
                </div>
              </div>

              <div className="flex items-center text-sm text-gray-600">
                <Clock className="w-4 h-4 mr-3 text-orange-500" />
                <div>
                  <span className="font-medium text-gray-900">Job ID:</span>
                  <div className="text-gray-700 font-mono text-xs">{scheduledMessage.jobId}</div>
                </div>
              </div>
            </div>

            {/* Message Preview */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <MessageSquare className="w-4 h-4 mr-2 text-blue-500" />
                <span className="text-sm font-medium text-gray-900">Message Preview:</span>
              </div>
              <div className="bg-blue-500 text-white rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed">
                {getPreviewMessage()}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Preview shows how the message will appear with personalized data
              </div>
            </div>

            {/* Status Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start">
                <Clock className="w-4 h-4 mt-0.5 mr-2 text-blue-600" />
                <div className="text-sm">
                  <div className="font-medium text-blue-900">What happens next?</div>
                  <div className="text-blue-800 mt-1">
                    Your message will be sent automatically at the scheduled time. 
                    You can monitor progress in the "Scheduled Messages" section below.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-xl border-t border-gray-200">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScheduleSuccessModal