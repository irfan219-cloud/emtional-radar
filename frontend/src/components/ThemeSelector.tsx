import { useState } from 'react'
import { useTheme, Theme, themes } from '../contexts/ThemeContext'

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  const themeColors = {
    dark: 'bg-slate-600',
    light: 'bg-gray-400',
    purple: 'bg-purple-600',
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    orange: 'bg-orange-600'
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-secondary border-primary border rounded-lg text-primary hover:bg-tertiary transition-colors"
      >
        <div className={`w-4 h-4 rounded-full ${themeColors[theme]}`}></div>
        <span className="text-sm font-medium">{themes[theme]}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-48 bg-secondary border-primary border rounded-lg shadow-lg z-20">
            <div className="p-2">
              <div className="text-xs font-semibold text-secondary uppercase tracking-wide px-2 py-1">
                Choose Theme
              </div>
              {Object.entries(themes).map(([key, name]) => (
                <button
                  key={key}
                  onClick={() => {
                    setTheme(key as Theme)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                    theme === key 
                      ? 'btn-primary text-white' 
                      : 'hover:bg-tertiary text-primary'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${themeColors[key as Theme]}`}></div>
                  <span className="text-sm">{name}</span>
                  {theme === key && (
                    <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}