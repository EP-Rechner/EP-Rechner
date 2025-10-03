// pages/login.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'


export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)
  const router = useRouter()

  // 👇 HIER kommt die Session-Killer-Logik
  useEffect(() => {
    const clearAutoLogin = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // wenn Supabase den User durch Bestätigung auto-eingeloggt hat → sofort wieder ausloggen
        await supabase.auth.signOut()
      }
    }
    clearAutoLogin()
  }, [])


  const handleLogin = async (e) => {
    e.preventDefault()

    // 1. Login mit Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMsg(error.message)
      return
    }

    // Falls kein User zurückkommt → Fehler
    if (!data.user) {
      setErrorMsg("Login fehlgeschlagen. Bitte erneut versuchen.")
      return
    }

    // 2. username aus Tabelle "mitglieder" laden
    const { data: userData, error: userError } = await supabase
      .from('mitglieder')
      .select('username, role')
      .eq('id', data.user.id)
      .single()

    if (userError) {
      setErrorMsg(userError.message)
      return
    }

    // 3. Weiterleitung: username prüfen
    if (!userData?.username) {
      router.push('/set-username')
    } else {
      router.push('/pferde') // <--- statt "/" direkt zur Pferde-Seite
    }
  }

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
      </form>
      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
    </div>
  )
}
