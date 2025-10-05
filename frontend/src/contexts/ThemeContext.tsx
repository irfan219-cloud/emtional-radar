import React, { createContext, useContext, useState, useEffect } from 'react'

export type Theme = 'dark' | 'light' | 'purple' | 'blue' | 'green' | 'orange'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const themes = {
  dark: 'Dark Mode',
  light: 'Light Mode',
  purple: 'Purple Theme',
  blue: 'Ocean Blue',
  green: 'Forest Green',
  orange: 'Sunset Orange'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme
    if (savedTheme && themes[savedTheme]) {
      setTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    document.documentElement.className = `theme-${theme}`
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className="bg-primary text-primary min-h-screen">
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export { themes }