// pages/forum/thread/[id].js
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import Link from 'next/link'
import { DataTable } from "@/components/ui/data-table"


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
  const [votes, setVotes] = useState({ pro: 0, neutral: 0, contra: 0 })


  // Modal State fürs Verschieben
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [allCats, setAllCats] = useState([])
  const [selectedCatId, setSelectedCatId] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPostDeleteConfirm, setShowPostDeleteConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);

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
          .from('mitglieder')
          .select('username, role')
          .eq('id', session.user.id)
          .single()
        setMe(meRow || null)
      }
    }
    init()
  }, [])

  // Kategorien laden (für Move-Dropdown)
  useEffect(() => {
    const loadCats = async () => {
      const { data } = await supabase
        .from("forum_categories")
        .select("id, name, slug")
        .neq("slug", "ankuendigungen")
        .order("name")
      setAllCats(data || [])
    }
    loadCats()
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
          author:mitglieder!forum_threads_author_id_fkey ( username, role )
        `)
        .eq('id', id)
        .single()
      setThread(t || null)

      const { data: p } = await supabase
        .from('forum_posts')
        .select(`
          id, content, created_at, author_id,
          author:mitglieder!forum_posts_author_id_fkey ( username, role )
        `)
        .eq('thread_id', id)
        .order('created_at', { ascending: true })
      setPosts(p || [])
    }
    load()
  }, [id, session])

  // Als gelesen markieren
  useEffect(() => {
    if (!id || !session?.user || !thread) return
    const markAsRead = async () => {
      try {
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

    const { data: p, error: rErr } = await supabase
      .from('forum_posts')
      .select(`
        id, content, created_at, author_id,
        author:mitglieder!forum_posts_author_id_fkey ( username, role )
      `)
      .eq('thread_id', id)
      .order('created_at', { ascending: true })
    if (!rErr) setPosts(p || [])

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
    // Abstimmung abgeben oder ändern
  const handleVote = async (vote) => {
    if (!session?.user) return alert("Bitte einloggen");

    const { error } = await supabase
      .from("forum_votes")
      .upsert(
        { thread_id: thread.id, user_id: session.user.id, vote },
        { onConflict: "thread_id, user_id" }
      )

    if (error) {
      alert("Fehler beim Voten: " + error.message)
    } else {
      loadVotes()
    }
  }
  // Stimmen laden
  const loadVotes = async () => {
    const { data, error } = await supabase
      .from("forum_votes")
      .select("vote")
      .eq("thread_id", id)

    if (error) {
      console.error("Fehler beim Laden der Stimmen:", error)
      return
    }

    const counts = { pro: 0, neutral: 0, contra: 0 }
    data.forEach(v => counts[v.vote]++)
    setVotes(counts)
  }

  useEffect(() => {
    if (id) loadVotes()
  }, [id])


  // Thread-Aktion (Admin/Mod)
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

      const { data: updated } = await supabase
        .from('forum_threads')
        .select(`
          id, title, created_at, author_id, locked, is_pinned, done,
          category:forum_categories ( id, slug, name ),
          author:mitglieder!forum_threads_author_id_fkey ( username, role )
        `)
        .eq('id', threadId)
        .single()
      setThread(updated || null)

      if (action === 'delete' && updated === null) {
        if (thread?.category?.slug) router.replace(`/forum/${thread.category.slug}`)
        else router.replace('/forum')
      }
    } catch (err) {
      alert(err.message)
    }
  }

  const canDeleteThread = (authorRole) => {
    if (isAdmin) return true
    if (isMod && (authorRole || '').toLowerCase() !== 'admin') return true
    return false
  }

  // Rechte für Kommentare löschen
  const canDeletePost = (authorRole) => {
    if (isAdmin) return true
    if (isMod && (authorRole || '').toLowerCase() !== 'admin') return true
    return false
  }

  return (
   <div style={{ padding: 20, maxWidth: "75%", margin: "0 auto" }}>
      <div className="forum-wrapper">
        {/* Breadcrumbs */}
        <div style={{ marginBottom: 16, display: "flex", gap: "8px" }}>
  <Link
    href="/forum"
    style={{
      padding: "4px 8px",
      background: "#34495e",
      color: "white",
      border: "none",
      borderRadius: 4,
      cursor: "pointer",
      fontWeight: 500,
      fontSize: "13px",
      textDecoration: "none",
      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
      transition: "background 0.2s ease-in-out",
      display: "inline-block",
    }}
    onMouseEnter={(e) => (e.target.style.background = "#3f5875")}
    onMouseLeave={(e) => (e.target.style.background = "#34495e")}
  >
    ← Forum
  </Link>

  {thread?.category && (
    <Link
      href={`/forum/${thread.category.slug}`}
      style={{
        padding: "4px 8px",
        background: "#34495e",
        color: "white",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
        fontWeight: 500,
        fontSize: "13px",
        textDecoration: "none",
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
        transition: "background 0.2s ease-in-out",
        display: "inline-block",
      }}
      onMouseEnter={(e) => (e.target.style.background = "#3f5875")}
      onMouseLeave={(e) => (e.target.style.background = "#34495e")}
    >
      {thread.category.name}
    </Link>
  )}
</div>


        {/* Titel */}
        <h1>
          {thread?.done && <span style={{ color: 'green', marginRight: 6 }}>✅</span>}
          {thread?.is_pinned && <span style={{ marginRight: 6 }}>📌</span>}
          {thread?.locked && <span style={{ marginRight: 6 }}>🔒</span>}
          {thread?.title || 'Lade…'}
        </h1>

        {/* Abstimmungssystem nur in "Wünsche und Anregungen" */}
{thread?.category?.slug === "wuensche-anregungen" && (
  <div style={{ margin: "12px 0" }}>
    <p><strong>Abstimmungsergebnis:</strong></p>
    <p>
      👍 Dafür: {votes.pro} · 😐 Egal: {votes.neutral} · 👎 Dagegen: {votes.contra}
    </p>
    {session?.user && (
      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
        {/* Dafür (grün) */}
        <button
          onClick={() => handleVote("pro")}
          style={{
            padding: "4px 8px",
            background: "#16a34a", // grün
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 500,
            fontSize: "13px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            transition: "background 0.2s ease-in-out",
          }}
          onMouseEnter={(e) => (e.target.style.background = "#15803d")}
          onMouseLeave={(e) => (e.target.style.background = "#16a34a")}
        >
          👍 Dafür
        </button>

        {/* Egal (gelb) */}
        <button
          onClick={() => handleVote("neutral")}
          style={{
            padding: "4px 8px",
            background: "#eab308", // gelb
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 500,
            fontSize: "13px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            transition: "background 0.2s ease-in-out",
          }}
          onMouseEnter={(e) => (e.target.style.background = "#ca8a04")}
          onMouseLeave={(e) => (e.target.style.background = "#eab308")}
        >
          😐 Egal
        </button>

        {/* Dagegen (rot) */}
        <button
          onClick={() => handleVote("contra")}
          style={{
            padding: "4px 8px",
            background: "#b91c1c", // rot
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 500,
            fontSize: "13px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            transition: "background 0.2s ease-in-out",
          }}
          onMouseEnter={(e) => (e.target.style.background = "#991b1b")}
          onMouseLeave={(e) => (e.target.style.background = "#b91c1c")}
        >
          👎 Dagegen
        </button>
      </div>
    )}
  </div>
)}



        {/* Thread-Aktionsmenü nach Rollen */}
        {thread && (
          <>
            {(isAdmin || isMod) && (
              <div style={{ margin: '8px 0 12px' }}>
                <select
                    defaultValue=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      if (val === "move") {
                        setShowMoveModal(true);
                      } else if (val === "delete") {
                        setShowDeleteConfirm(true);
                      } else {
                        handleThreadAction(thread.id, val);
                      }

                      e.target.value = "";
                    }}
                    style={{
                      backgroundColor: "#34495e",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 10px",
                      cursor: "pointer",
                      fontSize: "15px",
                      fontWeight: 500,
                      transition: "background-color 0.2s ease-in-out",
                      appearance: "none",
                      WebkitAppearance: "none",
                      MozAppearance: "none",
                      backgroundImage:
                        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='white' d='M1 1l5 5 5-5'/></svg>\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 10px center",
                      backgroundSize: "12px",
                      paddingRight: "32px",
                      height: "30px",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#3f5875"; // nur Farbe ändern
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "#34495e"; // zurück zur Originalfarbe
                    }}
                  >
                    <option value="" disabled style={{ background: "#34495e", color: "white" }}>
                      Aktion wählen…
                    </option>
                    {thread?.is_pinned ? (
                      <option value="unpin" style={{ background: "#34495e", color: "white" }}>
                        Unpin
                      </option>
                    ) : (
                      <option value="pin" style={{ background: "#34495e", color: "white" }}>
                        Pin
                      </option>
                    )}
                    {thread?.locked ? (
                      <option value="unlock" style={{ background: "#34495e", color: "white" }}>
                        Unlock
                      </option>
                    ) : (
                      <option value="lock" style={{ background: "#34495e", color: "white" }}>
                        Lock
                      </option>
                    )}
                    {thread?.done ? (
                      <option value="undone" style={{ background: "#34495e", color: "white" }}>
                        Nicht erledigt
                      </option>
                    ) : (
                      <option value="done" style={{ background: "#34495e", color: "white" }}>
                        Erledigt
                      </option>
                    )}
                    <option value="move" style={{ background: "#34495e", color: "white" }}>
                      Verschieben
                    </option>
                    {canDeleteThread(thread?.author?.role) && (
                      <option value="delete" style={{ background: "#34495e", color: "white" }}>
                        Löschen
                      </option>
                    )}
                  </select>

              </div>
            )}

            {/* User darf seinen eigenen Thread auf erledigt setzen */}
            {!isAdmin && !isMod && session?.user?.id === thread?.author_id && (
              <div style={{ margin: '8px 0 12px' }}>
                {thread?.done ? (
                  <span style={{ color: 'green', fontWeight: 'bold' }}>✅ Erledigt</span>
                ) : (
                  <button
                    onClick={async () => {
                      const { error } = await supabase
                        .from('forum_threads')
                        .update({ done: true })
                        .eq('id', thread.id)
                      if (error) {
                        alert('Fehler beim Setzen auf erledigt: ' + error.message)
                      } else {
                        setThread({ ...thread, done: true })
                      }
                    }}
                    style={{
                      padding: "8px 14px",
                      background: "#34495e",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: 600,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      transition: "background 0.2s ease-in-out",
                    }}
                    onMouseEnter={(e) => (e.target.style.background = "#3f5875")}
                    onMouseLeave={(e) => (e.target.style.background = "#34495e")}
                  >
                    Als erledigt markieren
                  </button>

                )}
              </div>
            )}
          </>
        )}

       {/* Neue Forum-Tabelle im modernen Stil */}
<div className="mt-8">
  <div
    style={{
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      overflow: "hidden",
      background: "white",
    }}
  >
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        tableLayout: "fixed",
      }}
    >
      <thead>
        <tr style={{ background: "#34495e", color: "white" }}>
          <th
            style={{
              padding: "12px 16px",
              textAlign: "center",
              fontWeight: "600",
              borderRight: "2px solid #d1d5db", // ← Linie im Header
              width: "200px",
            }}
          >
            Autor
          </th>
          <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600" }}>
            Beitrag
          </th>
        </tr>
      </thead>
      <tbody>
        {posts.length > 0 ? (
          posts.map((p) => {
            const role = (p.author?.role || "").toLowerCase();

            let autorStyled;
            if (role === "admin") {
              autorStyled = (
                <span style={{ color: "red", fontWeight: "700" }}>
                  {p.author?.username} (Admin)
                </span>
              );
            } else if (role === "moderator") {
              autorStyled = (
                <span style={{ color: "green", fontWeight: "700" }}>
                  {p.author?.username} (Moderator)
                </span>
              );
            } else {
              autorStyled = (
                <span style={{ color: "#1e2ba0", fontWeight: "700" }}>
                  {p.author?.username || "Unbekannt"}
                </span>
              );
            }

            return (
              <tr key={p.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td
                  style={{
                    padding: "10px 16px",
                    verticalAlign: "top",
                    borderRight: "2px solid #e5e7eb", // ← klare Trennung sichtbar
                    width: "200px",
                  }}
                >
                  {autorStyled}
                  <div
                    className="text-xs text-gray-500 mt-1"
                    style={{ color: "#6b7280", fontSize: "13px", marginTop: "4px" }}
                  >
                    {new Date(p.created_at).toLocaleString()}
                  </div>
                </td>
                <td style={{ padding: "10px 16px", verticalAlign: "top", position: "relative" }}>
  {/* Wenn der aktuelle Post bearbeitet wird → Eingabefeld anzeigen */}
  {editingId === p.id ? (
    <div>
      <textarea
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        rows={4}
        style={{
          width: "100%",
          border: "1px solid #ccc",
          borderRadius: 6,
          padding: "8px",
          resize: "vertical",
          fontSize: "15px",
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>
        <button
          onClick={async () => {
            if (!editText.trim()) return alert("Inhalt darf nicht leer sein");
            const { error } = await supabase
              .from("forum_posts")
              .update({ content: editText.trim() })
              .eq("id", p.id);
            if (error) return alert("Fehler beim Speichern: " + error.message);
            setPosts(posts.map(post => post.id === p.id ? { ...post, content: editText } : post));
            setEditingId(null);
            setEditText("");
          }}
          style={{
            padding: "6px 10px",
            background: "#34495e",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "13px",
          }}
          onMouseEnter={(e) => (e.target.style.background = "#3f5875")}
          onMouseLeave={(e) => (e.target.style.background = "#34495e")}
        >
          Speichern
        </button>
        <button
          onClick={() => {
            setEditingId(null);
            setEditText("");
          }}
          style={{
            padding: "6px 10px",
            background: "#aaa",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "13px",
          }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  ) : (
    <>
      <div className="whitespace-pre-wrap">{p.content}</div>

      {/* Aktionen unter jedem Kommentar */}
<div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>
  {/* Bearbeiten-Button: nur für eigenen Kommentar */}
  {session?.user?.id === p.author_id && (
    <button
      onClick={() => {
        setEditingId(p.id);
        setEditText(p.content);
      }}
      style={{
        padding: "4px 8px",
        background: "#34495e",
        color: "white",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
        fontWeight: 500,
        fontSize: "13px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
        transition: "background 0.2s ease-in-out",
      }}
      onMouseEnter={(e) => (e.target.style.background = "#3f5875")}
      onMouseLeave={(e) => (e.target.style.background = "#34495e")}
    >
      Bearbeiten
    </button>
  )}

        {/* Löschen-Button: nur für Admins & Moderatoren */}
      {(isAdmin || isMod) && (
        <button
          onClick={() => {
            setPostToDelete(p.id);
            setShowPostDeleteConfirm(true);
          }}
          style={{
            padding: "4px 8px",
            background: "#b91c1c",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 500,
            fontSize: "13px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            transition: "background 0.2s ease-in-out",
          }}
          onMouseEnter={(e) => (e.target.style.background = "#dc2626")}
          onMouseLeave={(e) => (e.target.style.background = "#b91c1c")}
        >
          Löschen
        </button>
      )}
      </div>
          </>
        )}
      </td>

              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan="2" style={{ padding: "20px", textAlign: "center", color: "#777" }}>
              Keine Kommentare vorhanden.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>


  {/* Kommentarformular direkt darunter, gleiche Breite + gleichmäßiger Rand */}
{thread && !thread.locked && (
  <form
    onSubmit={addComment}
    style={{
      display: "grid",
      gap: 8,
      borderTop: "1px solid #e5e7eb",
      background: "#f9fafb",
      padding: "18px 24px 20px 24px", // mehr Innenabstand rechts + links
      boxShadow: "inset 0 2px 4px rgba(0,0,0,0.03)",
      borderBottomLeftRadius: "12px",
      borderBottomRightRadius: "12px",
    }}
  >
    {!session?.user && <p>Bitte einloggen, um zu kommentieren.</p>}
    <textarea
      value={content}
      onChange={(e) => setContent(e.target.value)}
      placeholder="Kommentar…"
      rows={4}
      disabled={!session?.user}
      style={{
        padding: 10,
        border: "1px solid #ccc",
        borderRadius: 6,
        resize: "vertical",
        width: "100%",
        fontSize: "15px",
        lineHeight: "1.5",
        background: "white",
        boxSizing: "border-box", // verhindert Überlauf
      }}
    />
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <button
        type="submit"
        disabled={!session?.user}
        style={{
          padding: "8px 14px",
          background: "#34495e",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontWeight: 600,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          transition: "background 0.2s ease-in-out",
        }}
        onMouseEnter={(e) => (e.target.style.background = "#3f5875")}
        onMouseLeave={(e) => (e.target.style.background = "#34495e")}
      >
        Kommentar senden
      </button>
    </div>
    {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}
  </form>
)}
</div>

        {/* Move Modal */}
        {showMoveModal && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    }}
  >
    <div
      style={{
        background: "#fff",
        padding: 24,
        borderRadius: 8,
        minWidth: 320,
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      }}
    >
      <h3 style={{ marginBottom: 12, fontSize: "18px", fontWeight: "bold" }}>
        Thread verschieben
      </h3>

      <select
        value={selectedCatId}
        onChange={(e) => setSelectedCatId(e.target.value)}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: 6,
          border: "1px solid #ccc",
          marginBottom: 16,
          fontSize: "15px",
        }}
      >
        <option value="">Kategorie wählen…</option>
        {allCats.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
        }}
      >
        <button
          onClick={() => setShowMoveModal(false)}
          style={{
            padding: "8px 14px",
            background: "#e5e7eb",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Abbrechen
        </button>
        <button
          onClick={async () => {
            if (!selectedCatId) {
              alert("Bitte eine Kategorie auswählen.");
              return;
            }
            await handleThreadAction(thread.id, "move", selectedCatId);
            setSelectedCatId("");
            setShowMoveModal(false);
          }}
          style={{
            padding: "8px 14px",
            background: "#2c3e50",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
          }}
          onMouseEnter={(e) => (e.target.style.background = "#1e40af")}
          onMouseLeave={(e) => (e.target.style.background = "#2563eb")}
        >
          Verschieben
        </button>
      </div>
    </div>
  </div>
)}


        {/* Falls Thread gesperrt */}
        {thread?.locked && <p>Dieser Thread ist geschlossen.</p>}

        {/* Kommentar-Löschbestätigung Modal */}
{showPostDeleteConfirm && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    }}
  >
    <div
      style={{
        background: "#fff",
        padding: 24,
        borderRadius: 8,
        minWidth: 320,
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      }}
    >
      <h3 style={{ marginBottom: 12, fontSize: "18px", fontWeight: "bold" }}>
        Kommentar wirklich löschen?
      </h3>
      <p style={{ marginBottom: 20, color: "#555" }}>
        Dieser Vorgang kann <strong>nicht rückgängig gemacht</strong> werden.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          onClick={() => {
            setShowPostDeleteConfirm(false);
            setPostToDelete(null);
          }}
          style={{
            padding: "8px 14px",
            background: "#e5e7eb",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Abbrechen
        </button>
        <button
          onClick={async () => {
            if (!postToDelete) return;
            const { error } = await supabase
              .from("forum_posts")
              .delete()
              .eq("id", postToDelete);
            if (error) {
              alert("Fehler beim Löschen: " + error.message);
            } else {
              setPosts(posts.filter((p) => p.id !== postToDelete));
            }
            setShowPostDeleteConfirm(false);
            setPostToDelete(null);
          }}
          style={{
            padding: "8px 14px",
            background: "#b91c1c",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
          }}
          onMouseEnter={(e) => (e.target.style.background = "#dc2626")}
          onMouseLeave={(e) => (e.target.style.background = "#b91c1c")}
        >
          Löschen
        </button>
      </div>
    </div>
  </div>
)}


        {/* Löschbestätigung Modal */}
        {showDeleteConfirm && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: 24,
                borderRadius: 8,
                minWidth: 320,
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              }}
            >
              <h3
                style={{
                  marginBottom: 12,
                  fontSize: "18px",
                  fontWeight: "bold",
                }}
              >
                Thread wirklich löschen?
              </h3>
              <p style={{ marginBottom: 20, color: "#555" }}>
                Dieser Vorgang kann <strong>nicht rückgängig gemacht</strong> werden.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    padding: "8px 14px",
                    background: "#e5e7eb",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Abbrechen
                </button>
                <button
                  onClick={async () => {
                    await handleThreadAction(thread.id, "delete");
                    setShowDeleteConfirm(false);
                  }}
                  style={{
                    padding: "8px 14px",
                    background: "#b91c1c",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) =>
                    (e.target.style.background = "#dc2626")
                  }
                  onMouseLeave={(e) =>
                    (e.target.style.background = "#b91c1c")
                  }
                >
                  Löschen
                </button>
              </div>
            </div>
          </div>
        )}
      </div> 
  )
}
