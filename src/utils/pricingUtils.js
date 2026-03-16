export const normalizeWhatsAppTemplateCategory = (value) => {
  if (!value || typeof value !== 'string') return 'marketing'

  const normalized = value.toLowerCase().trim()
  if (normalized.includes('auth')) return 'authentication'
  if (normalized.includes('utility')) return 'utility'
  if (normalized.includes('service')) return 'service'
  return 'marketing'
}

export const personalizeMessageWithFirstContact = (message, contacts) => {
  if (!message?.trim() || !contacts?.length) return message

  const firstContact = contacts[0]
  let personalizedMessage = message

  Object.keys(firstContact).forEach((key) => {
    const pattern = new RegExp(`\\{${key}\\}`, 'gi')
    const value = firstContact[key] || ''
    personalizedMessage = personalizedMessage.replace(pattern, value)
  })

  return personalizedMessage
}

export const calculateSmsEstimatedTotal = ({ estimatedRate, segments, contactCount }) => {
  if (typeof estimatedRate !== 'number') {
    return {
      costPerMessage: 0,
      totalCost: 0,
    }
  }

  const safeSegments = Number.isFinite(segments) && segments > 0 ? segments : 1
  const safeContacts = Number.isFinite(contactCount) && contactCount > 0 ? contactCount : 0
  const costPerMessage = estimatedRate * safeSegments

  return {
    costPerMessage,
    totalCost: costPerMessage * safeContacts,
  }
}

export const calculateWhatsAppEstimatedTotal = ({
  rateCards,
  countryCode,
  templateCategory,
  twilioFeePerMessage,
  contactCount,
}) => {
  const selectedCountryRateCard = (rateCards || []).find((country) => country.code === countryCode) || null
  const selectedMetaRateEntry = selectedCountryRateCard?.rates?.[templateCategory] || null
  const selectedMetaRate = typeof selectedMetaRateEntry?.rate === 'number' ? selectedMetaRateEntry.rate : null
  const isMetaRateAvailable = selectedMetaRateEntry?.available !== false && selectedMetaRate !== null
  const totalPerMessage = isMetaRateAvailable ? twilioFeePerMessage + selectedMetaRate : null

  return {
    selectedCountryRateCard,
    selectedMetaRate,
    isMetaRateAvailable,
    totalPerMessage,
    totalCost: totalPerMessage !== null ? totalPerMessage * (contactCount || 0) : null,
  }
}
