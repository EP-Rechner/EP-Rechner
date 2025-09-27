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

  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  const role = (me?.role || '').toLowerCase()
  const isAdmin = role === 'admin'
  const isMod   = isAdmin || role === 'moderator'

  // Session & eigenes User-Objekt laden
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

  // Thread + Posts laden
  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data: t } = await supabase
        .from('forum_threads')
        .select(`
          id, title, created_at, author_id, locked, done, is_pinned,
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
  }, [id, session])

  // Beim Öffnen (und nach Post-Reload) als gelesen markieren
  useEffect(() => {
    if (!id || !session?.user || !thread) return
    const markAsRead = async () => {
      try {
        // Optional: für Debugging
        // console.log('Markiere Thread als gelesen:', session.user.id, thread.id)

        const { error } = await supabase
          .from('forum_thread_reads')
          .upsert({
            user_id: session.user.id,
            thread_id: thread.id,
            last_read_at: new Date().toISOString()
          }, { onConflict: 'user_id, thread_id' })

        if (error) {
          console.error('Fehler beim upsert forum_thread_reads:', error)
        }
      } catch (e) {
        console.error('Unerwarteter Fehler beim Upsert:', e)
      }
    }
    markAsRead()
    // posts.length in die deps, damit nach neuem Kommentar wieder als gelesen markiert wird
  }, [id, session?.user, thread, posts.length])

  // Kommentar hinzufügen
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

    // Posts neu laden
    const { data: p, error: rErr } = await supabase
      .from('forum_posts')
      .select(`
        id, content, created_at, author_id,
        author:Users!forum_posts_author_id_fkey ( Username, role )
      `)
      .eq('thread_id', id)
      .order('created_at', { ascending: true })
    if (!rErr) setPosts(p || [])

    // Nach dem Schreiben als gelesen markieren (damit „NEU“ in der Liste sicher weg ist)
    if (session?.user && thread) {
      await supabase
        .from('forum_thread_reads')
        .upsert({
          user_id: session.user.id,
          thread_id: thread.id,
          last_read_at: new Date().toISOString()
        }, { onConflict: 'user_id, thread_id' })
    }
  }

  // Thread-Aktions-Dropdown (Admin/Mod)
  const handleThreadAction = async (threadId, action, extra) => {
    try {
      if (action === 'pin')    await supabase.from('forum_threads').update({ is_pinned: true  }).eq('id', threadId)
      if (action === 'unpin')  await supabase.from('forum_threads').update({ is_pinned: false }).eq('id', threadId)
      if (action === 'lock')   await supabase.from('forum_threads').update({ locked: true     }).eq('id', threadId)
      if (action === 'unlock') await supabase.from('forum_threads').update({ locked: false    }).eq('id', threadId)
      if (action === 'done')   await supabase.from('forum_threads').update({ done: true       }).eq('id', threadId)
      if (action === 'undone') await supabase.from('forum_threads').update({ done: false      }).eq('id', threadId)
      if (action === 'move')   await supabase.from('forum_threads').update({ category_id: extra }).eq('id', threadId)
      if (action === 'delete') await supabase.from('forum_threads').delete().eq('id', threadId)

      // Thread nach Action nachladen (inkl. is_pinned/locked/done usw.)
      const { data: updated } = await supabase
        .from('forum_threads')
        .select(`
          id, title, created_at, author_id, locked, is_pinned, done,
          category:forum_categories ( id, slug, name ),
          author:Users!forum_threads_author_id_fkey ( Username, role )
        `)
        .eq('id', threadId)
        .single()
      setThread(updated || null)

      // Bei delete zurück zur Kategorie
      if (action === 'delete' && updated === null) {
        if (thread?.category?.slug) router.replace(`/forum/${thread.category.slug}`)
        else router.replace('/forum')
      }
    } catch (err) {
      alert(err.message)
    }
  }

  // Rechte pro Post
  const canDeleteFor = (authorRole) => {
    // - eigener Kommentar -> handled unten über id-Vergleich; hier nur Fremd-Kommentar-Regel
    // - admin: immer
    // - mod: nur wenn der Autor NICHT admin ist
    return isAdmin || (isMod && (authorRole || '').toLowerCase() !== 'admin')
  }

  return (
    <div style={{ padding: 20 }}>
      <div className="forum-wrapper">
        {/* Breadcrumbs */}
        <div style={{ marginBottom: 12 }}>
          <Link href="/forum" style={{ color: '#2563eb' }}>← Forum</Link>
          {thread?.category && (
            <>
              {' · '}
              <Link href={`/forum/${thread.category.slug}`} style={{ color: '#2563eb' }}>
                {thread.category.name}
              </Link>
            </>
          )}
        </div>

        {/* Titel */}
        <h1>
          {thread?.done && <span style={{ color: 'green', marginRight: 6 }}>✅</span>}
          {thread?.is_pinned && <span style={{ marginRight: 6 }}>📌</span>}
          {thread?.locked && <span style={{ marginRight: 6 }}>🔒</span>}
          {thread?.title || 'Lade…'}
        </h1>

        {/* Admin/Mod – Aktionsmenü */}
        {(isAdmin || isMod) && thread?.category?.slug !== 'ankuendigungen' && thread && (
          <div style={{ margin: '8px 0 12px' }}>
            <select
              defaultValue=""
              onChange={(e) => {
                const val = e.target.value
                if (!val) return
                if (val === 'move') {
                  const newCategoryId = prompt('Bitte Kategorie-ID eingeben (außer Ankündigungen):')
                  if (newCategoryId) handleThreadAction(thread.id, 'move', newCategoryId)
                } else {
                  handleThreadAction(thread.id, val)
                }
                e.target.value = ''
              }}
            >
              <option value="" disabled>Aktion wählen…</option>
              {thread?.is_pinned ? <option value="unpin">Unpin</option> : <option value="pin">Pin</option>}
              {thread?.locked ? <option value="unlock">Unlock</option> : <option value="lock">Lock</option>}
              {thread?.done ? <option value="undone">Nicht erledigt</option> : <option value="done">Erledigt</option>}
              <option value="move">Verschieben</option>
              <option value="delete">Löschen</option>
            </select>
          </div>
        )}

        {/* Erledigt-Status + Buttons nach Rollen/Kategorien */}
        {thread && (
          <div style={{ marginBottom: 12 }}>
            {thread.done && (
              <span style={{ color: 'green', fontWeight: 'bold', marginRight: 8 }}>✅ Erledigt</span>
            )}

            {session?.user && (
              <>
                {!thread.done ? (
                  (
                    (['bugs', 'bugs-fehler', 'wuensche', 'wuensche-anregungen'].includes(thread.category.slug) && (isAdmin || role === 'moderator')) ||
                    (thread.category.slug === 'fragen-probleme' && session.user.id === thread.author_id)
                  ) && (
                    <button
                      onClick={async () => {
                        const { error } = await supabase
                          .from('forum_threads')
                          .update({ done: true })
                          .eq('id', thread.id)
                        if (error) return alert(error.message)
                        setThread({ ...thread, done: true })
                      }}
                      style={{
                        background: '#22c55e',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 10px',
                        borderRadius: 4
                      }}
                    >
                      Als erledigt markieren
                    </button>
                  )
                ) : (
                  (isAdmin || isMod) && (
                    <button
                      onClick={async () => {
                        const { error } = await supabase
                          .from('forum_threads')
                          .update({ done: false })
                          .eq('id', thread.id)
                        if (error) return alert(error.message)
                        setThread({ ...thread, done: false })
                      }}
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 10px',
                        borderRadius: 4
                      }}
                    >
                      Als nicht erledigt markieren
                    </button>
                  )
                )}
              </>
            )}
          </div>
        )}

        {/* Posts als Tabelle */}
        <table className="forum-table">
          <thead>
            <tr>
              <th style={{ width: 200 }}>Autor</th>
              <th>Beitrag</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 && (
              <tr>
                <td colSpan={2} style={{ textAlign: 'center', color: '#666' }}>
                  Noch keine Kommentare.
                </td>
              </tr>
            )}
            {posts.map((p) => {
              const canEditOwn = session?.user?.id === p.author_id
              const authorRole = (p.author?.role || '').toLowerCase()
              const canDelete = !!session?.user && (canEditOwn || canDeleteFor(authorRole))

              return (
                <tr key={p.id}>
                  <td style={{ verticalAlign: 'top' }}>
                    {/* Name + Rolle + Zeit */}
                    {authorRole === 'admin' && (
                      <span style={{ color: 'red', fontWeight: 'bold' }}>
                        {p.author?.Username} (Admin)
                      </span>
                    )}
                    {authorRole === 'moderator' && (
                      <span style={{ color: 'green', fontWeight: 'bold' }}>
                        {p.author?.Username} (Moderator)
                      </span>
                    )}
                    {!['admin', 'moderator'].includes(authorRole) && (
                      <span style={{ color: '#1e2ba0ff', fontWeight: 'bold' }}>
                        {p.author?.Username || 'Unbekannt'}
                      </span>
                    )}
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                  </td>

                  <td>
                    {editingId === p.id ? (
                      <>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={5}
                          style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
                        />
                        {(
  (isAdmin && thread?.category?.slug === "ankuendigungen") ||
  ((isAdmin || isMod) && thread?.category?.slug !== "ankuendigungen")
) && (
  <div style={{ marginTop: 8 }}>
    <select
      defaultValue=""
      onChange={(e) => {
        const val = e.target.value;
        if (val === "move") {
          const newCategoryId = prompt("Bitte Kategorie-ID eingeben:");
          if (newCategoryId) handleThreadAction(thread.id, "move", newCategoryId);
        } else {
          handleThreadAction(thread.id, val);
        }
        e.target.value = "";
      }}
    >
      <option value="" disabled>Aktion wählen…</option>
      {thread?.is_pinned
        ? <option value="unpin">Unpin</option>
        : <option value="pin">Pin</option>}
      {thread?.locked
        ? <option value="unlock">Unlock</option>
        : <option value="lock">Lock</option>}
      {thread?.done === true && <option value="undone">Nicht erledigt</option>}
      {thread?.done === false && <option value="done">Erledigt</option>}
      <option value="move">Verschieben</option>
      <option value="delete">Löschen</option>
    </select>
  </div>
)}

                      </>
                    ) : (
                      <>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{p.content}</div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          {/* Bearbeiten: nur eigener Kommentar */}
                          {canEditOwn && editingId !== p.id && (
                            <button
                              type="button"
                              onClick={() => { setEditingId(p.id); setEditText(p.content) }}
                            >
                              Bearbeiten
                            </button>
                          )}

                          {/* Löschen: eigener Kommentar, oder gemäß Regel (Admin immer, Mod nicht Admin-Kommentare) */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('Kommentar löschen?')) return
                                const { error } = await supabase
                                  .from('forum_posts')
                                  .delete()
                                  .eq('id', p.id)
                                if (error) return alert(error.message)
                                setPosts(prev => prev.filter(x => x.id !== p.id))
                              }}
                            >
                              Löschen
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Kommentarformular */}
        {thread && !thread.locked && (
          <form onSubmit={addComment} style={{ display: 'grid', gap: 8, maxWidth: 800, marginTop: 16 }}>
            {!session?.user && <p>Bitte einloggen um zu kommentieren.</p>}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Kommentar…"
              rows={4}
              disabled={!session?.user}
              style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
            />
            <button type="submit" disabled={!session?.user} style={{ padding: '8px 12px' }}>
              Kommentar senden
            </button>
            {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
          </form>
        )}
        {thread?.locked && <p>Dieser Thread ist gesperrt.</p>}
      </div>

      <style jsx>{`
        .forum-wrapper {
          max-width: 1000px;
          margin: 0 auto;
          padding: 0 16px;
        }
        .forum-wrapper h1 {
          margin-bottom: 8px;
          font-size: 22px;
        }
        .forum-table {
          width: 100%;
          margin: 0 auto;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 14px;
          background: #fff;
        }
        .forum-table th,
        .forum-table td {
          border: 1px solid #e5e7eb;
          padding: 10px 12px;
          text-align: left;
          vertical-align: top;
        }
        .forum-table thead th {
          background: #f4f6f9;
          font-weight: 600;
        }
        .forum-table tbody tr:nth-child(even) {
          background: #fafafa;
        }
        .forum-table tbody tr:hover {
          background: #f1f5f9;
        }
      `}</style>
    </div>
  )
}
