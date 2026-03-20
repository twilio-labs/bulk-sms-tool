import React from 'react'
import { CHANNEL_TYPE } from '../utils/constants'

const WhatsAppLogo = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <circle cx="12" cy="12" r="11" fill="#25D366" />
    <path
      fill="#FFFFFF"
      d="M17.6 14.5c-.2-.1-1.3-.7-1.5-.7s-.4-.1-.6.1c-.2.2-.7.7-.8.8-.1.1-.3.1-.5 0-.2-.1-.9-.3-1.7-1-.6-.6-1-1.3-1.1-1.6-.1-.2 0-.4.1-.5.1-.1.2-.3.3-.4.1-.1.2-.2.2-.4.1-.1 0-.3 0-.4 0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.4.6.3 1 .4 1.3.5.6.2 1.2.2 1.6.1.5-.1 1.3-.6 1.5-1.1.2-.5.2-1 .2-1.1-.1-.1-.2-.2-.4-.3z"
    />
  </svg>
)

const ConversationList = ({ 
  conversations, 
  selectedConversationId,
  onSelectConversation,
  loading 
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading conversations...</p>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 text-center">
          No conversations yet.<br/>
          Messages from contacts will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conversation, index) => {
        const conversationId = conversation.sid || conversation.phone || conversation.friendlyName
        const conversationKey = `${conversationId || 'conversation'}-${conversation.sid || index}`
        const displayName = conversation.phone || conversation.contactName || conversation.friendlyName || 'Unknown contact'

        return (
        <div
          key={conversationKey}
          onClick={() => onSelectConversation(conversationId)}
          className={`p-4 border-b border-gray-200 cursor-pointer transition-colors ${
            selectedConversationId === conversationId
              ? 'bg-blue-50 border-l-4 border-l-blue-500'
              : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 truncate">
                  {displayName}
                </h3>
                {conversation.unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {conversation.channel === CHANNEL_TYPE.WHATSAPP ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <WhatsAppLogo />
                    WhatsApp
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">📱 SMS</span>
                )}
              </p>
            </div>
            <div className="ml-2 flex-shrink-0">
              {conversation.hasNewIncoming && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 bg-orange-500 rounded-full text-white text-xs font-semibold" title="New messages">
                  New messages
                </span>
              )}
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mt-2 truncate">
            {conversation.lastMessage || 'No messages yet'}
          </p>
          
          {conversation.lastMessageTime && (
            <p className="text-xs text-gray-400 mt-1">
              {new Date(conversation.lastMessageTime).toLocaleString()}
            </p>
          )}
        </div>
      )})}
    </div>
  )
}

export default ConversationList
