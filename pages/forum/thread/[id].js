// pages/forum/thread/[id].js
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import Link from 'next/link'

export default function ThreadPage() {
  const router = useRouter()
  const { id } = router.query

  const [thread, setThread] = useState(null)
  const [posts, setPosts] = useState([])
  const [session, setSession] = useState(null)
  const [me, setMe] = useState(null)
  const [content, setContent] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)
  const [editingId, setEditingId] = useState(null);
const [editText, setEditText] = useState('');
const isAdmin = me?.role?.toLowerCase() === 'admin';
const isMod   = me?.role?.toLowerCase() === 'moderator' || isAdmin;


  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session || null)
      if (session?.user) {
        const { data: meRow } = await supabase
          .from('Users')
          .select('Username, Role')
          .eq('id', session.user.id)
          .single()
        setMe(meRow || null)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data: t } = await supabase
        .from('forum_threads')
        .select(`
          id, title, created_at, author_id, locked,
          category:forum_categories ( id, slug, name ),
          author:Users!forum_threads_author_id_fkey ( Username, role )
        `)
        .eq('id', id)
        .single()
      setThread(t || null)

      const { data: p } = await supabase
        .from('forum_posts')
        .select(`
          id, content, created_at, author_id,
          author:Users!forum_posts_author_id_fkey ( Username, role )
        `)
        .eq('thread_id', id)
        .order('created_at', { ascending: true })
      setPosts(p || [])
    }
    load()
  }, [id])

  const addComment = async (e) => {
    e.preventDefault()
    setErrorMsg(null)
    if (!session?.user) { setErrorMsg('Bitte einloggen.'); return }
    if (!content.trim()) { setErrorMsg('Kommentar darf nicht leer sein.'); return }
    if (thread?.locked) { setErrorMsg('Thread ist gesperrt.'); return }

    const { error } = await supabase
      .from('forum_posts')
      .insert({
        thread_id: thread.id,
        author_id: session.user.id,
        content: content.trim()
      })
    if (error) { setErrorMsg(error.message); return }

    setContent('')
    // neu laden
    const { data: p } = await supabase
      .from('forum_posts')
      .select(`
        id, content, created_at, author_id,
        author:Users!forum_posts_author_id_fkey ( Username, role )
      `)
      .eq('thread_id', id)
      .order('created_at', { ascending: true })
    setPosts(p || [])
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/forum" style={{ color:'#2563eb' }}>← Forum</Link>
        {thread?.category && (
          <>
            {' · '}
            <Link href={`/forum/${thread.category.slug}`} style={{ color:'#2563eb' }}>
              {thread.category.name}
            </Link>
          </>
        )}
      </div>

      <h1>{thread?.title || 'Lade…'}</h1>
      {thread && (
        <div style={{ color:'#666', marginBottom: 16, fontSize: 13 }}>
          von {thread.author?.Username || 'Unbekannt'} • {new Date(thread.created_at).toLocaleString()}
          {thread.locked ? ' • 🔒 gesperrt' : ''}
        </div>
      )}

      {/* Posts */}
      <div style={{ margin: '12px 0 24px' }}>
        {posts.map(p => (
          <div key={p.id} style={{ borderTop:'1px solid #eee', padding:'10px 0' }}>
            <div style={{ fontSize:12, color:'#666' }}>
              {p.author?.Username || 'Unbekannt'} • {new Date(p.created_at).toLocaleString()}
            </div>
            <div style={{ whiteSpace:'pre-wrap' }}>{p.content}</div>
          </div>
        ))}
        {posts.length === 0 && <p>Noch keine Kommentare.</p>}
      </div>

      {/* Kommentarformular */}
      {thread && !thread.locked && (
        <form onSubmit={addComment} style={{ display:'grid', gap: 8, maxWidth: 640 }}>
          {!session?.user && <p>Bitte einloggen um zu kommentieren.</p>}
          <textarea
            value={content}
            onChange={(e)=>setContent(e.target.value)}
            placeholder="Kommentar…"
            rows={4}
            disabled={!session?.user}
            style={{ padding: 8, border:'1px solid #ccc', borderRadius: 6 }}
          />
          <button type="submit" disabled={!session?.user} style={{ padding:'8px 12px' }}>
            Kommentar senden
          </button>
          {errorMsg && <p style={{ color:'red' }}>{errorMsg}</p>}
        </form>
      )}
      {thread?.locked && <p>Dieser Thread ist gesperrt.</p>}
    </div>
  )
}
