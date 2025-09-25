// pages/set-username.js
import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function SetUsername() {
  const [username, setUsername] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      setErrorMsg('Du musst eingeloggt sein.')
      return
    }

    const { error } = await supabase
      .from('Users')
      .update({ Username: username })
      .eq('id', user.id)

    if (error) {
      if (error.code === '23505') {
        // 23505 = unique constraint violation
        setErrorMsg('Dieser Username ist bereits vergeben.')
      } else {
        setErrorMsg(error.message)
      }
    } else {
      setSuccess(true)
      setTimeout(() => {
        router.push('/') // Weiterleitung zur Startseite
      }, 1500)
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto' }}>
      <h2>Wähle deinen Username</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Username eingeben"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
        />
        <button type="submit">Speichern</button>
      </form>
      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
      {success && <p style={{ color: 'green' }}>Username gespeichert 🎉</p>}
    </div>
  )
}
