/**
 * Phone number validation and formatting utilities
 */

/**
 * Validates if a phone number is in correct format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const validatePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return false
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '')
  
  // Check if it's a valid length (10-15 digits)
  if (cleaned.length < 10 || cleaned.length > 15) return false
  
  // Must start with country code or area code
  return /^(\+?1?[2-9]\d{2}[2-9]\d{2}\d{4}|\+?\d{8,14})$/.test(cleaned)
}
