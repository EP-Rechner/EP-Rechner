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
  const [selectedThreads, setSelectedThreads] = useState([]);
  const [me, setMe] = useState(null) // mitglieder row (Username, role)

  // Modal State
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveTargetThreads, setMoveTargetThreads] = useState([])
  const [selectedCatId, setSelectedCatId] = useState("")

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
          .from('mitglieder')
          .select('username, role')
          .eq('id', session.user.id)
          .single()
        setMe(meRow || null)
      }
    }
    init()
  }, [])

  // Lade Kategorien für das Verschiebe-Dropdown (außer Ankündigungen)
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

  // Lade Kategorie + Threads
  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      const { data: category, error: catErr } = await supabase
        .from('forum_categories')
        .select('*')
        .eq('slug', slug)
        .single();

      if (catErr) {
        console.error(catErr);
        setCat(null);
        setThreads([]);
        return;
      }

      setCat(category || null);

      const { data: rows, error: thrErr } = await supabase
        .from('forum_threads')
        .select(`
          id, title, created_at, author_id, locked, is_pinned, done,
          author:mitglieder!forum_threads_author_id_fkey ( username, role )
        `)
        .eq('category_id', category.id);

      if (thrErr) {
        console.error(thrErr);
        return;
      }

      const { data: stats } = await supabase
        .from('forum_thread_stats')
        .select('*');

      const statMap = new Map(stats?.map(s => [s.thread_id, s]));

      // ✅ Reads nur laden, wenn eingeloggt
      let readMap = new Map();
      if (session?.user) {
        const { data: reads } = await supabase
          .from("forum_thread_reads")
          .select("thread_id, last_read_at")
          .eq("user_id", session.user.id);

        readMap = new Map(reads?.map(r => [r.thread_id, r.last_read_at]));
      }

      // Threads mit Stats und isNew
      const merged = (rows || []).map(r => {
        const stats = statMap.get(r.id) || {};
        const lastRead = readMap.get(r.id);
        const lastActivity = new Date(stats.last_post_at || r.created_at);
        const isNew = !lastRead || new Date(lastRead) < lastActivity;

        return {
          ...r,
          stats,
          isNew
        };
      });

      // Sortierung
      merged.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;

        const dateA = new Date(a.stats.last_post_at || a.created_at);
        const dateB = new Date(b.stats.last_post_at || b.created_at);
        return dateB - dateA;
      });

      setThreads(merged);
    };

    load();
  }, [slug, session]); // session drin lassen, damit Reads berücksichtigt werden

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

    // Beim Erstellen direkt als gelesen markieren
    await supabase.from("forum_thread_reads").upsert({
      user_id: session.user.id,
      thread_id: thread.id,
      last_read_at: new Date().toISOString()
    }, { onConflict: 'user_id,thread_id' });

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
          author:mitglieder!forum_threads_author_id_fkey ( username, role )
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

  // Thread-Action Dropdown (oben, für Mehrfachauswahl)
  const handleThreadAction = async (threadId, action, newCategoryId = null) => {
    try {
      if (action === "pin") {
        await supabase.from("forum_threads").update({ is_pinned: true }).eq("id", threadId);
      }
      if (action === "unpin") {
        await supabase.from("forum_threads").update({ is_pinned: false }).eq("id", threadId);
      }
      if (action === "lock") {
        await supabase.from("forum_threads").update({ locked: true }).eq("id", threadId);
      }
      if (action === "unlock") {
        await supabase.from("forum_threads").update({ locked: false }).eq("id", threadId);
      }
      if (action === "done") {
        await supabase.from("forum_threads").update({ done: true }).eq("id", threadId);
      }
      if (action === "undone") {
        await supabase.from("forum_threads").update({ done: false }).eq("id", threadId);
      }

      if (action === "delete") {
        await supabase.from("forum_threads").delete().eq("id", threadId);
        setThreads(prev => prev.filter(t => t.id !== threadId));
        return;
      }
      if (action === "move" && newCategoryId) {
        await supabase.from("forum_threads").update({ category_id: newCategoryId }).eq("id", threadId);
        setThreads(prev => prev.filter(t => t.id !== threadId));
        return;
      }

      // Reload nach Update
      const { data: updated, error } = await supabase
        .from("forum_threads")
        .select(`
          id, title, created_at, author_id, locked, is_pinned, done,
          author:mitglieder!forum_threads_author_id_fkey ( username, role )
        `)
        .eq("category_id", cat.id);

      if (error) throw error;
      setThreads(updated || []);
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <div className="forum-wrapper">
        <h1>{cat ? cat.name : 'Lade Kategorie…'}</h1>
        {cat?.description && <p className="forum-description">{cat.description}</p>}

        {/* Dropdown für Mehrfachaktionen */}
        {(
          (isAdmin && cat?.slug === "ankuendigungen") ||
          ((isAdmin || isMod) && cat?.slug !== "ankuendigungen")
        ) && (
          <div style={{ margin: "12px 0" }}>
            <select
              defaultValue=""
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                if (val === "move") {
                  setMoveTargetThreads(selectedThreads);
                  setShowMoveModal(true);   // ✅ Modal öffnen
                } else {
                  selectedThreads.forEach(id => handleThreadAction(id, val));
                }
                setSelectedThreads([]);
                e.target.value = "";
              }}
            >
              <option value="" disabled>Aktion für ausgewählte Threads wählen…</option>
              <option value="pin">Pin</option>
              <option value="unpin">Unpin</option>
              <option value="lock">Lock</option>
              <option value="unlock">Unlock</option>
              <option value="done">Erledigt</option>
              <option value="undone">Nicht erledigt</option>
              <option value="move">Verschieben</option>
              <option value="delete">Löschen</option>
            </select>
            <span style={{ marginLeft: 8, fontSize: 13, color: "#666" }}>
              {selectedThreads.length} Thread(s) ausgewählt
            </span>
          </div>
        )}

        {/* Threads-Tabelle */}
        <table className="forum-table">
          <thead>
            <tr>
  {(isAdmin || isMod) && (
    <th style={{ width: 40, textAlign: "center" }}>✔</th>
  )}
  <th style={{ width: "65%" }}>Thread</th>
  <th style={{ width: 80, textAlign: "center" }}>Kommentare</th>
  <th style={{ width: 160, textAlign: "center" }}>Letzter Beitrag</th>
