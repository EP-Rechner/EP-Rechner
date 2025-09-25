// pages/index.js
import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ padding: '20px' }}>
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
