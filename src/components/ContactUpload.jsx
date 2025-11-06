import { useState } from 'react'
import { Upload, Users, FileText, CheckCircle, AlertTriangle, Download } from 'lucide-react'

const ContactUpload = ({ 
  contacts, 
  isUploading,
  uploadError,
  onFileUpload,
  validationSummary
}) => {
  const [dragActive, setDragActive] = useState(false)

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFile(files[0])
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleFile = async (file) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return
    }

    try {
      if (onFileUpload) {
        await onFileUpload(file)
      }
    } catch (error) {
      console.error('Upload error:', error)
    }
  }

  const downloadSample = () => {
    const sampleData = `name,phone,email
John Doe,+1234567890,john@example.com
Jane Smith,+1987654321,jane@example.com
Bob Johnson,+1555123456,bob@example.com`

    const blob = new Blob([sampleData], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample-contacts.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : contacts && contacts.length > 0
            ? 'border-green-500 bg-green-50'
            : uploadError
            ? 'border-red-500 bg-red-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="space-y-4">
          {isUploading ? (
            <div className="animate-spin mx-auto w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          ) : contacts && contacts.length > 0 ? (
            <CheckCircle className="mx-auto w-12 h-12 text-green-500" />
          ) : uploadError ? (
            <AlertTriangle className="mx-auto w-12 h-12 text-red-500" />
          ) : (
            <Upload className="mx-auto w-12 h-12 text-gray-400" />
          )}
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {contacts && contacts.length > 0
                ? 'Upload Successful!'
                : uploadError
                ? 'Upload Failed'
                : 'Upload CSV File'
              }
            </h3>
            <p className="text-gray-600">
              {contacts && contacts.length > 0
                ? `Successfully loaded ${contacts.length} contacts`
                : uploadError
                ? 'Please check your file format and try again'
                : 'Drag and drop your CSV file here, or click to browse'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Sample Download */}
      <div className="flex justify-center">
        <button
          onClick={downloadSample}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          Download Sample CSV
        </button>
      </div>

      {/* Contact Summary */}
      {contacts && contacts.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Contacts Summary
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{contacts.length}</div>
              <div className="text-sm text-gray-600">Total Contacts</div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">
                {validationSummary ? validationSummary.summary.valid : contacts.filter(c => c.phone).length}
              </div>
              <div className="text-sm text-gray-600">Valid Phone Numbers</div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {contacts.filter(c => c.email).length}
              </div>
              <div className="text-sm text-gray-600">Email Addresses</div>
            </div>
          </div>

          {/* Column Detection */}
          {contacts.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Detected Columns:</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(contacts[0]).map((column) => (
                  <span
                    key={column}
                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {column}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contact Preview */}
          {contacts.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Contact Preview (First {Math.min(10, contacts.length)} of {contacts.length})
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {contacts.slice(0, 10).map((contact, index) => (
                  <div
                    key={index}
                    className="bg-white rounded border p-2 text-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        {contact.name && (
                          <div className="font-medium text-gray-900">
                            {contact.name}
                          </div>
                        )}
                        {contact.phone && (
                          <div className="text-blue-600 font-mono">
                            {contact.phone}
                          </div>
                        )}
                        {contact.email && (
                          <div className="text-gray-600">
                            {contact.email}
                          </div>
                        )}
                        {/* Show any additional columns */}
                        {Object.entries(contact).map(([key, value]) => {
                          if (!['name', 'phone', 'email', 'status'].includes(key) && value) {
                            return (
                              <div key={key} className="text-gray-500 text-xs">
                                <span className="font-medium">{key}:</span> {value}
                              </div>
                            )
                          }
                          return null
                        })}
                      </div>
                      {contact.status && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          contact.status === 'sent' 
                            ? 'bg-green-100 text-green-800' 
                            : contact.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {contact.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {contacts.length > 10 && (
                <div className="mt-3 text-center">
                  <span className="text-xs text-gray-500">
                    ... and {contacts.length - 10} more contacts
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
          <FileText className="w-4 h-4 mr-2" />
          CSV File Requirements
        </h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>First row should contain column headers</li>
          <li>Include a 'phone' column with phone numbers</li>
          <li>Optional columns: name, email, or any custom fields</li>
          <li>Use international format for phone numbers (+1234567890)</li>
          <li>Maximum file size: 5MB</li>
        </ul>
      </div>

      {/* Error Messages */}
      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-red-900 mb-2">Upload Error</h4>
          <p className="text-sm text-red-800">
            {uploadError || 'Please ensure your file is a valid CSV format with proper headers.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default ContactUpload