</tr>

          </thead>
          <tbody>
            {threads.length === 0 && (
              <tr>
                <td colSpan={isAdmin || isMod ? 4 : 3} style={{ textAlign: "center", color: "#666" }}>
  Noch keine Threads.
</td>

              </tr>
            )}
            {threads.map(t => (
              <tr key={t.id}>
  {(isAdmin || isMod) && (
    <td style={{ textAlign: "center" }}>
      <input
        type="checkbox"
        checked={selectedThreads.includes(t.id)}
        onChange={(e) => {
          if (e.target.checked) {
            setSelectedThreads([...selectedThreads, t.id]);
          } else {
            setSelectedThreads(selectedThreads.filter(id => id !== t.id));
          }
        }}
      />
    </td>
  )}


                {/* Thread-Titel */}
                <td>
                  <Link href={`/forum/thread/${t.id}`}>
                    {t.isNew && <span style={{ color: 'orange', fontWeight: 'bold', marginRight: 6 }}>NEU</span>}
                    {t.is_pinned && <span style={{ marginRight: 4 }}>📌</span>}
                    {t.locked && <span style={{ marginRight: 4 }}>🔒</span>}
                    {t.done && <span style={{ color: 'green', marginRight: 4 }}>✅</span>}
                    {t.title}
                  </Link>
                </td>

                {/* Kommentaranzahl */}
                <td style={{ textAlign: "center" }}>
                  {t.stats?.comment_count || 0}
                </td>

                {/* Letzter Beitrag */}
                <td style={{ textAlign: "right" }}>
                  {t.stats?.last_post_at ? (
                    <>
                      {new Date(t.stats.last_post_at).toLocaleString()}
                      {" · von "}
                      {t.stats.last_post_role?.toLowerCase() === "admin" && (
                        <span style={{ color: "red", fontWeight: "bold" }}>
                          {t.stats.last_post_user} (Admin)
                        </span>
                      )}
                      {t.stats.last_post_role?.toLowerCase() === "moderator" && (
                        <span style={{ color: "green", fontWeight: "bold" }}>
                          {t.stats.last_post_user} (Moderator)
                        </span>
                      )}
                      {!["admin","moderator"].includes(t.stats.last_post_role?.toLowerCase()) && (
                        <span style={{ color: "#1e2ba0ff", fontWeight: "bold" }}>
                          {t.stats.last_post_user || "Unbekannt"}
                        </span>
                      )}
                    </>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Move Modal */}
{showMoveModal && (
  <div style={{
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000
  }}>
    <div style={{ background: "#fff", padding: 20, borderRadius: 8, minWidth: 300 }}>
      <h3>Thread verschieben</h3>
      <select
        value={selectedCatId}
        onChange={(e) => setSelectedCatId(e.target.value)}
        style={{ width: "100%", padding: 8, marginTop: 12 }}
      >
        <option value="">Kategorie wählen…</option>
        {allCats.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={() => setShowMoveModal(false)}
          style={{ padding: "6px 12px" }}
        >
          Abbrechen
        </button>
        <button
          onClick={async () => {
            if (!selectedCatId) {
              alert("Bitte eine Kategorie auswählen.");
              return;
            }
            // Verschiebe alle ausgewählten Threads
            for (const tId of selectedThreads) {
              await handleThreadAction(tId, "move", selectedCatId);
            }
            setSelectedThreads([]);
            setSelectedCatId("");
            setShowMoveModal(false);
          }}
          style={{ padding: "6px 12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 4 }}
        >
          Verschieben
        </button>
      </div>
    </div>
  </div>
)}

        <h2>Neuen Thread erstellen</h2>
        {session?.user && !canCreateInThisCategory && cat?.slug?.toLowerCase() === 'ankuendigungen' &&(
          <p>Nur Admins dürfen hier neue Threads erstellen.</p>
        )}
        {session?.user && canCreateInThisCategory && (
          <form onSubmit={createThread} style={{ display:'grid', gap: 8 }}>
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

      <style jsx>{`
        .forum-wrapper {
          max-width:1000px;
          margin: 0 auto;
          padding: 0 16px;
          }
        
        .forum-wrapper h1 {
          margin-bottom: 8px;
          font-size: 22px;
          }

          .modal-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .modal {
                background: white;
                padding: 20px;
                border-radius: 8px;
                max-width: 400px;
                width: 100%;
              }

        .forum-description {
          color: #666;
          margin-bottom: 16px;
        }

        .forum-table {
          width: 100%;
          margin: 0 auto;
          border-collapse: collapse;
          margin-top: 16px;
          font-size: 14px;
          background: #fff;
        }
        .forum-table th,
        .forum-table td {
          border: 1px solid #e5e7eb;
          padding: 10px 12px;
          text-align: left;
          vertical-align: top.
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
