// components/Navbar.js
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'

export default function Navbar() {
  const [session, setSession] = useState(null)
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (mounted) setSession(session)
    }
    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      mounted = false
      subscription?.unsubscribe?.()
    }
  }, [])

  const onLogout = async () => {
    await supabase.auth.signOut()
    router.push('/?reason=logout') // <- zurück zur Login/Registrieren-Seite mit Hinweis
  }

  return (
    <nav style={{ padding: '10px 20px', borderBottom: '1px solid #eee', display:'flex', gap:12 }}>
      <Link href="/">Start</Link>
      <Link href="/forum">Forum</Link>

      <div style={{ marginLeft: 'auto', display:'flex', gap:12 }}>
        {session ? (
          <button onClick={onLogout}>Logout</button>
        ) : (
          <>
            <Link href="/login">Login</Link>
            <Link href="/register">Registrieren</Link>
          </>
        )}
      </div>
    </nav>
  )
}
