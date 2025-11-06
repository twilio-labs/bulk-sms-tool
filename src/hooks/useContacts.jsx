import { useState, useCallback } from 'react'
import { parseCSVFile, validateContacts } from '../services/csvService'
import { CONTACT_STATUS } from '../utils/constants'

export const useContacts = () => {
  const [contacts, setContacts] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)


  const handleFileUpload = useCallback(async (file) => {
    if (!file) return

    // Handle both File objects and FileList arrays
    const fileToProcess = file.length !== undefined ? file[0] : file
    
    if (!fileToProcess.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Please upload a CSV file')
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      const parsedContacts = await parseCSVFile(fileToProcess)
      setContacts(parsedContacts)
    } catch (error) {
      setUploadError(error.message)
      console.error('CSV upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }, [])


  const updateContactStatus = useCallback((phone, status) => {
    setContacts(prevContacts => 
      prevContacts.map(contact => 
        contact.phone === phone 
          ? { ...contact, status }
          : contact
      )
    )
  }, [])


  const updateContactsFromResults = useCallback((results) => {
    setContacts(prevContacts => {
      return prevContacts.map(contact => {
        // Check if this contact was successful
        const successResult = results.successful?.find(
          result => result.phone === contact.phone
        )
        if (successResult) {
          return { ...contact, status: CONTACT_STATUS.SENT }
        }
        
        // Check if this contact failed
        const failedResult = results.failed?.find(
          result => result.phone === contact.phone
        )
        if (failedResult) {
          return { ...contact, status: CONTACT_STATUS.FAILED }
        }
        
        return contact
      })
    })
  }, [])


  const clearContacts = useCallback(() => {
    setContacts([])
    setUploadError(null)
  }, [])


  const getValidationSummary = useCallback(() => {
    return validateContacts(contacts)
  }, [contacts])

  const getContactsByStatus = useCallback((status) => {
    return contacts.filter(contact => contact.status === status)
  }, [contacts])

  return {
    contacts,
    isUploading,
    uploadError,
    handleFileUpload,
    updateContactStatus,
    updateContactsFromResults,
    clearContacts,
    getValidationSummary,
    getContactsByStatus,
    setContacts
  }
}
