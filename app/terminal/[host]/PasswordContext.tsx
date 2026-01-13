'use client'

import { createContext, useContext } from 'react'

// Password context for sharing cached password across terminal tabs
interface PasswordContextType {
  password: string | null
  setPassword: (password: string) => void
}

export const PasswordContext = createContext<PasswordContextType>({
  password: null,
  setPassword: () => {},
})

export const usePassword = () => useContext(PasswordContext)
