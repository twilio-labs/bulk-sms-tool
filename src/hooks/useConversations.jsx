import { useState, useCallback, useEffect, useRef } from 'react'
import { Client as TwilioConversationsClient } from '@twilio/conversations'
import { API_ENDPOINTS, CHANNEL_TYPE, MESSAGE_DIRECTION, MESSAGE_STATUS } from '../utils/constants'

export const useConversations = () => {
  const [conversations, setConversations] = useState([])
  const [currentConversation, setCurrentConversation] = useState(null)
  const [newIncomingMap, setNewIncomingMap] = useState({})
  const [joiningConversationSid, setJoiningConversationSid] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected')
  const [realtimeIdentity, setRealtimeIdentity] = useState(null)
  const clientRef = useRef(null)
  const currentConversationRef = useRef(null)
  const twilioConfigRef = useRef(null)
  const pendingConversationSidRef = useRef(null)
  const requestedConversationSidRef = useRef(null)
  const conversationFetchRequestIdRef = useRef(0)
  const listSnapshotRef = useRef(new Map())
  const hasHydratedListSnapshotRef = useRef(false)
  const realtimeInitPromiseRef = useRef(null)
  const realtimeInitConfigKeyRef = useRef(null)
  const realtimeStatusRef = useRef('disconnected')

  useEffect(() => {
    realtimeStatusRef.current = realtimeStatus
  }, [realtimeStatus])

  const clearNewIncomingForConversation = useCallback((conversationSid) => {
    if (!conversationSid) {
      return
    }

    setNewIncomingMap((prev) => {
      if (!prev[conversationSid]) {
        return prev
      }

      const next = { ...prev }
      delete next[conversationSid]
      return next
    })
  }, [])

  const getTimestampMs = useCallback((value) => {
    const timestamp = new Date(value || 0).getTime()
    return Number.isFinite(timestamp) ? timestamp : 0
  }, [])

  const reconcileIncomingBadgesFromList = useCallback((nextConversations) => {
    const nextSnapshot = new Map()

    for (const conversation of nextConversations || []) {
      if (!conversation?.sid) {
        continue
      }

      nextSnapshot.set(conversation.sid, {
        timestampMs: getTimestampMs(conversation.lastMessageTime),
        direction: conversation.lastMessageDirection || null,
      })
    }

    if (!hasHydratedListSnapshotRef.current) {
      listSnapshotRef.current = nextSnapshot
      hasHydratedListSnapshotRef.current = true
      return
    }

    const previousSnapshot = listSnapshotRef.current
    const activeConversationSid = requestedConversationSidRef.current || currentConversationRef.current?.sid

    setNewIncomingMap((prev) => {
      let changed = false
      const nextMap = { ...prev }

      for (const [sid, currentMeta] of nextSnapshot.entries()) {
        const previousMeta = previousSnapshot.get(sid)
        const hasNewerMessage = currentMeta.timestampMs > (previousMeta?.timestampMs || 0)
        const isInbound = currentMeta.direction === 'inbound'

        if (hasNewerMessage && isInbound && sid !== activeConversationSid && !nextMap[sid]) {
          nextMap[sid] = true
          changed = true
        }
      }

      return changed ? nextMap : prev
    })

    listSnapshotRef.current = nextSnapshot
  }, [getTimestampMs])

  useEffect(() => {
    currentConversationRef.current = currentConversation
  }, [currentConversation])

  const waitForClientConnection = useCallback(async (client, timeoutMs = 8000) => {
    if (!client) {
      return false
    }

    if (client.connectionState === 'connected') {
      return true
    }

    if (client.connectionState === 'denied' || client.connectionState === 'disconnected') {
      return false
    }

    return await new Promise((resolve) => {
      let settled = false

      const finalize = (value) => {
        if (settled) {
          return
        }

        settled = true
        clearTimeout(timeout)
        client.off('connectionStateChanged', onState)
        resolve(value)
      }

      const onState = (state) => {
        if (state === 'connected') {
          finalize(true)
        } else if (state === 'denied' || state === 'disconnected') {
          finalize(false)
        }
      }

      const timeout = setTimeout(() => {
        finalize(client.connectionState === 'connected')
      }, timeoutMs)

      client.on('connectionStateChanged', onState)
    })
  }, [])

  const mapConversationParticipants = useCallback(async (conversation) => {
    const participants = await conversation.getParticipants().catch(() => [])
    const nonChatParticipant = participants.find(
      (participant) => participant.identity !== realtimeIdentity
    )

    const addressCandidates = [
      nonChatParticipant?.messagingBinding?.address,
      nonChatParticipant?.messagingBinding?.projectedAddress,
      nonChatParticipant?.attributes?.proxy_address,
      nonChatParticipant?.attributes?.projected_address,
      nonChatParticipant?.attributes?.address,
      nonChatParticipant?.attributes?.phone,
      nonChatParticipant?.identity,
    ]

    const normalizedCandidates = addressCandidates
      .filter((candidate) => typeof candidate === 'string' && candidate.trim())
      .map((candidate) => String(candidate).trim())

    const rawAddress = normalizedCandidates[0] || null
    const normalizedAddress = rawAddress ? rawAddress.replace(/^whatsapp:/i, '').trim() : null

    const phone =
      normalizedAddress ||
      conversation.uniqueName ||
      null

    const hasWhatsAppAddress = normalizedCandidates.some((candidate) => candidate.toLowerCase().startsWith('whatsapp:'))
    const channel = hasWhatsAppAddress ? CHANNEL_TYPE.WHATSAPP : CHANNEL_TYPE.SMS

    return {
      phone,
      channel,
      contactName: conversation.friendlyName || phone,
      friendlyName: conversation.friendlyName || conversation.uniqueName || conversation.sid,
    }
  }, [realtimeIdentity])

  const mapConversationSummary = useCallback(async (conversation) => {
    const participantData = await mapConversationParticipants(conversation)
    const messagePaginator = await conversation.getMessages(1).catch(() => ({ items: [] }))
    const latestMessage = messagePaginator.items[0]
    const unreadCountRaw = await conversation.getUnreadMessagesCount().catch(() => 0)
    const unreadCount = Number.isFinite(unreadCountRaw) ? unreadCountRaw : 0

    return {
      sid: conversation.sid,
      ...participantData,
      unreadCount,
      hasReply: unreadCount > 0,
      lastMessage: latestMessage?.body || 'No messages yet',
      lastMessageAuthor: latestMessage?.author || null,
      lastMessageDirection: latestMessage
        ? (latestMessage.author === realtimeIdentity ? 'outbound' : 'inbound')
        : null,
      lastMessageTime: latestMessage?.dateCreated || conversation.dateUpdated || conversation.dateCreated,
      messageCount: conversation.lastMessage?.index != null ? conversation.lastMessage.index + 1 : 0,
    }
  }, [mapConversationParticipants, realtimeIdentity])

  const mapConversationDetail = useCallback(async (conversation) => {
    const participantData = await mapConversationParticipants(conversation)
    const pageSize = 50

    let paginator = await conversation.getMessages(pageSize)
    const collected = [...paginator.items]

    while (paginator.hasPrevPage) {
      paginator = await paginator.prevPage()
      collected.unshift(...paginator.items)
    }

    const unreadCountRaw = await conversation.getUnreadMessagesCount().catch(() => 0)
    const unreadCount = Number.isFinite(unreadCountRaw) ? unreadCountRaw : 0

    const messages = collected.map((message) => {
      const outbound = message.author === realtimeIdentity

      return {
        id: message.sid || String(message.index),
        sid: message.sid,
        text: message.body || '',
        author: message.author,
        direction: outbound ? MESSAGE_DIRECTION.OUTBOUND : MESSAGE_DIRECTION.INBOUND,
        status: outbound ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.READ,
        timestamp: message.dateCreated || new Date().toISOString(),
      }
    })

    return {
      sid: conversation.sid,
      ...participantData,
      unreadCount,
      messages,
    }
  }, [mapConversationParticipants, realtimeIdentity])

  const getConversationResource = useCallback(async (conversationSid) => {
    if (!clientRef.current || !conversationSid) {
      return null
    }

    try {
      return await clientRef.current.getConversationBySid(conversationSid)
    } catch (_error) {
      // For conversations not yet joined/subscribed, peek still allows read access.
      if (typeof clientRef.current.peekConversationBySid === 'function') {
        return await clientRef.current.peekConversationBySid(conversationSid)
      }

      throw _error
    }
  }, [])

  const ensureConversationSubscribed = useCallback(async (conversation) => {
    if (!conversation) {
      return conversation
    }

    if (conversation.status !== 'joined' && typeof conversation.join === 'function') {
      await conversation.join()
    }

    return conversation
  }, [])

  const isForbiddenError = useCallback((error) => {
    const message = String(error?.message || '').toLowerCase()
    const code = Number(error?.code)
    return (
      code === 403 ||
      message.includes('forbidden') ||
      message.includes('permission')
    )
  }, [])

  const subscribeViaServer = useCallback(async (conversationSid) => {
    if (!conversationSid || !twilioConfigRef.current?.accountSid || !twilioConfigRef.current?.authToken || !realtimeIdentity) {
      return false
    }

    const subscribeUrl = API_ENDPOINTS.CONVERSATION_SUBSCRIBE.replace(':conversationSid', encodeURIComponent(conversationSid))
    const response = await fetch(subscribeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        twilioConfig: twilioConfigRef.current,
        identity: realtimeIdentity,
      }),
    })

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}))
      throw new Error(errBody.error || 'Failed to subscribe to conversation')
    }

    return true
  }, [realtimeIdentity])

  const sleep = useCallback(async (ms) => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }, [])

  const ensureConversationAccess = useCallback(async (conversationSid) => {
    let lastError = null

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const conversation = await getConversationResource(conversationSid)
        if (!conversation) {
          throw new Error('Conversation not found')
        }

        try {
          await ensureConversationSubscribed(conversation)
          return conversation
        } catch (joinError) {
          if (!isForbiddenError(joinError)) {
            throw joinError
          }

          lastError = joinError
          await subscribeViaServer(conversationSid)
          await sleep(300)
        }
      } catch (fetchError) {
        if (!isForbiddenError(fetchError)) {
          throw fetchError
        }

        lastError = fetchError
        await subscribeViaServer(conversationSid)
        await sleep(300)
      }
    }

    throw lastError || new Error('Unable to access conversation')
  }, [ensureConversationSubscribed, getConversationResource, isForbiddenError, sleep, subscribeViaServer])

  const fetchConversations = useCallback(async (twilioConfig, options = {}) => {
    const silent = Boolean(options?.silent)

    if (!silent) {
      setLoading(true)
    }
    setError(null)

    try {
      const effectiveConfig = twilioConfig || twilioConfigRef.current
      const listViaApi = Boolean(effectiveConfig?.accountSid)

      if (listViaApi) {
        const query = new URLSearchParams({
          twilioConfig: JSON.stringify(effectiveConfig)
        })
        const response = await fetch(`${API_ENDPOINTS.CONVERSATIONS}?${query}`)

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}))
          throw new Error(errBody.error || `Failed to load conversations (HTTP ${response.status})`)
        }

        const data = await response.json()
        const apiConversations = Array.isArray(data.conversations) ? data.conversations : []
        reconcileIncomingBadgesFromList(apiConversations)
        setConversations(apiConversations)
        return
      }

      if (!clientRef.current) {
        return
      }

      const clientReady = await waitForClientConnection(clientRef.current)
      if (!clientReady) {
        return
      }

      let paginator = await clientRef.current.getSubscribedConversations()
      const deduped = []
      const seen = new Set()

      while (paginator) {
        for (const conversation of paginator.items || []) {
          const key = conversation?.sid || conversation?.uniqueName || conversation?.friendlyName

          if (!key || seen.has(key)) {
            continue
          }

          seen.add(key)
          const summary = await mapConversationSummary(conversation)

          // Match prior behavior: hide empty conversations by default.
          if (summary.messageCount > 0) {
            deduped.push(summary)
          }
        }

        paginator = paginator.hasNextPage ? await paginator.nextPage() : null
      }

      deduped.sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0))
      reconcileIncomingBadgesFromList(deduped)
      setConversations(deduped)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching conversations:', err)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [mapConversationSummary, reconcileIncomingBadgesFromList, waitForClientConnection])

  const fetchConversation = useCallback(async (conversationSid) => {
    if (!conversationSid) {
      return
    }

    if (!clientRef.current) {
      requestedConversationSidRef.current = conversationSid
      pendingConversationSidRef.current = conversationSid
      return
    }

    requestedConversationSidRef.current = conversationSid
    const requestId = conversationFetchRequestIdRef.current + 1
    conversationFetchRequestIdRef.current = requestId

    setLoading(true)
    setJoiningConversationSid(conversationSid)
    const clientReady = await waitForClientConnection(clientRef.current)

    if (!clientReady) {
      if (conversationFetchRequestIdRef.current === requestId) {
        setJoiningConversationSid(null)
        setLoading(false)
      }
      return
    }

    if (conversationFetchRequestIdRef.current === requestId) {
      setError(null)
    }

    try {
      const conversation = await ensureConversationAccess(conversationSid)

      const detail = await mapConversationDetail(conversation)

      // Only commit result if this is still the latest selected conversation.
      if (
        conversationFetchRequestIdRef.current === requestId &&
        requestedConversationSidRef.current === conversationSid
      ) {
        setCurrentConversation(detail)
        // Keep the selected row metadata fresh, but do not block detail rendering.
        fetchConversations(twilioConfigRef.current).catch((refreshError) => {
          console.warn('Background conversation list refresh failed:', refreshError)
        })
      }
    } catch (err) {
      if (conversationFetchRequestIdRef.current === requestId) {
        setError(err.message)
      }
      console.error('Error fetching conversation:', err)
    } finally {
      if (conversationFetchRequestIdRef.current === requestId) {
        setJoiningConversationSid(null)
        setLoading(false)
      }
    }
  }, [ensureConversationAccess, fetchConversations, mapConversationDetail, waitForClientConnection])

  const disconnectRealtime = useCallback(async () => {
    try {
      if (clientRef.current) {
        clientRef.current.removeAllListeners()
        clientRef.current.shutdown()
        clientRef.current = null
      }
    } catch (_error) {
      // Ignore shutdown errors; cleanup should remain best-effort.
    }

    pendingConversationSidRef.current = null
    realtimeInitPromiseRef.current = null
    realtimeInitConfigKeyRef.current = null

    setRealtimeStatus('disconnected')
  }, [])

  const initializeRealtime = useCallback(async (twilioConfig) => {
    if (!twilioConfig?.accountSid) {
      return false
    }

    const configKey = [
      twilioConfig.accountSid || '',
      twilioConfig.apiKeySid || '',
      twilioConfig.apiKeySecret || '',
      twilioConfig.conversationServiceSid || '',
    ].join('|')

    if (
      realtimeInitConfigKeyRef.current === configKey &&
      clientRef.current &&
      (realtimeStatusRef.current === 'connected' || realtimeStatusRef.current === 'connecting')
    ) {
      return true
    }

    if (
      realtimeInitConfigKeyRef.current === configKey &&
      realtimeInitPromiseRef.current
    ) {
      return await realtimeInitPromiseRef.current
    }

    twilioConfigRef.current = twilioConfig

    if (!twilioConfig?.apiKeySid || !twilioConfig?.apiKeySecret) {
      setRealtimeStatus('disconnected')
      setError('Realtime requires API Key SID and API Key Secret in Twilio settings')
      return false
    }

    if (!twilioConfig?.conversationServiceSid) {
      setRealtimeStatus('disconnected')
      setError('Replies requires a Conversations Service SID in Twilio settings')
      return false
    }

    const initPromise = (async () => {
      try {
      setRealtimeStatus('connecting')

      const storedIdentity = sessionStorage.getItem('twilio-conversations-identity')

      const tokenResponse = await fetch(API_ENDPOINTS.CONVERSATIONS_TOKEN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          twilioConfig,
          identity: storedIdentity || undefined,
        })
      })

      if (!tokenResponse.ok) {
        const errBody = await tokenResponse.json().catch(() => ({}))
        if (tokenResponse.status === 429) {
          throw new Error('Too many realtime initialization attempts. Please wait a minute and try again.')
        }
        throw new Error(errBody.error || `Token request failed (HTTP ${tokenResponse.status})`)
      }

      const tokenData = await tokenResponse.json()
      if (!tokenData.token) {
        throw new Error('No token returned from server')
      }

      const client = new TwilioConversationsClient(tokenData.token)

      if (tokenData.identity) {
        sessionStorage.setItem('twilio-conversations-identity', tokenData.identity)
        setRealtimeIdentity(tokenData.identity)
      }

      await new Promise((resolve, reject) => {
        const onState = (state) => {
          if (state === 'connected') {
            client.off('connectionStateChanged', onState)
            resolve()
          } else if (state === 'denied') {
            client.off('connectionStateChanged', onState)
            reject(new Error('Realtime connection denied - check API Key permissions and Conversations access'))
          }
        }

        client.on('connectionStateChanged', onState)

        if (client.connectionState === 'connected') {
          client.off('connectionStateChanged', onState)
          resolve()
        }
      })

      client.on('connectionStateChanged', (state) => {
        if (state === 'connected') {
          setRealtimeStatus('connected')
          setError(null)
        } else if (state === 'disconnected' || state === 'denied') {
          setRealtimeStatus('disconnected')
        }
      })

      const refreshFromEvents = async () => {
        await fetchConversations(twilioConfig)

        const activeConversationSid = requestedConversationSidRef.current || currentConversationRef.current?.sid
        if (activeConversationSid) {
          await fetchConversation(activeConversationSid)
        }
      }

      const handleMessageAdded = async (message) => {
        const sid = message?.conversation?.sid || message?.conversationSid || message?.channelSid || null

        if (sid) {
          const isInbound = message?.author && message.author !== realtimeIdentity
          const activeConversationSid = requestedConversationSidRef.current || currentConversationRef.current?.sid

          if (isInbound && activeConversationSid !== sid) {
            setNewIncomingMap((prev) => ({
              ...prev,
              [sid]: true,
            }))
          }
        }

        await refreshFromEvents()
      }

      client.on('conversationAdded', refreshFromEvents)
      client.on('conversationUpdated', refreshFromEvents)
      client.on('conversationRemoved', refreshFromEvents)
      client.on('messageAdded', handleMessageAdded)
      client.on('messageUpdated', refreshFromEvents)

      if (clientRef.current) {
        clientRef.current.removeAllListeners()
        clientRef.current.shutdown()
      }

      clientRef.current = client
      setRealtimeStatus('connected')
      await fetchConversations(twilioConfig)

      if (pendingConversationSidRef.current) {
        const pendingConversationSid = pendingConversationSidRef.current
        pendingConversationSidRef.current = null
        await fetchConversation(pendingConversationSid)
      }

      return true
    } catch (err) {
      console.error('Realtime initialization failed:', err)
      setRealtimeStatus('disconnected')
      setError(`Realtime connection failed: ${err.message}`)
      return false
      } finally {
        realtimeInitPromiseRef.current = null
      }
    })()

    realtimeInitConfigKeyRef.current = configKey
    realtimeInitPromiseRef.current = initPromise

    return await initPromise
  }, [fetchConversation, fetchConversations])

  const sendReply = useCallback(async (conversationSid, message) => {
    try {
      if (!clientRef.current) {
        throw new Error('Conversation client not initialized')
      }

      const clientReady = await waitForClientConnection(clientRef.current)
      if (!clientReady) {
        throw new Error('Realtime connection is not ready yet. Please try again.')
      }

      const conversation = await ensureConversationAccess(conversationSid)

      const result = await conversation.sendMessage(message)

      fetchConversation(conversationSid).catch((refreshError) => {
        console.warn('Background conversation refresh failed after send reply:', refreshError)
      })
      fetchConversations(twilioConfigRef.current).catch((refreshError) => {
        console.warn('Background list refresh failed after send reply:', refreshError)
      })

      return result
    } catch (err) {
      console.error('Error sending reply:', err)
      throw err
    }
  }, [ensureConversationAccess, fetchConversation, fetchConversations, waitForClientConnection])

  const sendTemplateReply = useCallback(async (conversation, twilioConfig, senderConfig, contentTemplate) => {
    if (!conversation?.sid) {
      throw new Error('Conversation is unavailable for template sending')
    }

    const response = await fetch(API_ENDPOINTS.SEND_TEMPLATE_REPLY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: conversation.phone || null,
        conversationSid: conversation.sid,
        twilioConfig,
        senderConfig,
        contentTemplate,
      }),
    })

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}))
      throw new Error(errBody.error || 'Failed to send template reply')
    }

    const result = await response.json()

    if (conversation?.sid) {
      fetchConversation(conversation.sid).catch((refreshError) => {
        console.warn('Background conversation refresh failed after send template:', refreshError)
      })
      fetchConversations(twilioConfigRef.current).catch((refreshError) => {
        console.warn('Background list refresh failed after send template:', refreshError)
      })
    }

    return result
  }, [fetchConversation, fetchConversations])

  const markAsRead = useCallback(async (conversationSid) => {
    try {
      if (!clientRef.current || !conversationSid) {
        return
      }

      const clientReady = await waitForClientConnection(clientRef.current)
      if (!clientReady) {
        return
      }

      const conversation = await ensureConversationAccess(conversationSid)

      await conversation.setAllMessagesRead()

      setConversations(prev =>
        prev.map(conv =>
          conv.sid === conversationSid
            ? { ...conv, unreadCount: 0 }
            : conv
        )
      )

      if (currentConversation?.sid === conversationSid) {
        setCurrentConversation(prev => ({ ...prev, unreadCount: 0 }))
      }
    } catch (err) {
      console.error('Error marking conversation as read:', err)
    }
  }, [currentConversation, ensureConversationAccess, waitForClientConnection])

  const getMessageStatus = useCallback(async (messageId) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.MESSAGE_STATUS}/${messageId}`)
      if (!response.ok) throw new Error('Failed to fetch message status')
      return await response.json()
    } catch (err) {
      console.error('Error fetching message status:', err)
      throw err
    }
  }, [])

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.removeAllListeners()
        clientRef.current.shutdown()
        clientRef.current = null
      }
    }
  }, [])

  return {
    conversations,
    currentConversation,
    newIncomingMap,
    joiningConversationSid,
    loading,
    error,
    realtimeStatus,
    realtimeIdentity,
    fetchConversations,
    fetchConversation,
    initializeRealtime,
    disconnectRealtime,
    sendReply,
    sendTemplateReply,
    markAsRead,
    clearNewIncomingForConversation,
    getMessageStatus,
    setCurrentConversation,
    setConversations
  }
}
