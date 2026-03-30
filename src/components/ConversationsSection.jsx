import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useConversations } from '../hooks/useConversations'
import ConversationList from './ConversationList'
import ConversationDetail from './ConversationDetail'

const BACKGROUND_SYNC_INTERVAL_MS = 3 * 60 * 1000
const INITIAL_BACKGROUND_SYNC_DELAY_MS = 15 * 1000

const ConversationsSection = ({ twilioConfig, senderConfig }) => {
  const [selectedConversationId, setSelectedConversationId] = useState(null)
  const initializedConfigKeyRef = useRef(null)
  const {
    conversations,
    currentConversation,
    newIncomingMap,
    joiningConversationSid,
    loading,
    error,
    realtimeStatus,
    fetchConversations,
    fetchConversation,
    initializeRealtime,
    disconnectRealtime,
    sendReply,
    sendTemplateReply,
    markAsRead,
    clearNewIncomingForConversation,
    setCurrentConversation
  } = useConversations()

  const conversationsWithBadge = useMemo(() => {
    return conversations.map((conversation) => {
      const conversationSid = conversation?.sid
      const hasNewIncoming = Boolean(conversationSid && newIncomingMap[conversationSid])

      return {
        ...conversation,
        hasNewIncoming,
      }
    })
  }, [conversations, newIncomingMap])

  const selectedConversationSummary = useMemo(() => {
    const selectedSid = selectedConversationId || currentConversation?.sid
    if (!selectedSid) {
      return null
    }

    return conversationsWithBadge.find((conversation) => conversation.sid === selectedSid) || null
  }, [conversationsWithBadge, selectedConversationId, currentConversation?.sid])

  // Fetch conversations on component mount and when twilioConfig changes
  useEffect(() => {
    const setupConversations = async () => {
      if (!twilioConfig?.accountSid) {
        return
      }

      const configKey = [
        twilioConfig.accountSid || '',
        twilioConfig.apiKeySid || '',
        twilioConfig.apiKeySecret || '',
        twilioConfig.conversationServiceSid || '',
      ].join('|')

      if (initializedConfigKeyRef.current === configKey) {
        return
      }

      initializedConfigKeyRef.current = configKey

      await initializeRealtime(twilioConfig)
    }

    if (twilioConfig?.accountSid) {
      setupConversations()
    }

    // Only disconnect on unmount, not on config changes
    return () => {
      if (!twilioConfig?.accountSid) {
        disconnectRealtime()
        initializedConfigKeyRef.current = null
      }
    }
  }, [twilioConfig?.accountSid, twilioConfig?.apiKeySid, twilioConfig?.apiKeySecret, twilioConfig?.conversationServiceSid, initializeRealtime, disconnectRealtime])

  useEffect(() => {
    if (!twilioConfig?.accountSid) {
      return
    }

    const timeoutId = setTimeout(() => {
      fetchConversations(twilioConfig, { silent: true }).catch((syncError) => {
        console.warn('Initial background conversation sync failed:', syncError)
      })
    }, INITIAL_BACKGROUND_SYNC_DELAY_MS)

    const intervalId = setInterval(() => {
      fetchConversations(twilioConfig, { silent: true }).catch((syncError) => {
        console.warn('Background conversation sync failed:', syncError)
      })
    }, BACKGROUND_SYNC_INTERVAL_MS)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
    }
  }, [twilioConfig, fetchConversations])

  const handleSelectConversation = async (conversationSid) => {
    setSelectedConversationId(conversationSid)
    clearNewIncomingForConversation(conversationSid)
    setCurrentConversation(null) // Reset while loading
    await fetchConversation(conversationSid)
    markAsRead(conversationSid)
  }

  const handleSendReply = async (conversationSid, message) => {
    await sendReply(conversationSid, message)
  }

  const handleSendTemplateReply = async (conversation, contentTemplate) => {
    await sendTemplateReply(conversation, twilioConfig, senderConfig, contentTemplate)
  }

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Conversations</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Showing all active SMS and WhatsApp conversations in this Twilio account. This view is not tied to a specific campaign.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            realtimeStatus === 'connected'
              ? 'bg-green-100 text-green-700'
              : realtimeStatus === 'connecting'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
          }`}>
            {realtimeStatus === 'connected' ? 'Realtime On' : realtimeStatus === 'connecting' ? 'Realtime Connecting' : 'Realtime Off'}
          </span>
          <button
            onClick={() => twilioConfig?.accountSid && fetchConversations(twilioConfig)}
            disabled={!twilioConfig?.accountSid}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            title="Refresh conversations"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Configuration warning */}
      {!twilioConfig?.accountSid && (
        <div className="p-4 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded">
          Please configure Twilio credentials in the Settings tab to view and manage conversations
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {/* Main content area with list and detail panes */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Conversations List */}
        <div className="lg:col-span-1 border border-gray-200 rounded-lg bg-white overflow-hidden flex flex-col min-h-0">
          <div className="p-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">
              Conversations ({conversations.length})
            </h2>
          </div>
          <ConversationList
            conversations={conversationsWithBadge}
            selectedConversationId={selectedConversationId || currentConversation?.sid}
            onSelectConversation={handleSelectConversation}
            loading={loading && !conversations.length}
          />
        </div>

        {/* Conversation Detail */}
        <div className="lg:col-span-2 border border-gray-200 rounded-lg bg-white overflow-hidden flex flex-col min-h-0">
          <ConversationDetail
            conversation={currentConversation}
            selectedConversationId={selectedConversationId || currentConversation?.sid}
            onSendReply={handleSendReply}
            onSendTemplateReply={handleSendTemplateReply}
            twilioConfig={twilioConfig}
            senderConfig={senderConfig}
            conversationChannelFallback={selectedConversationSummary?.channel || null}
            isJoining={Boolean(joiningConversationSid) && joiningConversationSid === (selectedConversationId || currentConversation?.sid)}
            loading={loading && !currentConversation}
          />
        </div>
      </div>

    </div>
  )
}

export default ConversationsSection
