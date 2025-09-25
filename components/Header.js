// components/Header.js
import Link from 'next/link'

export default function Header() {
  return (
    <header style={{ background: '#2c3e50', padding: '10px', color: '#fff' }}>
      <h1>Equinepassion Rechner</h1>
      <nav>
        <Link href="/" style={{ marginRight: '10px', color: '#fff' }}>Home</Link>
        <Link href="/login" style={{ marginRight: '10px', color: '#fff' }}>Login</Link>
        <Link href="/register" style={{ color: '#fff' }}>Registrieren</Link>
      </nav>
    </header>
  )
}
