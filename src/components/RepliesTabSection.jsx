import { useMemo, useState } from 'react'
import { Key, MessageCircle, Settings } from 'lucide-react'
import ConversationsSection from './ConversationsSection'

const RepliesTabSection = ({
  twilioConfig,
  senderConfig,
  replyHandlingEnabled,
  updateReplyHandlingEnabled,
  updateTwilioConfig,
}) => {
  const [activeSection, setActiveSection] = useState('settings')
  const [showApiKeySecret, setShowApiKeySecret] = useState(false)

  const repliesReady = useMemo(() => {
    return Boolean(
      replyHandlingEnabled &&
      twilioConfig?.accountSid &&
      twilioConfig?.apiKeySid &&
      twilioConfig?.apiKeySecret &&
      twilioConfig?.conversationServiceSid
    )
  }, [replyHandlingEnabled, twilioConfig])

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-gray-200 bg-white">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
            <span className="px-1.5 py-0.5 text-xs font-bold text-orange-700 bg-orange-100 rounded-full border border-orange-200">
              BETA
            </span>
          </div>

          <nav className="space-y-2">
          <button
            onClick={() => setActiveSection('settings')}
            className={`w-full flex items-center rounded-lg text-left transition-colors px-3 py-3 ${
              activeSection === 'settings'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="mr-3">
              <Settings className={`h-5 w-5 ${activeSection === 'settings' ? 'text-red-600' : 'text-gray-500'}`} />
            </div>
            <div className="flex-1">
              <div className={`font-medium ${activeSection === 'settings' ? 'text-red-900' : 'text-gray-900'}`}>Settings</div>
              <div className={`text-xs ${activeSection === 'settings' ? 'text-red-600' : 'text-gray-500'}`}>Replies configuration</div>
            </div>
          </button>

          <button
            onClick={() => setActiveSection('replies')}
            className={`w-full flex items-center rounded-lg text-left transition-colors px-3 py-3 ${
              activeSection === 'replies'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="mr-3">
              <MessageCircle className={`h-5 w-5 ${activeSection === 'replies' ? 'text-red-600' : 'text-gray-500'}`} />
            </div>
            <div className="flex-1">
              <div className={`font-medium ${activeSection === 'replies' ? 'text-red-900' : 'text-gray-900'}`}>Replies</div>
              <div className={`text-xs ${activeSection === 'replies' ? 'text-red-600' : 'text-gray-500'}`}>Conversations workspace</div>
            </div>
          </button>
          </nav>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full px-6 py-4">
          {activeSection === 'settings' && (
            <div className="max-w-3xl bg-white border border-gray-200 rounded-lg p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Replies Settings</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Configure realtime credentials and toggle Replies availability.
                </p>
              </div>

              <label className="flex items-center justify-between gap-4 border border-gray-200 rounded-lg p-4">
                <div>
                  <div className="text-sm font-medium text-gray-900">Enable Replies</div>
                  <p className="text-xs text-gray-500 mt-1">Turn this on to load the Replies workspace.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateReplyHandlingEnabled(!replyHandlingEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    replyHandlingEnabled ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                  aria-pressed={replyHandlingEnabled}
                  aria-label="Enable reply handling"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      replyHandlingEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>

              {replyHandlingEnabled ? (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Key className="inline w-4 h-4 mr-2" />
                        Account SID
                      </label>
                      <input
                        type="text"
                        value={twilioConfig?.accountSid || ''}
                        onChange={(e) => updateTwilioConfig({ accountSid: e.target.value })}
                        placeholder="Enter Twilio Account SID (AC...)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Key className="inline w-4 h-4 mr-2" />
                        API Key SID
                      </label>
                      <input
                        type="text"
                        value={twilioConfig?.apiKeySid || ''}
                        onChange={(e) => updateTwilioConfig({ apiKeySid: e.target.value })}
                        placeholder="Enter Twilio API Key SID (SK...)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Key className="inline w-4 h-4 mr-2" />
                        API Key Secret
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKeySecret ? 'text' : 'password'}
                          value={twilioConfig?.apiKeySecret || ''}
                          onChange={(e) => updateTwilioConfig({ apiKeySecret: e.target.value })}
                          placeholder="Enter Twilio API Key Secret"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKeySecret((prev) => !prev)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showApiKeySecret ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Key className="inline w-4 h-4 mr-2" />
                        Conversations Service SID
                      </label>
                      <input
                        type="text"
                        value={twilioConfig?.conversationServiceSid || ''}
                        onChange={(e) => updateTwilioConfig({ conversationServiceSid: e.target.value })}
                        placeholder="Enter Conversation Service SID (IS...)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow"
                      />
                      {!twilioConfig?.conversationServiceSid && (
                        <p className="text-xs text-red-600 mt-2">Conversations Service SID is required to use Replies.</p>
                      )}
                    </div>
                  </div>

                  <div className={`text-xs font-medium ${repliesReady ? 'text-green-700' : 'text-amber-700'}`}>
                    {repliesReady
                      ? 'Replies is ready to use.'
                      : 'Replies needs Enable Replies turned on plus Account SID, API Key SID, API Key Secret, and Conversations Service SID.'}
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-500">Turn on Enable Replies to show realtime credential inputs.</p>
              )}
            </div>
          )}

          {activeSection === 'replies' && (
            <div className="h-full min-h-0">
              {replyHandlingEnabled ? (
                <ConversationsSection twilioConfig={twilioConfig} senderConfig={senderConfig} />
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
                  Replies is currently off. Open Replies Settings in the left navigation and enable Replies.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RepliesTabSection
