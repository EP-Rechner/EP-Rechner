// pages/forum/[slug].js
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'

export default function ForumCategory() {
  const router = useRouter()
  const { slug } = router.query

  const [cat, setCat] = useState(null)
  const [threads, setThreads] = useState([])
  const [session, setSession] = useState(null)
  const [me, setMe] = useState(null) // Users row (Username, role)

  // Form state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session || null)
      if (session?.user) {
        const { data: meRow } = await supabase
          .from('Users')
          .select('Username, role')
          .eq('id', session.user.id)
          .single()
        setMe(meRow || null)
      }
    }
    init()
  }, [])

  useEffect(() => {
  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setSession(session || null)
    if (session?.user) {
      const { data: meRow } = await supabase
        .from('Users')
        .select('Username, role')
        .eq('id', session.user.id)
        .single()
      setMe(meRow || null)

      console.log("User Session ID:", session.user.id)
      console.log("Geladener User:", meRow)
    }
  }
  init()
}, [])


  useEffect(() => {
    if (!slug) return
    const load = async () => {
      const { data: category } = await supabase
        .from('forum_categories')
        .select('*')
        .eq('slug', slug)
        .single()
      setCat(category || null)

      if (category) {
        const { data: rows } = await supabase
          .from('forum_threads')
          .select(`
            id, title, created_at, author_id, locked,
            author:Users ( Username, role )
          `)
          .eq('category_id', category.id)
          .order('created_at', { ascending: false })
        setThreads(rows || [])
      }
    }
    load()
  }, [slug])

  const canCreateInThisCategory =
  session?.user &&
  (
    !cat?.slug || 
    cat.slug.toLowerCase() !== 'ankuendigungen' ||
    (me?.role && me.role.toLowerCase() === 'admin')
  )


  const createThread = async (e) => {
    e.preventDefault()
    setErrorMsg(null)
    if (!session?.user) {
      setErrorMsg('Bitte einloggen.')
      return
    }
    if (!canCreateInThisCategory) {
      setErrorMsg('Nur Admins können in "Ankündigungen" neue Threads erstellen.')
      return
    }
    if (!title.trim() || !content.trim()) {
      setErrorMsg('Titel und Inhalt dürfen nicht leer sein.')
      return
    }

    // 1) Thread anlegen
    const { data: thread, error: tErr } = await supabase
      .from('forum_threads')
      .insert({
        category_id: cat.id,
        title: title.trim(),
        author_id: session.user.id
      })
      .select('*')
      .single()

    if (tErr) { setErrorMsg(tErr.message); return }

    // 2) Ersten Post anlegen
    const { error: pErr } = await supabase
      .from('forum_posts')
      .insert({
        thread_id: thread.id,
        author_id: session.user.id,
        content: content.trim()
      })
    if (pErr) { setErrorMsg(pErr.message); return }

    // Nach Erfolg zum Thread
    router.push(`/forum/thread/${thread.id}`)
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>{cat ? cat.name : 'Lade Kategorie…'}</h1>
      {cat?.description && <p style={{ color:'#666' }}>{cat.description}</p>}

      {/* Liste Threads */}
      <div style={{ margin: '16px 0' }}>
        {threads.map(t => (
          <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <Link href={`/forum/thread/${t.id}`} style={{ color:'#2563eb', fontWeight: 600 }}>
              {t.title}
            </Link>
            <div style={{ fontSize: 12, color:'#666' }}>
              von {t.author?.Username || 'Unbekannt'} • {new Date(t.created_at).toLocaleString()}
              {t.locked ? ' • 🔒 gesperrt' : ''}
            </div>
          </div>
        ))}
        {threads.length === 0 && <p>Noch keine Threads.</p>}
      </div>

      {/* Neuer Thread */}
      <div style={{ marginTop: 24 }}>
        <h2>Neuen Thread erstellen</h2>
        {session?.user && !canCreateInThisCategory && cat?.slug?.toLowerCase() === 'ankuendigungen' && (
  <p>Nur Admins dürfen hier neue Threads erstellen.</p>
)}

        {session?.user && canCreateInThisCategory && (
          <form onSubmit={createThread} style={{ display:'grid', gap: 8, maxWidth: 640 }}>
            <input
              value={title}
              onChange={(e)=>setTitle(e.target.value)}
              placeholder="Titel"
              required
              style={{ padding: 8, border:'1px solid #ccc', borderRadius: 6 }}
            />
            <textarea
              value={content}
              onChange={(e)=>setContent(e.target.value)}
              placeholder="Inhalt"
              rows={6}
              required
              style={{ padding: 8, border:'1px solid #ccc', borderRadius: 6 }}
            />
            <button type="submit" style={{ padding:'8px 12px' }}>Thread erstellen</button>
            {errorMsg && <p style={{ color:'red' }}>{errorMsg}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
