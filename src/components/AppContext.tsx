import { createContext, useContext, type ReactNode } from 'react'
import type { AppCopy, Locale } from '../lib/appCopy'

export type AppContextValue = {
  copy: AppCopy
  locale: Locale
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({
  value,
  children,
}: {
  value: AppContextValue
  children: ReactNode
}) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppCopy(): AppCopy {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppCopy must be used within an AppProvider')
  }
  return context.copy
}

export function useAppLocale(): Locale {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppLocale must be used within an AppProvider')
  }
  return context.locale
}
