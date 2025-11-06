
const AppHeader = () => {
  return (
    <header className="bg-red-600 text-white py-6 px-6 w-full">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center space-x-4">
          {/* Twilio Logo from public folder */}
          <img 
            src="/icon-twilio-bug-red.svg" 
            alt="Twilio"
            className="w-12 h-12 flex-shrink-0 filter brightness-0 invert"
          />
          
          {/* Tool Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-1">
              SMS Bulk Sender
            </h1>
            <p className="text-red-100 text-lg">
              Send personalized SMS messages to multiple contacts using Twilio's reliable messaging platform
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}

export default AppHeader
