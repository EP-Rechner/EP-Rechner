// pages/register.js
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleRegister = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    if (error) {
      alert('Fehler: ' + error.message)
    } else {
      alert('Registrierung erfolgreich! Bitte prüfe dein Email-Postfach zur Bestätigung.')
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Registrierung</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: 'block', marginBottom: '10px' }}
      />
      <input
        type="password"
        placeholder="Passwort"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: 'block', marginBottom: '10px' }}
      />
      <button onClick={handleRegister}>Registrieren</button>
    </div>
  )
}
