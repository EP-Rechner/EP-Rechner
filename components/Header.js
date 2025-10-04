// components/Header.js
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient' // Pfad ggf. anpassen!

export default function Header() {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const [session, setSession] = useState(null) // <-- Session State hinzufügen

  // Session laden & Listener für Login/Logout
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session || null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session || null)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()     // Session beenden
      router.push('/?reason=logout')    // Startseite mit Hinweis
    } catch (e) {
      console.error(e)
      alert('Abmelden fehlgeschlagen.')
    } finally {
      setLoggingOut(false)              // immer zurücksetzen
    }
  }

  return (
    <header style={{ background: '#2c3e50', padding: '10px', color: '#fff' }}>
      <h1>Equinepassion Rechner (BETA)</h1>
      <nav style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>

  {/* Nur sichtbar wenn NICHT eingeloggt */}
  {!session && (
    <>
      <Link href="/login" style={{ color: '#fff' }}>Login</Link>
      <Link href="/register" style={{ color: '#fff' }}>Registrieren</Link>
    </>
  )}

  {/* Nur sichtbar wenn eingeloggt */}
  {/* Nur sichtbar wenn eingeloggt */}
{session && (
  <>
    <Link href="/dashboard" style={{ color: '#fff' }}>Startseite</Link>
    <Link href="/pferde" style={{ color: '#fff' }}>Pferdeübersicht</Link>
    <Link href="/import" style={{ color: '#fff' }}>Eintragen</Link>
    <Link href="/verpaaren" style={{ color: '#fff' }}>Zucht</Link>
    <Link href="/verpaarungen" style={{ color: '#fff' }}>Gespeicherte Zucht</Link>
    <Link href="/forum" style={{ color: '#fff' }}>Forum</Link>
    <Link href="/mitglieder" style={{ color: '#fff' }}>Mitglieder</Link>
    <Link href={`/profil/${session.user.id}`} style={{ color: '#fff' }}>Profil</Link>
    <button
      onClick={handleLogout}
      disabled={loggingOut}
      style={{
        background: 'transparent',
        color: '#fff',
        border: '1px solid #fff',
        padding: '4px 10px',
        borderRadius: 4,
        cursor: 'pointer'
      }}
    >
      {loggingOut ? 'Abmelden…' : 'Logout'}
    </button>
  </>
)}
</nav>

    </header>
  )
}
