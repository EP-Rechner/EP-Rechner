// pages/index.js
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

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
        <h1>Willkommen beim Equinepassion Rechner (Beta)</h1>
        <p>Bitte nutze die Navigation oben, um dich einzuloggen oder zu registrieren.</p>
        <p> </p>

        <p>Der Rechner befindet sich aktuell in der Beta Phase und wird sich im Laufe der Zeit entwickeln.</p>
        <p>Die Basics des Rechners sind bereits integriert und funktionieren - Pferde eintragen, sortieren, Verpaarungen.</p>
      </div>
    )
  }

  // Wenn ein User eingeloggt ist, leitet Home direkt nach /pferde weiter.
  return null
}
