// pages/forum/[slug].js
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'

export default function ForumCategory() {
  const router = useRouter()
  const { slug } = router.query

  const [cat, setCat] = useState(null)
  const [allCats, setAllCats] = useState([])
  const [threads, setThreads] = useState([])
  const [session, setSession] = useState(null)
  const [me, setMe] = useState(null) // Users row (Username, role)

  // Form state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)

  // Role helpers
  const role = (me?.role || '').toLowerCase()
  const isAdmin = role === 'admin'
  const isMod   = isAdmin || role === 'moderator'

  // Lade User + Session
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

  // Lade Kategorie + Threads
  useEffect(() => {
    if (!slug) return
    const load = async () => {
      const { data: category, error: catErr } = await supabase
        .from('forum_categories')
        .select('*')
        .eq('slug', slug)
        .single()

      if (catErr) {
        console.error(catErr)
        setCat(null)
        setThreads([])
        return
      }

      const { data: cats } = await supabase
        .from('forum_categories')
        .select('id, name, slug')
        .order('name', { ascending: true })
      setAllCats(cats || [])

      setCat(category || null)

      if (category) {
        const { data: rows, error: thrErr } = await supabase
          .from('forum_threads')
          .select(`
            id, title, created_at, author_id, locked, is_pinned,
            author:Users!forum_threads_author_id_fkey ( Username, role )
          `)
          .eq('category_id', category.id)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
        if (thrErr) console.error(thrErr)
        setThreads(rows || [])
      }
    }
    load()
  }, [slug])

  // Berechtigung Threads zu erstellen
  const canCreateInThisCategory =
    !!session?.user && (
      !cat?.slug ||
      cat.slug.toLowerCase() !== 'ankuendigungen' ||
      (me?.role && me.role.toLowerCase() === 'admin')
    )

  // Thread erstellen
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

    const { error: pErr } = await supabase
      .from('forum_posts')
      .insert({
        thread_id: thread.id,
        author_id: session.user.id,
        content: content.trim()
      })
    if (pErr) { setErrorMsg(pErr.message); return }

    router.push(`/forum/thread/${thread.id}`)
  }

  // Thread pin/unpin
  const togglePin = async (thread) => {
    try {
      const { error } = await supabase
        .from('forum_threads')
        .update({ is_pinned: !thread.is_pinned })
        .eq('id', thread.id)
      if (error) throw error

      const { data, error: reloadErr } = await supabase
        .from('forum_threads')
        .select(`
          id, title, created_at, author_id, locked, is_pinned,
          author:Users!forum_threads_author_id_fkey ( Username, role )
        `)
        .eq('category_id', cat.id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
      if (reloadErr) throw reloadErr
      setThreads(data || [])
    } catch (e) {
      alert(e.message)
    }
  }

  // Thread verschieben
  const moveThread = async (threadId, newCategoryId) => {
    try {
      const { error } = await supabase
        .from('forum_threads')
        .update({ category_id: newCategoryId })
        .eq('id', threadId)
      if (error) throw error
      setThreads(prev => prev.filter(t => t.id !== threadId))
    } catch (e) {
      alert(e.message)
    }
  }

  // Thread löschen
  const deleteThread = async (threadId) => {
    if (!confirm('Thread wirklich löschen?')) return
    const { error } = await supabase
      .from('forum_threads')
      .delete()
      .eq('id', threadId)
    if (error) return alert(error.message)
    setThreads(prev => prev.filter(t => t.id !== threadId))
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>{cat ? cat.name : 'Lade Kategorie…'}</h1>
      {cat?.description && <p style={{ color:'#666' }}>{cat.description}</p>}

      {/* Threads-Liste */}
      <div style={{ margin: '16px 0' }}>
        {threads.map(t => (
          <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <Link href={`/forum/thread/${t.id}`} style={{ color:'#2563eb', fontWeight: 600 }}>
              {t.title}
            </Link>
            <div style={{ fontSize: 12, color:'#666' }}>
              von {t.author?.Username || 'Unbekannt'} • {new Date(t.created_at).toLocaleString()}
              {t.locked ? ' • 🔒 gesperrt' : ''}
              {t.is_pinned ? ' • 📌 gepinnt' : ''}
            </div>

            {/* Admin/Mod-Leiste */}
            {(isAdmin || isMod) && (
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                {isAdmin && (
                  <button onClick={() => togglePin(t)}>
                    {t.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                )}

                <select
                  defaultValue=""
                  onChange={(e) => {
                    const val = e.target.value
                    if (val) moveThread(t.id, val)
                    e.target.value = ""
                  }}
                  style={{ padding:4 }}
                >
                  <option value="" disabled>In Kategorie verschieben…</option>
                  {allCats
                    .filter(c => c.id !== cat?.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))
                  }
                </select>

                <button onClick={() => deleteThread(t.id)}>Löschen</button>
              </div>
            )}
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
