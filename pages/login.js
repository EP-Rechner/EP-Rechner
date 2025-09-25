// pages/login.js
import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)
  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()

    // Schritt 1: Einloggen
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMsg(error.message)
      return
    }

    // Schritt 2: User-Daten aus eigener Tabelle "Users" holen
    const { data: userData, error: userError } = await supabase
      .from('Users')
      .select('Username')
      .eq('id', data.user.id)
      .single()

    if (userError) {
      setErrorMsg(userError.message)
      return
    }

    // Schritt 3: Prüfen ob Username ein Platzhalter ist
    if (userData.Username && userData.Username.startsWith('user_')) {
      // Weiterleitung zur Username-Seite
      router.push('/set-username')
    } else {
      // Normale Weiterleitung (z. B. Dashboard)
      router.push('/')
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
