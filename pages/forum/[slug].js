// pages/forum/[slug].js
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react"; // 👈 useCallback hinzu
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function ForumCategory() {
  const router = useRouter();
  const { slug } = router.query;

  const [cat, setCat] = useState(null);
  const [allCats, setAllCats] = useState([]);
  const [threads, setThreads] = useState([]);
  const [session, setSession] = useState(null);
  const [selectedThreads, setSelectedThreads] = useState([]);
  const [me, setMe] = useState(null);
  const [moveTargetThreads, setMoveTargetThreads] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);
    // Modal States & Kategorien
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState("");


  const role = (me?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isMod = isAdmin || role === "moderator";

  // Einheitliches Laden + Mergen + Sortieren
const buildAndSetThreads = useCallback(async (categoryId, userId) => {
  // Threads laden
  const { data: rows } = await supabase
    .from("forum_threads")
    .select(`
      id, title, created_at, author_id, locked, is_pinned, done,
      author:mitglieder!forum_threads_author_id_fkey ( username, role )
    `)
    .eq("category_id", categoryId);

  // Stats laden
  const { data: stats } = await supabase.from("forum_thread_stats").select("*");
  const statMap = new Map(stats?.map((s) => [s.thread_id, s]));

  // Reads (nur wenn eingeloggt)
  let readMap = new Map();
  if (userId) {
    const { data: reads } = await supabase
      .from("forum_thread_reads")
      .select("thread_id, last_read_at")
      .eq("user_id", userId);
    readMap = new Map(reads?.map((r) => [r.thread_id, r.last_read_at]));
  }

  // Mergen + isNew
  const merged = (rows || []).map((r) => {
    const s = statMap.get(r.id) || {};
    const lastRead = readMap.get(r.id);
    const lastActivity = new Date(s.last_post_at || r.created_at);
    const isNew = !lastRead || new Date(lastRead) < lastActivity;
    return { ...r, stats: s, isNew };
  });

  // Sortierung: 📌 zuerst, dann letztes Activity-Datum (neu → alt)
  merged.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    const dateA = new Date(a.stats.last_post_at || a.created_at);
    const dateB = new Date(b.stats.last_post_at || b.created_at);
    return dateB - dateA;
  });

  setThreads(merged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  // Session laden
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      if (session?.user) {
        const { data: meRow } = await supabase
          .from("mitglieder")
          .select("username, role")
          .eq("id", session.user.id)
          .single();
        setMe(meRow || null);
      }
    };
    init();
  }, []);

  // Kategorien laden
  useEffect(() => {
    const loadCats = async () => {
      const { data } = await supabase
        .from("forum_categories")
        .select("id, name, slug")
        .neq("slug", "ankuendigungen")
        .order("name");
      setAllCats(data || []);
    };
    loadCats();
  }, []);

  // Kategorie + Threads laden
      useEffect(() => {
        if (!slug) return;
        const load = async () => {
          const { data: category } = await supabase
            .from("forum_categories")
            .select("*")
            .eq("slug", slug)
            .single();

          setCat(category || null);

          if (category?.id) {
            await buildAndSetThreads(category.id, session?.user?.id);
          }
        };
        load();
      }, [slug, session?.user?.id, buildAndSetThreads]);

  // Thread-Aktion (Admin/Mod)
