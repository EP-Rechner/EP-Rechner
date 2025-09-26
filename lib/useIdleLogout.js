// lib/useIdleLogout.js
import { useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { useRouter } from 'next/router'

export default function useIdleLogout(timeoutMs = 2 * 60 * 60 * 1000) {
  const router = useRouter()
  const timerRef = useRef(null)

  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const start = () => {
    clear()
    timerRef.current = setTimeout(async () => {
      try {
        await supabase.auth.signOut()
      } finally {
        router.push('/?reason=idle')
      }
    }, timeoutMs)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return // nur im Browser

    let authSub = null
    const onActivity = () => start()
    const events = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'visibilitychange']

    ;(async () => {
      // Bei bestehender Session Timer starten
      const { data: { session } } = await supabase.auth.getSession()
      if (session) start()

      // Aktivitäts-Events
      events.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }))

      // Auf Login/Logout reagieren
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          start()
        } else {
          clear()
        }
      })
      authSub = subscription
    })()

    return () => {
      clear()
      events.forEach(ev => window.removeEventListener(ev, onActivity))
      authSub?.unsubscribe?.()
    }
  }, [timeoutMs]) // eslint-disable-line react-hooks/exhaustive-deps
}
