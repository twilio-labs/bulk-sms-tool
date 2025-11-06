
import Papa from 'papaparse'
import { validatePhoneNumber } from '../utils/phoneUtils'

/**
 * Normalizes phone number format by adding + prefix if missing
 * @param {string} phone - Phone number to normalize
 * @returns {string} - Normalized phone number
 */
const normalizePhoneNumber = (phone) => {
  if (!phone) return phone
  
  const cleanPhone = phone.toString().trim().replace(/\s+/g, '')
  
  // If it already has +, return as is
  if (cleanPhone.startsWith('+')) {
    return cleanPhone
  }
  
  // If it looks like an international number (starts with country code), add +
  if (/^[1-9]\d{10,14}$/.test(cleanPhone)) {
    return '+' + cleanPhone
  }
  
  return cleanPhone
}

/**
 * Parses CSV file and extracts phone numbers
 * @param {File} file - CSV file to parse
 * @returns {Promise<Array>} - Array of contact objects
 */
export const parseCSVFile = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const contacts = extractContactsFromCSV(results.data)
          resolve(contacts)
        } catch (error) {
          reject(error)
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`))
      }
    })
  })
}

/**
 * Extracts contacts from parsed CSV data
 * @param {Array} csvData - Parsed CSV data
 * @returns {Array} - Array of contact objects with phone numbers
 */
const extractContactsFromCSV = (csvData) => {
  if (!csvData || !Array.isArray(csvData)) {
    throw new Error('Invalid CSV data')
  }

  const contacts = []
  const phoneFields = ['phone', 'number', 'mobile', 'cell', 'telephone', 'tel']
  
  csvData.forEach((row, index) => {
    // Find phone number field (case insensitive)
    let phoneNumber = null
    const rowKeys = Object.keys(row).map(key => key.toLowerCase())
    
    for (const field of phoneFields) {
      const matchingKey = rowKeys.find(key => key.includes(field))
      if (matchingKey) {
        const originalKey = Object.keys(row).find(key => 
          key.toLowerCase() === matchingKey
        )
        phoneNumber = row[originalKey]
        break
      }
    }
    
    // If no phone field found, try first column
    if (!phoneNumber && Object.keys(row).length > 0) {
      phoneNumber = Object.values(row)[0]
    }
    
    if (phoneNumber && phoneNumber.toString().trim()) {
      // Start with the original row data
      const contact = { ...row }
      
      // Add or update required fields
      contact.id = index + 1
      contact.phone = normalizePhoneNumber(phoneNumber)
      contact.status = 'pending'
      
      // Only add a default name if no name-like field exists
      const nameFields = ['name', 'Name', 'NAME', 'full_name', 'fullName', 'firstName', 'first_name']
      const hasNameField = nameFields.some(field => contact[field])
      
      if (!hasNameField) {
        contact.name = `Contact ${index + 1}`
      }
      
      contacts.push(contact)
    }
  })

  if (contacts.length === 0) {
    throw new Error('No valid phone numbers found in CSV file')
  }

  return contacts
}

/**
 * Validates contacts array
 * @param {Array} contacts - Array of contact objects
 * @returns {Object} - Validation results
 */
export const validateContacts = (contacts) => {
  if (!contacts || !Array.isArray(contacts)) {
    return { valid: [], invalid: [], summary: { total: 0, valid: 0, invalid: 0 } }
  }

  const valid = []
  const invalid = []

  contacts.forEach(contact => {
    if (validatePhoneNumber(contact.phone)) {
      valid.push(contact)
    } else {
      invalid.push({
        ...contact,
        error: 'Invalid phone number format'
      })
    }
  })

  return {
    valid,
    invalid,
    summary: {
      total: contacts.length,
      valid: valid.length,
      invalid: invalid.length
    }
  }
}
