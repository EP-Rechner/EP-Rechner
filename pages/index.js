// pages/index.js
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const router = useRouter()

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      if (session?.user) {
        setUser(session.user)
        // kleiner Delay, damit Session sicher steht
        setTimeout(() => {
          router.push('/pferde')
        }, 100)
      } else {
        setUser(null)
      }
      setLoading(false)
    }

    getSession()

    // Listener: reagiert auf Login/Logout
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          router.push('/pferde')
        } else {
          setUser(null)
        }
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [router])

  if (loading) return <p>Lade...</p>

  const msg =
    router.query.reason === 'logout'
      ? 'Du wurdest abgemeldet.'
      : router.query.reason === 'idle'
      ? 'Du wurdest wegen Inaktivität abgemeldet.'
      : null

  if (!user) {
    return (
      <div style={{ padding: '20px' }}>
        {msg && (
          <p style={{ background:'#fff7d6', padding:8, border:'1px solid #f0e1a0' }}>
            {msg}
          </p>
        )}
        <h1>Willkommen beim Equinepassion Rechner</h1>
        <p>
          Bitte{' '}
          <Link href="/login" style={{ color: 'blue', textDecoration: 'underline' }}>
            einloggen
          </Link>{' '}
          oder{' '}
          <Link href="/register" style={{ color: 'blue', textDecoration: 'underline' }}>
            registrieren
          </Link>{' '}
          , um zu starten.
        </p>
      </div>
    )
  }

  return null
}
