import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, Type, Hash, Eye, RefreshCw } from 'lucide-react'
import { getContentTemplates } from '../services/smsService'

const MessageComposer = ({
  message,
  onMessageChange,
  contacts,
  twilioConfig,
  senderConfig,
  contentTemplate,
  onContentTemplateChange
}) => {  
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [templatesError, setTemplatesError] = useState('')
  const [includeUnapprovedTemplates, setIncludeUnapprovedTemplates] = useState(false)
  const [isListPickerOpen, setIsListPickerOpen] = useState(false)

  const isWhatsApp = senderConfig?.channel === 'whatsapp'
  const isTemplateMode = isWhatsApp && !!contentTemplate?.contentSid

  // Get available variables from contacts
  const availableVariables = contacts.length > 0 
    ? Object.keys(contacts[0]).filter(key => !['id', 'status'].includes(key))
    : []

  const canFetchTemplates = isWhatsApp && twilioConfig?.accountSid && twilioConfig?.authToken

  const variableKeys = useMemo(
    () => Object.keys(contentTemplate?.variables || {}),
    [contentTemplate?.variables]
  )

  const fetchTemplates = async () => {
    if (!canFetchTemplates) {
      return
    }

    setLoadingTemplates(true)
    setTemplatesError('')

    try {
      const fetchedTemplates = await getContentTemplates({
        accountSid: twilioConfig.accountSid,
        authToken: twilioConfig.authToken,
        includeUnapproved: includeUnapprovedTemplates,
      })

      setTemplates(fetchedTemplates)
    } catch (error) {
      setTemplatesError(error.message)
    } finally {
      setLoadingTemplates(false)
    }
  }

  useEffect(() => {
    if (canFetchTemplates) {
      fetchTemplates()
    }
  }, [twilioConfig?.accountSid, twilioConfig?.authToken, senderConfig?.channel, includeUnapprovedTemplates])

  useEffect(() => {
    if (!isWhatsApp && contentTemplate) {
      onContentTemplateChange?.(null)
    }
  }, [isWhatsApp, contentTemplate, onContentTemplateChange])

  useEffect(() => {
    if (!contentTemplate?.contentSid) {
      return
    }

    const existsInList = templates.some(template => template.sid === contentTemplate.contentSid)
    if (!existsInList) {
      onContentTemplateChange?.(null)
    }
  }, [templates, contentTemplate?.contentSid, onContentTemplateChange])

  useEffect(() => {
    setIsListPickerOpen(false)
  }, [contentTemplate?.contentSid])

  const handleTemplateSelection = (contentSid) => {
    if (!contentSid) {
      onContentTemplateChange?.(null)
      return
    }

    const selectedTemplate = templates.find(template => template.sid === contentSid)

    if (!selectedTemplate) {
      return
    }

    const initialVariables = {}
    Object.entries(selectedTemplate.variables || {}).forEach(([key, value]) => {
      initialVariables[key] = String(value || '')
    })

    onContentTemplateChange?.({
      contentSid: selectedTemplate.sid,
      friendlyName: selectedTemplate.friendlyName,
      language: selectedTemplate.language,
      whatsappCategory: selectedTemplate.whatsappCategory,
      types: selectedTemplate.types || {},
      variables: initialVariables,
    })
  }

  const updateTemplateVariable = (key, value) => {
    onContentTemplateChange?.({
      ...contentTemplate,
      variables: {
        ...(contentTemplate?.variables || {}),
        [key]: value,
      }
    })
  }

  const personalizeWithContact = (value, contact) => {
    if (!value || typeof value !== 'string' || !contact) {
      return value || ''
    }

    let personalized = value
    Object.keys(contact).forEach((key) => {
      if (key === 'id' || key === 'status') return
      const pattern = new RegExp(`\\{${key}\\}`, 'gi')
      personalized = personalized.replace(pattern, contact[key] || '')
    })

    return personalized
  }

  const extractMediaUrls = (value, resolvedVariables) => {
    const urls = []

    const pushUrl = (candidate) => {
      if (typeof candidate !== 'string') return
      const resolved = applyResolvedVariables(candidate, resolvedVariables).trim()
      if (!resolved) return
      urls.push(resolved)
    }

    if (typeof value === 'string') {
      pushUrl(value)
      return urls
    }

    if (Array.isArray(value)) {
      value.forEach(item => {
        if (typeof item === 'string') {
          pushUrl(item)
        } else if (item && typeof item === 'object') {
          pushUrl(item.url || item.media || item.src)
        }
      })
      return urls
    }

    if (value && typeof value === 'object') {
      pushUrl(value.url || value.media || value.src)
    }

    return urls
  }

  const getResolvedTemplateVariables = () => {
    const firstContact = contacts?.[0] || null
    const resolvedVariables = {}

    Object.entries(contentTemplate?.variables || {}).forEach(([key, value]) => {
      resolvedVariables[key] = personalizeWithContact(String(value || ''), firstContact)
    })

    return resolvedVariables
  }

  const applyResolvedVariables = (text, resolvedVariables) => {
    if (typeof text !== 'string') {
      return ''
    }

    return text.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, variableKey) => {
      const key = String(variableKey).trim()
      return resolvedVariables[key] ?? `{{${key}}}`
    })
  }

  const normalizeAction = (action, resolvedVariables) => {
    if (!action || typeof action !== 'object') return null

    const label = applyResolvedVariables(
      action.title || action.text || action.label || action.name || action.copy_code_text || action.code || '',
      resolvedVariables
    )

    const type = String(action.type || '').toUpperCase()
    const url = applyResolvedVariables(action.url || '', resolvedVariables)
    const phone = applyResolvedVariables(action.phone || action.phone_number || '', resolvedVariables)
    const code = applyResolvedVariables(action.code || '', resolvedVariables)

    if (!label && !url && !phone && !code) {
      return null
    }

    return { label: label || type || 'Action', type, url, phone, code }
  }

  const normalizeCard = (card, resolvedVariables) => {
    if (!card || typeof card !== 'object') {
      return null
    }

    const title = applyResolvedVariables(card.title || card.header_text || card.header || '', resolvedVariables)
    const body = applyResolvedVariables(card.body || card.text || '', resolvedVariables)
    const subtitle = applyResolvedVariables(card.subtitle || card.footer || card.description || '', resolvedVariables)
    const mediaUrls = extractMediaUrls(card.media || card.image || card.video || card.document, resolvedVariables)
    const actions = (card.actions || card.buttons || [])
      .map(action => normalizeAction(action, resolvedVariables))
      .filter(Boolean)

    if (!(title || body || subtitle || mediaUrls.length || actions.length)) {
      return null
    }

    return { title, body, subtitle, mediaUrls, actions }
  }

  const getTemplatePreviewModel = () => {
    const types = contentTemplate?.types || {}
    const typeKeys = Object.keys(types)
    const resolvedVariables = getResolvedTemplateVariables()

    const pickType = (...keys) => {
      for (const key of keys) {
        if (types[key]) {
          return { key, value: types[key] }
        }
      }
      return null
    }

    const selectedType =
      pickType('whatsapp/card', 'twilio/card') ||
      pickType('twilio/carousel', 'whatsapp/carousel') ||
      pickType('twilio/call-to-action') ||
      pickType('twilio/quick-reply') ||
      pickType('twilio/list-picker') ||
      pickType('twilio/media') ||
      pickType('twilio/text', 'whatsapp/text')

    if (!selectedType) {
      return {
        typeKey: typeKeys.join(', '),
        body: '',
        mediaUrls: [],
        actions: [],
        cards: [],
        listButton: '',
        listItems: [],
      }
    }

    const { key: typeKey, value: data } = selectedType

    if (typeKey === 'twilio/carousel' || typeKey === 'whatsapp/carousel') {
      const cards = (Array.isArray(data.cards) ? data.cards : Array.isArray(data.items) ? data.items : [])
        .map(card => normalizeCard(card, resolvedVariables))
        .filter(Boolean)

      return {
        typeKey,
        body: applyResolvedVariables(data.body || '', resolvedVariables),
        mediaUrls: [],
        actions: [],
        cards,
        listButton: '',
        listItems: [],
      }
    }

    if (typeKey === 'whatsapp/card' || typeKey === 'twilio/card') {
      const card = normalizeCard(data, resolvedVariables)
      const cardMediaUrls = extractMediaUrls(data.media || data.image || data.video || data.document, resolvedVariables)

      const normalizedCard = card || {
        title: applyResolvedVariables(data.title || data.header_text || data.header || '', resolvedVariables),
        body: applyResolvedVariables(data.body || '', resolvedVariables),
        subtitle: applyResolvedVariables(data.subtitle || data.footer || '', resolvedVariables),
        mediaUrls: cardMediaUrls,
        actions: [],
      }

      return {
        typeKey,
        body: '',
        mediaUrls: [],
        actions: [],
        cards: [normalizedCard],
        listButton: '',
        listItems: [],
      }
    }

    if (typeKey === 'twilio/call-to-action' || typeKey === 'twilio/quick-reply') {
      const actions = (data.actions || data.buttons || [])
        .map(action => normalizeAction(action, resolvedVariables))
        .filter(Boolean)

      return {
        typeKey,
        body: applyResolvedVariables(data.body || '', resolvedVariables),
        mediaUrls: [],
        actions,
        cards: [],
        listButton: '',
        listItems: [],
      }
    }

    if (typeKey === 'twilio/list-picker') {
      const listItems = (data.items || []).map((item) => ({
        label: applyResolvedVariables(item.item || item.title || '', resolvedVariables),
        description: applyResolvedVariables(item.description || '', resolvedVariables),
      }))

      return {
        typeKey,
        body: applyResolvedVariables(data.body || '', resolvedVariables),
        mediaUrls: [],
        actions: [],
        cards: [],
        listButton: applyResolvedVariables(data.button || '', resolvedVariables),
        listItems,
      }
    }

    if (typeKey === 'twilio/media') {
      return {
        typeKey,
        body: applyResolvedVariables(data.body || '', resolvedVariables),
        mediaUrls: extractMediaUrls(data.media, resolvedVariables),
        actions: [],
        cards: [],
        listButton: '',
        listItems: [],
      }
    }

    return {
      typeKey,
      body: applyResolvedVariables(data.body || data.text || '', resolvedVariables),
      mediaUrls: [],
      actions: [],
      cards: [],
      listButton: '',
      listItems: [],
    }
  }

  const templatePreviewModel = getTemplatePreviewModel()
  const suppressBubbleForType = new Set(['twilio/card', 'whatsapp/card'])

  const templatePreviewText = templatePreviewModel.body || (
    templatePreviewModel.typeKey
      ? (suppressBubbleForType.has(templatePreviewModel.typeKey)
          ? ''
          : `Template selected (${templatePreviewModel.typeKey}). Body preview is unavailable for this template type.`)
      : 'Template selected. Body preview is unavailable for this template type.'
  )

  const isLikelyImageUrl = (url) => {
    if (typeof url !== 'string') return false
    if (url.startsWith('data:image/')) return true

    const baseUrl = url.split('?')[0].toLowerCase()
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(baseUrl)
  }

  const placeholderText = availableVariables.length > 0
    ? `Type your message here... Available variables: ${availableVariables.map(v => `{${v}}`).join(', ')}`
    : 'Type your message here... Upload contacts first to see available variables like {name}, {phone}, {email}, etc.'

  return (
    <div className="space-y-4">
      {!isWhatsApp && (
        <div className="flex items-center text-sm text-gray-600">
          <Type className="h-4 w-4 mr-1" />
          <span className="font-medium">{message.length}</span>
          <span className="text-gray-400 ml-2">characters</span>
        </div>
      )}

      {isWhatsApp && (
        <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-green-900">WhatsApp Content Template</div>
              <div className="text-xs text-green-700">
                {includeUnapprovedTemplates
                  ? 'Approved and unapproved templates are shown for testing.'
                  : 'Only WhatsApp-approved templates are shown.'}
                {' '}Select one and fill required variables.
              </div>
            </div>
            <button
              type="button"
              onClick={fetchTemplates}
              disabled={!canFetchTemplates || loadingTemplates}
              className="inline-flex items-center px-3 py-1 text-xs rounded-md bg-white border border-green-300 text-green-800 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${loadingTemplates ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {!canFetchTemplates && (
            <p className="text-xs text-red-700">Configure Twilio credentials to load templates.</p>
          )}

          {templatesError && (
            <p className="text-xs text-red-700">{templatesError}</p>
          )}

          <div>
            <label className="inline-flex items-center mb-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeUnapprovedTemplates}
                onChange={(e) => setIncludeUnapprovedTemplates(e.target.checked)}
                className="mr-2"
              />
              Include unapproved templates (testing only)
            </label>

            <label className="block text-xs font-medium text-gray-700 mb-1">Template</label>
            <select
              value={contentTemplate?.contentSid || ''}
              onChange={(e) => handleTemplateSelection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow"
              disabled={!canFetchTemplates || loadingTemplates}
            >
              <option value="">Select a template</option>
              {templates.map((template) => (
                <option key={template.sid} value={template.sid}>
                  {template.friendlyName} ({template.language || 'n/a'}){template.whatsappApprovalStatus ? ` - ${template.whatsappApprovalStatus}` : ''}
                </option>
              ))}
            </select>
            {canFetchTemplates && !loadingTemplates && templates.length === 0 && (
              <p className="text-xs text-gray-600 mt-1">
                {includeUnapprovedTemplates
                  ? 'No WhatsApp templates found for this account.'
                  : 'No approved WhatsApp templates found for this account.'}
              </p>
            )}
          </div>

          {isTemplateMode && (
            <div className="space-y-3">
              <p className="text-xs text-green-800">
                Set each template variable. Placeholders like {'{name}'} or {'{phone}'} are supported and will be personalized per contact.
              </p>

              {variableKeys.length === 0 && (
                <p className="text-xs text-gray-600">This template has no variables.</p>
              )}

              {variableKeys.map((key) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Variable {key}</label>
                  <input
                    type="text"
                    value={contentTemplate?.variables?.[key] || ''}
                    onChange={(e) => updateTemplateVariable(key, e.target.value)}
                    placeholder={`Enter value for variable ${key}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow"
                  />
                </div>
              ))}

              <div className="border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center">
                    <Eye className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm font-medium text-gray-700">WhatsApp Template Preview</span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-xs text-gray-500 mb-2">
                    {contacts.length > 0 ? '📱 Preview with Sample Contact:' : '📱 Preview:'}
                  </div>
                  {templatePreviewText && (
                    <div className="bg-blue-500 text-white rounded-2xl rounded-bl-md px-4 py-3 max-w-sm ml-auto text-sm leading-relaxed whitespace-pre-wrap">
                      {templatePreviewText}
                    </div>
                  )}

                  {templatePreviewModel.mediaUrls.length > 0 && (
                    <div className="mt-3 max-w-sm ml-auto space-y-2">
                      {templatePreviewModel.mediaUrls.map((url) => (
                        <div key={url} className="bg-white border border-gray-300 rounded-lg p-2">
                          {isLikelyImageUrl(url) ? (
                            <img src={url} alt="Template media preview" className="w-full rounded-md max-h-48 object-cover" />
                          ) : (
                            <div className="text-gray-700 text-xs break-all">Media: {url}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {templatePreviewModel.cards.length > 0 && (
                    <div className="mt-3 max-w-sm ml-auto">
                      {templatePreviewModel.typeKey === 'twilio/carousel' || templatePreviewModel.typeKey === 'whatsapp/carousel' ? (
                        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                          {templatePreviewModel.cards.map((card, index) => (
                            <div key={`${card.title}-${card.body}-${index}`} className="snap-start shrink-0 w-72 bg-white border border-gray-300 rounded-lg p-3 text-sm">
                              {card.title && <div className="font-semibold text-gray-800">{card.title}</div>}
                              {card.body && <div className="text-gray-700 mt-2 whitespace-pre-wrap">{card.body}</div>}

                              {card.mediaUrls.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {card.mediaUrls.map((url) => (
                                    <div key={url} className="bg-gray-50 border border-gray-200 rounded-md p-2">
                                      {isLikelyImageUrl(url) ? (
                                        <img src={url} alt="Card media preview" className="w-full rounded max-h-40 object-cover" />
                                      ) : (
                                        <div className="text-xs text-gray-500 break-all">Media: {url}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {card.actions.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {card.actions.map((action) => (
                                    <div key={`${action.type}-${action.label}-${action.url}-${action.phone}`} className="bg-blue-50 border border-blue-200 text-blue-700 rounded px-2 py-1 text-xs">
                                      {action.label}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {card.subtitle && <div className="text-xs text-gray-500 mt-2">{card.subtitle}</div>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {templatePreviewModel.cards.map((card, index) => (
                            <div key={`${card.title}-${card.body}-${index}`} className="bg-white border border-gray-300 rounded-lg p-3 text-sm">
                              {card.title && <div className="font-semibold text-gray-800">{card.title}</div>}
                              {card.body && <div className="text-gray-700 mt-2 whitespace-pre-wrap">{card.body}</div>}

                              {card.mediaUrls.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {card.mediaUrls.map((url) => (
                                    <div key={url} className="bg-gray-50 border border-gray-200 rounded-md p-2">
                                      {isLikelyImageUrl(url) ? (
                                        <img src={url} alt="Card media preview" className="w-full rounded max-h-40 object-cover" />
                                      ) : (
                                        <div className="text-xs text-gray-500 break-all">Media: {url}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {card.actions.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {card.actions.map((action) => (
                                    <div key={`${action.type}-${action.label}-${action.url}-${action.phone}`} className="bg-blue-50 border border-blue-200 text-blue-700 rounded px-2 py-1 text-xs">
                                      {action.label}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {card.subtitle && <div className="text-xs text-gray-500 mt-2">{card.subtitle}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {templatePreviewModel.actions.length > 0 && templatePreviewModel.cards.length === 0 && (
                    <div className="mt-3 max-w-sm ml-auto space-y-2">
                      {templatePreviewModel.actions.map((action) => (
                        <div
                          key={`${action.type}-${action.label}-${action.url}-${action.phone}`}
                          className="bg-white border border-blue-300 text-blue-700 rounded-lg px-3 py-2 text-sm"
                        >
                          {action.label}
                        </div>
                      ))}
                    </div>
                  )}

                  {templatePreviewModel.listButton && (
                    <div className="mt-3 max-w-sm ml-auto">
                      <button
                        type="button"
                        onClick={() => setIsListPickerOpen(prev => !prev)}
                        className="w-full bg-white border border-blue-300 text-blue-700 rounded-lg px-3 py-2 text-sm text-center"
                      >
                        {templatePreviewModel.listButton}
                      </button>
                    </div>
                  )}

                  {templatePreviewModel.listItems.length > 0 && isListPickerOpen && (
                    <div className="mt-2 max-w-sm ml-auto space-y-2">
                      {templatePreviewModel.listItems.map((item, index) => (
                        <div key={`${item.label}-${index}`} className="bg-white border border-gray-300 rounded-lg px-3 py-2">
                          <div className="text-sm text-gray-800">{item.label}</div>
                          {item.description && <div className="text-xs text-gray-500 mt-1">{item.description}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message Textarea */}
      {!isWhatsApp && (
        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder={placeholderText}
            rows={6}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:shadow-lg transition-shadow resize-none"
          />
        </div>
      )}

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
          {!isWhatsApp && <p className="text-xs text-blue-600 mt-2">
            Click any variable to insert it into your message, or type them manually.
          </p>}
        </div>
      )}

      {/* Message Preview */}
      {!isWhatsApp && message.trim() && (
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
      {!isWhatsApp && !message.trim() && !isTemplateMode && (
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
