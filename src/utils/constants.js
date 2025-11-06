export const SMS_LIMITS = {
  MAX_CONTACTS_PER_REQUEST: 100,
  MAX_MESSAGE_LENGTH: 1600,
}

export const SMS_SETTINGS_DEFAULTS = {
  estimatedCostPerSegment: 0.0075,
  messageDelay: 300, // Default 0.3 seconds delay between messages (in milliseconds)
}

export const DELAY_SETTINGS = {
  MIN_DELAY: 100, // Minimum 0.1 seconds (in milliseconds) - no 0 delay on slider
  MAX_DELAY: 10000, // Maximum 10 seconds delay (in milliseconds)
  DEFAULT_DELAY: 300, // Default 0.3 seconds (in milliseconds)
  // Preset values in milliseconds
  PRESETS: {
    NO_DELAY: 0,
    FAST: 100,      // 0.1s
    DEFAULT: 300,   // 0.3s  
    SAFE: 600,      // 0.6s
    CONSERVATIVE: 1000  // 1s
  }
}

export const CONTACT_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
}

export const API_ENDPOINTS = {
  SEND_BULK_SMS: '/api/send-bulk-sms',
  SCHEDULE_SMS: '/api/schedule-sms',
  SCHEDULED_JOBS: '/api/scheduled-jobs',
  JOB_RESULTS: '/api/job-results',
}
