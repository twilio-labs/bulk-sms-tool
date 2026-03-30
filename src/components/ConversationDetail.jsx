import React, { useState, useEffect, useRef } from 'react'
import { MESSAGE_DIRECTION, MESSAGE_STATUS, CHANNEL_TYPE } from '../utils/constants'
import { getContentTemplates } from '../services/smsService'

const WhatsAppLogo = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <circle cx="12" cy="12" r="11" fill="#25D366" />
    <path
      fill="#FFFFFF"
      d="M17.6 14.5c-.2-.1-1.3-.7-1.5-.7s-.4-.1-.6.1c-.2.2-.7.7-.8.8-.1.1-.3.1-.5 0-.2-.1-.9-.3-1.7-1-.6-.6-1-1.3-1.1-1.6-.1-.2 0-.4.1-.5.1-.1.2-.3.3-.4.1-.1.2-.2.2-.4.1-.1 0-.3 0-.4 0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.4.6.3 1 .4 1.3.5.6.2 1.2.2 1.6.1.5-.1 1.3-.6 1.5-1.1.2-.5.2-1 .2-1.1-.1-.1-.2-.2-.4-.3z"
    />
  </svg>
)

const ConversationDetail = ({
  conversation,
  selectedConversationId,
  onSendReply,
  onSendTemplateReply,
  twilioConfig,
  senderConfig,
  conversationChannelFallback,
  isJoining,
  loading,
  onMessagesLoaded
}) => {
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [sendingTemplate, setSendingTemplate] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [templatesError, setTemplatesError] = useState('')
  const [selectedTemplateSid, setSelectedTemplateSid] = useState('')
  const [templateVariables, setTemplateVariables] = useState({})
  const messagesContainerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const prevConversationSidRef = useRef(null)
  const prevMessageCountRef = useRef(0)

  const isWhatsAppConversation =
    conversation?.channel === CHANNEL_TYPE.WHATSAPP ||
    conversationChannelFallback === CHANNEL_TYPE.WHATSAPP
  const lastInboundMessage = Array.isArray(conversation?.messages)
    ? [...conversation.messages].reverse().find((message) => message.direction === MESSAGE_DIRECTION.INBOUND)
    : null
  const lastInboundTimestampMs = new Date(lastInboundMessage?.timestamp || 0).getTime()
  const isOutsideWhatsAppWindow = isWhatsAppConversation && (
    !Number.isFinite(lastInboundTimestampMs) ||
    Date.now() - lastInboundTimestampMs > 24 * 60 * 60 * 1000
  )
  const includeUnapprovedTemplates = isWhatsAppConversation && !isOutsideWhatsAppWindow
  const canFetchTemplates = Boolean(isWhatsAppConversation && twilioConfig?.accountSid && twilioConfig?.authToken)

  useEffect(() => {
    setSendError(null)
    setSendingReply(false)
    setSendingTemplate(false)
  }, [conversation?.sid])

  useEffect(() => {
    if (!canFetchTemplates) {
      setTemplates([])
      setTemplatesError('')
      setSelectedTemplateSid('')
      setTemplateVariables({})
      return
    }

    let isCancelled = false

    const fetchTemplates = async () => {
      setLoadingTemplates(true)
      setTemplatesError('')

      try {
        const fetchedTemplates = await getContentTemplates({
          accountSid: twilioConfig.accountSid,
          authToken: twilioConfig.authToken,
          includeUnapproved: includeUnapprovedTemplates,
        })

        if (!isCancelled) {
          setTemplates(Array.isArray(fetchedTemplates) ? fetchedTemplates : [])
        }
      } catch (error) {
        if (!isCancelled) {
          setTemplatesError(error.message || 'Failed to load templates')
        }
      } finally {
        if (!isCancelled) {
          setLoadingTemplates(false)
        }
      }
    }

    fetchTemplates()

    return () => {
      isCancelled = true
    }
  }, [canFetchTemplates, includeUnapprovedTemplates, twilioConfig?.accountSid, twilioConfig?.authToken])

  useEffect(() => {
    if (!selectedTemplateSid) {
      setTemplateVariables({})
      return
    }

    const template = templates.find((item) => item.sid === selectedTemplateSid)
    if (!template) {
      setTemplateVariables({})
      return
    }

    const initialVariables = {}
    Object.entries(template.variables || {}).forEach(([key, value]) => {
      initialVariables[key] = String(value || '')
    })

    setTemplateVariables(initialVariables)
  }, [selectedTemplateSid, templates])

  const scrollToBottom = () => {
    if (!messagesContainerRef.current) {
      return
    }

    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
  }

  useEffect(() => {
    const currentSid = conversation?.sid || null
    const messageCount = Array.isArray(conversation?.messages) ? conversation.messages.length : 0

    const sameConversation = prevConversationSidRef.current === currentSid
    const hasNewMessages = messageCount > prevMessageCountRef.current

    // On conversation switch, jump the messages pane to latest without moving the page.
    if (!sameConversation && currentSid) {
      scrollToBottom()
    }

    if (sameConversation && hasNewMessages) {
      scrollToBottom()
    }

    prevConversationSidRef.current = currentSid
    prevMessageCountRef.current = messageCount
  }, [conversation?.messages])

  const handleSendReply = async (e) => {
    e.preventDefault()

    if (isOutsideWhatsAppWindow) {
      return
    }
    
    if (!replyText.trim()) return

    setSendingReply(true)
    setSendError(null)

    try {
      await onSendReply(
        selectedConversationId,
        replyText
      )
      setReplyText('')
    } catch (error) {
      setSendError(error.message)
      console.error('Error sending reply:', error)
    } finally {
      setSendingReply(false)
    }
  }

  const handleSendTemplate = async () => {
    if (!selectedTemplateSid || !onSendTemplateReply || !conversation) {
      return
    }

    setSendingTemplate(true)
    setSendError(null)

    try {
      const selectedTemplate = templates.find((item) => item.sid === selectedTemplateSid)
      if (!selectedTemplate) {
        throw new Error('Please select a valid approved template')
      }

      const contentTemplate = {
        contentSid: selectedTemplate.sid,
        friendlyName: selectedTemplate.friendlyName,
        variables: templateVariables,
      }

      await onSendTemplateReply(conversation, contentTemplate)
      setSelectedTemplateSid('')
      setTemplateVariables({})
    } catch (error) {
      setSendError(error.message)
      console.error('Error sending template reply:', error)
    } finally {
      setSendingTemplate(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case MESSAGE_STATUS.SENT:
        return '✓'
      case MESSAGE_STATUS.DELIVERED:
        return '✓✓'
      case MESSAGE_STATUS.READ:
        return '✓✓'
      case MESSAGE_STATUS.FAILED:
        return '✗'
      default:
        return '...'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case MESSAGE_STATUS.DELIVERED:
      case MESSAGE_STATUS.READ:
        return 'text-blue-50 bg-blue-700/40'
      case MESSAGE_STATUS.SENT:
        return 'text-blue-50 bg-blue-600/30'
      case MESSAGE_STATUS.FAILED:
        return 'text-red-100 bg-red-600/50'
      default:
        return 'text-blue-50 bg-blue-600/30'
    }
  }

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) {
      return '--:--'
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">{isJoining ? 'Joining conversation...' : 'Loading conversation...'}</p>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Select a conversation to view messages</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {!conversation.messages || conversation.messages.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">No messages yet</p>
        ) : (
          conversation.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.direction === MESSAGE_DIRECTION.OUTBOUND ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  message.direction === MESSAGE_DIRECTION.OUTBOUND
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-gray-200 text-gray-900 rounded-bl-none'
                }`}
              >
                <p className="break-words whitespace-pre-wrap">{message.text}</p>
                <div className="flex items-center gap-1 mt-1 text-xs">
                  <span className={message.direction === MESSAGE_DIRECTION.OUTBOUND ? 'text-blue-50' : 'text-gray-600'}>
                    {formatMessageTime(message.timestamp)}
                  </span>
                  {message.direction === MESSAGE_DIRECTION.OUTBOUND && (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${getStatusColor(message.status)}`}
                      title={`Status: ${message.status || 'unknown'}`}
                    >
                      <span>{getStatusIcon(message.status)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send Reply Form */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        {sendError && (
          <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {sendError}
          </div>
        )}
        
        {!twilioConfig?.accountSid ? (
          <div className="p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded text-sm">
            Please configure Twilio credentials to send replies
          </div>
        ) : (
          <form onSubmit={handleSendReply} className="space-y-3">
            {isOutsideWhatsAppWindow && (
              <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded text-sm space-y-2">
                <p className="font-medium">WhatsApp 24-hour window expired.</p>
                <p>Free-form replies are disabled. Select an approved template to continue this conversation.</p>
              </div>
            )}

            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={isOutsideWhatsAppWindow ? 'Free-form replies are disabled after 24 hours for WhatsApp.' : 'Type your reply...'}
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              disabled={sendingReply || isOutsideWhatsAppWindow}
              readOnly={isOutsideWhatsAppWindow}
            />

            {isWhatsAppConversation && (
              <div className="space-y-3 p-3 border border-amber-200 rounded-lg bg-white">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp template</label>
                  <select
                    value={selectedTemplateSid}
                    onChange={(e) => setSelectedTemplateSid(e.target.value)}
                    disabled={loadingTemplates || sendingTemplate || !canFetchTemplates}
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a template</option>
                    {templates.map((template) => (
                      <option key={template.sid} value={template.sid}>
                        {template.friendlyName || template.sid}
                      </option>
                    ))}
                  </select>
                  {loadingTemplates && <p className="text-xs text-gray-500 mt-1">Loading templates...</p>}
                  {templatesError && <p className="text-xs text-red-600 mt-1">{templatesError}</p>}
                </div>

                {selectedTemplateSid && Object.keys(templateVariables).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Template variables</p>
                    {Object.keys(templateVariables).map((key) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{key}</label>
                        <input
                          type="text"
                          value={templateVariables[key] || ''}
                          onChange={(e) => setTemplateVariables((prev) => ({ ...prev, [key]: e.target.value }))}
                          disabled={sendingTemplate}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReplyText('')}
                disabled={sendingReply || sendingTemplate}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={sendingReply || !replyText.trim() || isOutsideWhatsAppWindow}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {sendingReply ? 'Sending...' : 'Send Reply'}
              </button>
              {isWhatsAppConversation && (
                <button
                  type="button"
                  onClick={handleSendTemplate}
                  disabled={sendingTemplate || !selectedTemplateSid}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {sendingTemplate ? 'Sending...' : 'Send Template'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default ConversationDetail
