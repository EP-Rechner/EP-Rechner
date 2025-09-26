export default function Footer() {
  return (
    <footer
      style={{
        background: '#2c3e50',
        padding: '15px',
        color: '#fff',
        marginTop: '20px',
        textAlign: 'center'
      }}
    >
      <p>© 2025 Equinepassion Rechner</p>
      <div style={{ marginTop: '8px' }}>
        <a
          href="/impressum"
          style={{ color: '#1abc9c', marginRight: '15px', textDecoration: 'none' }}
        >
          Impressum
        </a>
        <a
          href="/datenschutz"
          style={{ color: '#1abc9c', textDecoration: 'none' }}
        >
          Datenschutz
        </a>
      </div>
    </footer>
  )
}
