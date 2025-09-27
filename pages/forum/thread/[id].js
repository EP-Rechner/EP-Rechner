// pages/forum/thread/[id].js
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

  const role = (me?.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  const isMod   = isAdmin || role === 'moderator';

  // Session + User laden
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
          id, title, created_at, author_id, locked, done,
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

  // WICHTIG: Als gelesen markieren, sobald Thread + Posts geladen sind und der User existiert
  useEffect(() => {
    if (!id || !session?.user || !thread) return;

    const markAsRead = async () => {
      console.log("Markiere Thread als gelesen:", thread.id, session.user.id);

    const { error } = await supabase
        .from("forum_thread_reads")
        .upsert({
          user_id: session.user.id,
          thread_id: thread.id,
          last_read_at: new Date().toISOString()
        },
        { onConflict: 'user_id,thread_id' }
      );
      if (error) {
        console.error("Fehler beim upsert:", error);
      } else {
        console.log("Upsert erfolgreich!");
      }
    };

    // einmal bei (thread, posts) laden:
    markAsRead();
  }, [id, session?.user, thread, posts.length]);

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

    // neu laden (damit man den eigenen neuen Kommentar sofort sieht)
    const { data: p } = await supabase
      .from('forum_posts')
      .select(`
        id, content, created_at, author_id,
        author:Users!forum_posts_author_id_fkey ( Username, role )
      `)
      .eq('thread_id', id)
      .order('created_at', { ascending: true })
    setPosts(p || [])

    // direkt wieder als gelesen markieren (damit "NEU" nicht zurückkehrt)
    if (session?.user && thread) {
      await supabase
        .from("forum_thread_reads")
        .upsert({
          user_id: session.user.id,
          thread_id: thread.id,
          last_read_at: new Date().toISOString()
        }, { onConflict: 'user_id,thread_id' });
    }
  }

  // Thread-Action Dropdown
  const handleThreadAction = async (threadId, action, extra) => {
    try {
      if (action === "pin") {
        await supabase.from("forum_threads").update({ is_pinned: true }).eq("id", threadId);
      } else if (action === "unpin") {
        await supabase.from("forum_threads").update({ is_pinned: false }).eq("id", threadId);
      } else if (action === "lock") {
        await supabase.from("forum_threads").update({ locked: true }).eq("id", threadId);
      } else if (action === "unlock") {
        await supabase.from("forum_threads").update({ locked: false }).eq("id", threadId);
      } else if (action === "done") {
        await supabase.from("forum_threads").update({ done: true }).eq("id", threadId);
      } else if (action === "undone") {
        await supabase.from("forum_threads").update({ done: false }).eq("id", threadId);
      } else if (action === "move") {
        await supabase.from("forum_threads").update({ category_id: extra }).eq("id", threadId);
      } else if (action === "delete") {
        await supabase.from("forum_threads").delete().eq("id", threadId);
      }

      // Reload nach Aktion
      const { data: updated } = await supabase
        .from("forum_threads")
        .select(`
          id, title, created_at, author_id, locked, is_pinned, done,
          category:forum_categories ( id, slug, name ),
          author:Users!forum_threads_author_id_fkey ( Username, role )
        `)
        .eq("id", threadId)
        .single();

      setThread(updated || null);
    } catch (err) {
      alert(err.message);
    }
  };

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

      <h1>
        {thread?.done && <span style={{ color: 'green', marginRight: 6 }}>✅</span>}
        {thread?.title || 'Lade…'}
      </h1>

      {(isAdmin || isMod) && thread?.category?.slug !== "ankuendigungen" && (
        <div style={{ marginTop: 8 }}>
          <select
            defaultValue=""
            onChange={(e) => {
              const val = e.target.value;
              if (val === "move") {
                const newCategoryId = prompt("Bitte Kategorie-ID eingeben (außer Ankündigungen):");
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

      {thread && (
        <div style={{ marginBottom: 12 }}>
          {/* ✅ Erledigt anzeigen */}
          {thread.done && (
            <span style={{ color: 'green', fontWeight: 'bold', marginRight: 8 }}>✅ Erledigt</span>
          )}

          {/* ✅ Button nur für Admin/Mod in Bugs & Wünsche, oder Owner in Fragen & Probleme */}
          {session?.user && (
            <>
              {!thread.done ? (
                (
                  (['bugs','bugs-fehler','wuensche','wuensche-anregungen'].includes(thread.category.slug) && (isAdmin || role === 'moderator'))
                  ||
                  (thread.category.slug === 'fragen-probleme' && session.user.id === thread.author_id)
                ) && (
                  <button
                    onClick={async () => {
                      const { error } = await supabase
                        .from('forum_threads')
                        .update({ done: true })
                        .eq('id', thread.id);
                      if (error) return alert(error.message);
                      setThread({ ...thread, done: true });
                    }}
                    style={{
                      background:'#22c55e',
                      color:'#fff',
                      border:'none',
                      padding:'6px 10px',
                      borderRadius:4
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
                        .eq('id', thread.id);
                      if (error) return alert(error.message);
                      setThread({ ...thread, done: false });
                    }}
                    style={{
                      background:'#ef4444',
                      color:'#fff',
                      border:'none',
                      padding:'6px 10px',
                      borderRadius:4
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

      {/* Posts */}
      <div style={{ margin: '12px 0 24px' }}>
        {posts.map(p => {
          const canEditOwn = session?.user?.id === p.author_id;  // eigener Kommentar
          const authorRole = (p.author?.role || '').toLowerCase();

          // Sichtbarkeitslogik für Löschen – muss zur RLS passen:
          // - eigener Kommentar
          // - admin: immer
          // - mod: nur wenn der Autor NICHT admin ist
          const canDelete = !!session?.user && (
            isAdmin ||
            (isMod && authorRole !== 'admin')
          );

          return (
            <div key={p.id} style={{ borderTop:'1px solid #eee', padding:'10px 0' }}>
              <div style={{ fontSize:12 }}>
                {p.author?.role?.toLowerCase() === 'admin' && (
                  <span style={{ color: 'red', fontWeight: 'bold' }}>
                    {p.author?.Username} (Admin)
                  </span>
                )}
                {p.author?.role?.toLowerCase() === 'moderator' && (
                  <span style={{ color: 'green', fontWeight: 'bold' }}>
                    {p.author?.Username} (Moderator)
                  </span>
                )}
                {!['admin','moderator'].includes(p.author?.role?.toLowerCase()) && (
                  <span style={{ color: '#1e2ba0ff', fontWeight: 'bold' }}>
                    {p.author?.Username || 'Unbekannt'}
                  </span>
                )}
                {' • '}
                {new Date(p.created_at).toLocaleString()}
                {authorRole === 'admin' ? ' • (Admin)' : authorRole === 'moderator' ? ' • (Mod)' : ''}
              </div>

              {editingId === p.id ? (
                <>
                  <textarea
                    value={editText}
                    onChange={(e)=>setEditText(e.target.value)}
                    rows={4}
                    style={{ width:'100%', padding:8, border:'1px solid #ccc', borderRadius:6 }}
                  />
                  <div style={{ display:'flex', gap:8, marginTop:6 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const newText = editText.trim();
                        if (!newText) return alert('Text darf nicht leer sein.');
                        const { error } = await supabase
                          .from('forum_posts')
                          .update({ content: newText })
                          .eq('id', p.id);
                        if (error) return alert(error.message);

                        // neu laden
                        const { data: reload, error: rErr } = await supabase
                          .from('forum_posts')
                          .select(`
                            id, content, created_at, author_id,
                            author:Users!forum_posts_author_id_fkey ( Username, role )
                          `)
                          .eq('thread_id', id)
                          .order('created_at', { ascending: true });
                        if (rErr) return alert(rErr.message);

                        setPosts(reload || []);
                        setEditingId(null);
                        setEditText('');
                      }}
                    >
                      Speichern
                    </button>
                    <button type="button" onClick={() => { setEditingId(null); setEditText(''); }}>
                      Abbrechen
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ whiteSpace:'pre-wrap' }}>{p.content}</div>
              )}

              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                {/* Edit nur eigener Kommentar */}
                {canEditOwn && editingId !== p.id && (
                  <button
                    type="button"
                    onClick={() => { setEditingId(p.id); setEditText(p.content); }}
                  >
                    Bearbeiten
                  </button>
                )}

                {/* Löschen nach obigen Regeln */}
                {canDelete && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Kommentar löschen?')) return;
                      const { error } = await supabase
                        .from('forum_posts')
                        .delete()
                        .eq('id', p.id);
                      if (error) return alert(error.message);
                      setPosts(prev => prev.filter(x => x.id !== p.id));
                    }}
                  >
                    Löschen
                  </button>
                )}
              </div>
            </div>
          );
        })}
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
