// components/Header.js
import Link from 'next/link'

export default function Header() {
  return (
    <header style={{ background: '#2c3e50', padding: '10px', color: '#fff' }}>
      <h1>Equinepassion Rechner (BETA)</h1>
      <nav>
        <Link href="/pferde" style={{ marginRight: '10px', color: '#fff' }}>Pferdeübersicht</Link>
        <Link href="/login" style={{ marginRight: '10px', color: '#fff' }}>Login</Link>
        <Link href="/register" style={{ marginRight: '10px', color: '#fff' }}>Registrieren</Link>
        <Link href="/forum" style={{ marginRight: '10px', color: '#fff' }}>Forum</Link>
        <Link href="/import" style={{ marginRight: '10px', color: '#fff' }}>Eintragen</Link>
        <Link href="/verpaaren" style={{ marginRight: '10px', color: '#fff' }}>Zucht</Link>
        <Link href="/verpaarungen" style={{ color: '#fff' }}>Gespeicherte Zucht</Link>
      </nav>
    </header>
  )
}
