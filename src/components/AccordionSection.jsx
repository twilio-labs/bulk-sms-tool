import { ChevronDown } from 'lucide-react'

const AccordionSection = ({
  id,
  title,
  status,
  isExpanded,
  onToggle,
  animationDelay = '0.1s',
  children
}) => {
  return (
    <div id={`section-${id}`} className="bg-white rounded-xl shadow-sm border border-gray-200 animate-fade-in-up transition-bounce" style={{animationDelay}}>
      <div 
        className="border-b border-gray-100 px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <div className="flex items-center space-x-3">
            {status}
            <button className="p-1 rounded-lg hover:bg-gray-100 transition-all duration-200 ease-in-out transform hover:scale-105">
              <ChevronDown 
                className={`h-5 w-5 text-gray-400 transition-transform duration-300 ease-in-out ${
                  !isExpanded ? 'rotate-0' : 'rotate-180'
                }`} 
              />
            </button>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="p-6">
          {children}
        </div>
      )}
    </div>
  )
}

export default AccordionSection
