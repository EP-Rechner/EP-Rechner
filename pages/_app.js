// pages/_app.js
import '../styles/globals.css'
import Header from '../components/Header'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import useIdleLogout from '../lib/useIdleLogout'
import "../styles/globals.css";

export default function MyApp({ Component, pageProps }) {
  useIdleLogout(2 * 60 * 60 * 1000) // 2h
  return (
    <>
      <Header />
      <main>
        <Component {...pageProps} />
      </main>
      <Footer />
    </>
  )
}