const handleThreadAction = async (threadId, action, extra) => {
  try {
    if (action === "pin")    await supabase.from("forum_threads").update({ is_pinned: true }).eq("id", threadId);
    if (action === "unpin")  await supabase.from("forum_threads").update({ is_pinned: false }).eq("id", threadId);
    if (action === "lock")   await supabase.from("forum_threads").update({ locked: true }).eq("id", threadId);
    if (action === "unlock") await supabase.from("forum_threads").update({ locked: false }).eq("id", threadId);
    if (action === "done")   await supabase.from("forum_threads").update({ done: true }).eq("id", threadId);
    if (action === "undone") await supabase.from("forum_threads").update({ done: false }).eq("id", threadId);
    if (action === "move")   await supabase.from("forum_threads").update({ category_id: extra }).eq("id", threadId);
    if (action === "delete") await supabase.from("forum_threads").delete().eq("id", threadId);

   // Threads nach Aktion neu laden – konsistent sortiert
    await buildAndSetThreads(cat.id, session?.user?.id);

      } catch (err) {
        alert("Fehler: " + err.message);
      }
    };

  const canCreateInThisCategory =
    !!session?.user &&
    (!cat?.slug ||
      cat.slug.toLowerCase() !== "ankuendigungen" ||
      (me?.role && me.role.toLowerCase() === "admin"));

  const createThread = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!session?.user) return setErrorMsg("Bitte einloggen.");
    if (!canCreateInThisCategory)
      return setErrorMsg('Nur Admins können in "Ankündigungen" neue Threads erstellen.');
    if (!title.trim() || !content.trim())
      return setErrorMsg("Titel und Inhalt dürfen nicht leer sein.");

    const { data: thread, error: tErr } = await supabase
      .from("forum_threads")
      .insert({
        category_id: cat.id,
        title: title.trim(),
        author_id: session.user.id,
      })
      .select("*")
      .single();
    if (tErr) return setErrorMsg(tErr.message);

    await supabase.from("forum_posts").insert({
      thread_id: thread.id,
      author_id: session.user.id,
      content: content.trim(),
    });

    router.push(`/forum/thread/${thread.id}`);
  };

  return (
    <div style={{ padding: 20, maxWidth: "75%", margin: "0 auto" }}>
      <div className="forum-wrapper">
        {/* Zurück-Button zum Forum */}
<div style={{ marginBottom: 16 }}>
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
    ← Zurück zum Forum
  </Link>
</div>

<h1>{cat ? cat.name : "Lade Kategorie…"}</h1>
        {cat?.description && <p style={{ color: "#666" }}>{cat.description}</p>}

        {/* Dropdown für Mehrfachaktionen */}
        {(isAdmin || isMod) && (
          <div style={{ margin: "12px 0" }}>
                        <select
              defaultValue=""
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;

                if (val === "move") {
                  setMoveTargetThreads(selectedThreads); // Auswahl merken
                  setShowMoveModal(true);                // Modal öffnen
                  // WICHTIG: hier NICHT selectedThreads leeren!
                } else if (val === "delete") {
                  setShowDeleteConfirm(true);            // Modal öffnen
                  // WICHTIG: hier NICHT selectedThreads leeren!
                } else {
                  // Sofort-Aktionen (pin/unpin/lock/unlock/done/undone) direkt ausführen
                  selectedThreads.forEach((id) => handleThreadAction(id, val));
                  setSelectedThreads([]);                // erst hier leeren
                }

                e.target.value = "";                     // Dropdown zurücksetzen
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
              onMouseEnter={(e) => (e.target.style.backgroundColor = "#3f5875")}
              onMouseLeave={(e) => (e.target.style.backgroundColor = "#34495e")}
            >
              <option value="" disabled>
                Aktion wählen…
              </option>
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

        {/* Threads Tabelle im neuen Stil */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            overflow: "hidden",
            background: "white",
            marginTop: 16,
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
                {(isAdmin || isMod) && (
                  <th style={{ width: 40, textAlign: "center" }}>✔</th>
                )}
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontWeight: "600",
                    borderRight: "2px solid #d1d5db",
                  }}
                >
                  Thread
                </th>
                <th
                  style={{
                    width: 120,
                    textAlign: "center",
                    fontWeight: "600",
                    borderRight: "2px solid #d1d5db",
                  }}
                >
                  Kommentare
                </th>
                <th
                  style={{
                    width: 200,
                    textAlign: "center",
                    fontWeight: "600",
                  }}
                >
                  Letzter Beitrag
                </th>
              </tr>
            </thead>
            <tbody>
              {threads.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin || isMod ? 4 : 3}
                    style={{ textAlign: "center", color: "#777", padding: 20 }}
                  >
                    Noch keine Threads.
                  </td>
                </tr>
              ) : (
                threads.map((t) => (
                  <tr
                    key={t.id}
                    style={{
                      borderTop: "1px solid #e5e7eb",
                      background: "#fff",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#f9fafb")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "#fff")
                    }
                  >
                    {(isAdmin || isMod) && (
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedThreads.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedThreads([...selectedThreads, t.id]);
                            } else {
                              setSelectedThreads(
                                selectedThreads.filter((id) => id !== t.id)
                              );
                            }
                          }}
                        />
                      </td>
                    )}
                    <td
                      style={{
                        padding: "10px 16px",
                        borderRight: "2px solid #e5e7eb",
                      }}
                    >
                      <Link href={`/forum/thread/${t.id}`} className="threadLink">
                          {t.isNew && (
                            <span
                              style={{
                                color: "orange",
                                fontWeight: "bold",
                                marginRight: 6,
                              }}
                            >
                              NEU
                            </span>
                          )}
                          {t.is_pinned && "📌 "}
                          {t.locked && "🔒 "}
                          {t.done && <span style={{ color: "green" }}>✅ </span>}
                          {t.title}
                        </Link>
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        borderRight: "2px solid #e5e7eb",
                      }}
                    >
                      {t.stats?.comment_count || 0}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {t.stats?.last_post_at ? (
                        <>
                          {new Date(t.stats.last_post_at).toLocaleString()}{" "}
                          · von{" "}
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
                          {!["admin", "moderator"].includes(
                            t.stats.last_post_role?.toLowerCase()
                          ) && (
                            <span style={{ color: "#1e2ba0", fontWeight: "bold" }}>
                              {t.stats.last_post_user || "Unbekannt"}
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Thread-Erstellen Formular */}
{!(cat?.slug?.toLowerCase() === "ankuendigungen" && !isAdmin) && (
  <>
    <h2 style={{ marginTop: 32 }}>Neuen Thread erstellen</h2>
    {session?.user && canCreateInThisCategory && (
      <form
        onSubmit={createThread}
        style={{
          display: "grid",
          gap: 8,
          background: "#f9fafb",
          borderRadius: "12px",
          padding: "18px 24px",
          border: "1px solid #e5e7eb",
          marginTop: "12px",
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titel"
          required
          style={{
            padding: 10,
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Inhalt"
          rows={6}
          required
          style={{
            padding: 10,
            border: "1px solid #ccc",
            borderRadius: 6,
            resize: "vertical",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "8px 14px",
            background: "#34495e",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Thread erstellen
        </button>
        {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}
      </form>
    )}
  </>
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
        Threads verschieben
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

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
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

            for (const threadId of moveTargetThreads) {
              await handleThreadAction(threadId, "move", selectedCatId);
            }

            setSelectedCatId("");
            setMoveTargetThreads([]);
            setSelectedThreads([]); // <— Häkchen jetzt leeren
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
          onMouseLeave={(e) => (e.target.style.background = "#2c3e50")}
        >
          Verschieben
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
      <h3 style={{ marginBottom: 12, fontSize: "18px", fontWeight: "bold" }}>
        Threads wirklich löschen?
      </h3>
      <p style={{ marginBottom: 20, color: "#555" }}>
        Dieser Vorgang kann <strong>nicht rückgängig gemacht</strong> werden.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
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
            for (const threadId of selectedThreads) {
              await handleThreadAction(threadId, "delete");
            }
            setSelectedThreads([]);
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
          onMouseEnter={(e) => (e.target.style.background = "#dc2626")}
          onMouseLeave={(e) => (e.target.style.background = "#b91c1c")}
        >
          Löschen
        </button>
      </div>
    </div>
  </div>
)}
<style jsx>{`
  :global(.threadLink) {
    color: #2c3e50;
    font-weight: 600;
    text-decoration: none;
  }

  :global(.threadLink:hover) {
    text-decoration: underline !important;
  }

  :global(.threadLink:visited),
  :global(.threadLink:active),
  :global(.threadLink:focus) {
    color: #2c3e50 !important;
  }
`}</style>

    </div>
  );
}
