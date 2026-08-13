'use client'

import { useEffect } from 'react'

/**
 * Registrierung des Service Workers.
 *
 * Nur in Produktion: In der Entwicklung würde ein Cache-Layer über dem
 * Hot Reload liegen und stundenlang Verwirrung stiften.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }

    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
