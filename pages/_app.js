// pages/_app.js
import '../styles/globals.css'
import Header from '../components/Header'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Header />
      <main>
        <Component {...pageProps} />
      </main>
      <Footer />
      <Navbar />
      <Component {...pageProps} />
    </>
  )
}
