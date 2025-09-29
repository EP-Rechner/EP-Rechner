// pages/register.js
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)

  const handleRegister = async () => {
    setErrorMsg(null)

    // 1. User in auth.users anlegen
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      setErrorMsg('Fehler: ' + error.message)
      return
    }

    if (data.user) {
      // 2. Passenden Eintrag in "mitglieder" anlegen
      const { error: insertError } = await supabase
        .from('mitglieder')
        .insert([
          {
            id: data.user.id,   // gleiche ID wie auth.users
            username: null,     // bleibt leer!
            role: 'user'        // Standardrolle
          }
        ])

      if (insertError) {
        console.error('Fehler beim Einfügen in mitglieder:', insertError)
        setErrorMsg('Fehler beim Anlegen des Benutzerprofils.')
        return
      }
    }

    alert('Registrierung erfolgreich! Bitte prüfe dein Email-Postfach zur Bestätigung.')
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
      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
    </div>
  )
}
