import { Settings, Users, MessageSquare, BarChart3, Send, CheckCircle, Menu, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { useState } from 'react'

const Navigation = ({ 
  activeSection, 
  onSectionChange,
  sectionStatus = {},
  onReset // Reset function passed from parent
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const navigationItems = [
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      description: 'Twilio Configuration'
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: Users,
      description: 'Upload & Manage'
    },
    {
      id: 'message',
      label: 'Message',
      icon: MessageSquare,
      description: 'Compose SMS'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      betaTag: true,
      icon: BarChart3,
      description: 'Message Analysis'
    },
    {
      id: 'sending',
      label: 'Sending',
      icon: Send,
      description: 'Send & Results'
    }
  ]

  const handleReset = () => {
    setShowResetDialog(false)
    if (onReset) {
      onReset()
    }
  }

  return (
    <>
      <div className={`bg-white border-r border-gray-200 h-full transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}>
        <div className="p-4">
          {/* Header with Toggle */}
          <div className="flex items-center justify-between mb-4">
            {!isCollapsed && (
              <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title={isCollapsed ? 'Expand Navigation' : 'Collapse Navigation'}
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5 text-gray-600" />
              ) : (
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              )}
            </button>
          </div>
          
          {/* Navigation Items */}
          <nav className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              const isComplete = sectionStatus[item.id] || false
              
              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={`w-full flex items-center rounded-lg text-left transition-colors ${
                    isCollapsed ? 'px-2 py-3 justify-center' : 'px-3 py-3'
                  } ${
                    isActive
                      ? isComplete 
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                      : isComplete
                        ? 'text-green-700 hover:bg-green-50 hover:text-green-800'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className={`flex items-center ${isCollapsed ? '' : 'mr-3'}`}>
                    <Icon className={`h-5 w-5 ${
                      isActive
                        ? isComplete ? 'text-green-600' : 'text-red-600'
                        : isComplete ? 'text-green-600' : 'text-gray-500'
                    }`} />
                    {isComplete && !isCollapsed && (
                      <CheckCircle className="h-3 w-3 text-green-500 ml-1" />
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className="flex-1">
                      <div className={`font-medium flex items-center ${
                        isActive
                          ? isComplete ? 'text-green-900' : 'text-red-900'
                          : isComplete ? 'text-green-800' : 'text-gray-900'
                      }`}>
                        <span>{item.label}</span>
                        {item.betaTag && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs font-bold text-orange-700 bg-orange-100 rounded-full border border-orange-200">
                            BETA!
                          </span>
                        )}
                      </div>
                      <div className={`text-xs ${
                        isActive
                          ? isComplete ? 'text-green-600' : 'text-red-600'
                          : isComplete ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {item.description}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </nav>
          
          {/* Reset Button - inside same container as navigation */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowResetDialog(true)}
              className={`w-full flex items-center text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ${
                isCollapsed ? 'px-2 py-3 justify-center' : 'px-3 py-2'
              }`}
              title={isCollapsed ? 'Reset Workflow' : undefined}
            >
              <RotateCcw className="h-4 w-4" />
              {!isCollapsed && (
                <span className="ml-2 text-sm font-medium">Reset Workflow</span>
              )}
            </button>
          </div>
        </div>
        </div>

      {/* Reset Confirmation Dialog */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center mb-4">
              <RotateCcw className="h-6 w-6 text-red-500 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Reset Workflow</h3>
            </div>
            <p className="text-gray-600 mb-6">
              This will clear your uploaded contacts, message content, and results. 
              Your Twilio credentials and sender configuration will be preserved.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowResetDialog(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Navigation
