import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState(null);

  const [latestThreads, setLatestThreads] = useState([]);
  const [unreadThreads, setUnreadThreads] = useState([]);
  const [topVoted, setTopVoted] = useState([]);

  // Sichtbarkeit
  const [showLatest, setShowLatest] = useState(true);
  const [showUnread, setShowUnread] = useState(true);
  const [showTopVoted, setShowTopVoted] = useState(true);

  const router = useRouter();

// Einstellungen pro User speichern/lesen
useEffect(() => {
  if (!user) return;

  const uid = user.id;
  const latest = localStorage.getItem(`showLatest_${uid}`);
  const unread = localStorage.getItem(`showUnread_${uid}`);
  const top = localStorage.getItem(`showTopVoted_${uid}`);

  if (latest !== null) setShowLatest(latest === "true");
  if (unread !== null) setShowUnread(unread === "true");
  if (top !== null) setShowTopVoted(top === "true");
}, [user]);

useEffect(() => {
  if (user) localStorage.setItem(`showLatest_${user.id}`, showLatest);
}, [showLatest, user]);

useEffect(() => {
  if (user) localStorage.setItem(`showUnread_${user.id}`, showUnread);
}, [showUnread, user]);

useEffect(() => {
  if (user) localStorage.setItem(`showTopVoted_${user.id}`, showTopVoted);
}, [showTopVoted, user]);


  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push("/");
        return;
      }
      setUser(session.user);

      // Username laden
      const { data: meRow } = await supabase
        .from("mitglieder")
        .select("username")
        .eq("id", session.user.id)
        .single();
      setUsername(meRow?.username || null);

      // 📌 Neueste Threads
        const { data: threads } = await supabase
          .from("forum_threads")
          .select(`
            id, title, created_at, author_id, locked, is_pinned, done,
            category:forum_categories ( id, name ),
            author:mitglieder!forum_threads_author_id_fkey ( username, role )
          `)
          .order("created_at", { ascending: false })
          .limit(10);

        const { data: statsAll } = await supabase.from("forum_thread_stats").select("*");
        const statMapAll = new Map(statsAll?.map((s) => [s.thread_id, s]));


        // 🔄 Zusammenführen
        const merged = (threads || []).map((t) => ({
          ...t,
          stats: statMapAll.get(t.id) || {},
        }));

        setLatestThreads(merged);


      // 📌 Ungelesene Threads
      const { data: allThreads } = await supabase
        .from("forum_threads")
        .select(`
          id, title, created_at, author_id, locked, is_pinned, done,
          category:forum_categories ( id, name ),
          author:mitglieder!forum_threads_author_id_fkey ( username, role )
        `);

      const { data: statsUnread } = await supabase.from("forum_thread_stats").select("*");
      const statMapUnread = new Map(statsUnread?.map((s) => [s.thread_id, s]));


      const { data: reads } = await supabase
        .from("forum_thread_reads")
        .select("thread_id, last_read_at")
        .eq("user_id", session.user.id);

      const readMap = new Map(reads?.map((r) => [r.thread_id, r.last_read_at]));

      const mergedUnread = (allThreads || []).map((t) => {
  const s = statMapUnread.get(t.id) || {};
        const lastRead = readMap.get(t.id);
        const lastActivity = new Date(s.last_post_at || t.created_at);
        const isUnread = !lastRead || new Date(lastRead) < lastActivity;
        return { ...t, stats: s, isUnread };
      });

      setUnreadThreads(merged.filter((t) => t.isUnread));


      // 📌 Wünsche & Anregungen nach Votes
      const { data: votedThreads } = await supabase
        .from("forum_threads")
        .select(`
          id, title, locked, done, is_pinned,
          category:forum_categories ( name, slug ),
          votes:forum_votes ( vote )
        `)
        .eq("category.slug", "wuensche-anregungen");
      const scored = (votedThreads || []).map(t => {
        let score = 0;
        (t.votes || []).forEach(v => {
          if (v.vote === "pro") score += 1;
          if (v.vote === "contra") score -= 1;
        });
        return { ...t, score };
      });
      scored.sort((a, b) => b.score - a.score);
      setTopVoted(scored.slice(0, 10));

      setLoading(false);
    };
    init();
  }, [router]);

  const unreadIds = useMemo(() => new Set(unreadThreads.map(t => t.id)), [unreadThreads]);

  if (loading) return <p>Lade...</p>;
  if (!user) return null;

  return (
    <div style={{ padding: "20px" }}>
      <div className="forum-table-container">
      <h1 className="forum-table-welcome"></h1>
      <h1>Willkommen {username ? username : "..."} </h1>
      </div>

      {/* Neueste Threads */}
        <>
          <div className="forum-table-container">
  <div className="forum-table-header">
    <h2 className="forum-table-title">Neueste Threads</h2>
    <button
      className="toggle-btn"
      onClick={() => setShowLatest((s) => !s)}
    >
      {showLatest ? "Ausblenden" : "Einblenden"}
    </button>
  </div>

  {/* Tabelle bleibt sichtbar/nicht sichtbar */}
  {showLatest ? (
    <table className="forum-table">
      <thead>
        <tr>
          <th>Titel</th>
          <th>Kategorie</th>
          <th>Letzte Aktivität</th>
        </tr>
      </thead>
      <tbody>
        {latestThreads.length === 0 && (
          <tr><td colSpan={3}>Keine Threads vorhanden</td></tr>
        )}
        {latestThreads.map((t) => (
          <tr key={t.id}>
            <td>
              <Link href={`/forum/thread/${t.id}`} legacyBehavior>
                <a className="threadLink">
                  {unreadIds.has(t.id) && (
                    <span style={{ color: "orange", fontWeight: "bold", marginRight: 6 }}>NEU</span>
                  )}
                  {t.is_pinned && <span style={{ marginRight: 4 }}>📌</span>}
                  {t.locked && <span style={{ marginRight: 4 }}>🔒</span>}
                  {t.done && <span style={{ color: "green", marginRight: 4 }}>✅</span>}
                  {t.title}
                </a>
              </Link>

            </td>
            <td>{t.category?.name}</td>
            <td>
              {t.stats?.last_post_at ? (
                <>
                  {new Date(t.stats.last_post_at).toLocaleString()} {" · von "}
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
        ))}
      </tbody>
    </table>
  ) : (
    <p style={{ color: "#555", marginTop: "8px" }}>Tabelle ausgeblendet.</p>
  )}
</div>
        </>


      {/* Ungelesene Threads */}
        <>
          <div className="forum-table-container">
  <div className="forum-table-header">
    <h2 className="forum-table-title">Ungelesene Threads</h2>
    <button
      className="toggle-btn"
      onClick={() => setShowUnread((s) => !s)}
    >
      {showUnread ? "Ausblenden" : "Einblenden"}
    </button>
  </div>

  {showUnread ? (
    <table className="forum-table">
      <thead>
        <tr>
          <th>Titel</th>
          <th>Kategorie</th>
          <th>Letzte Aktivität</th>
        </tr>
      </thead>
      <tbody>
        {unreadThreads.length === 0 && (
          <tr><td colSpan={3}>Keine ungelesenen Threads</td></tr>
        )}
        {unreadThreads.map((t) => (
          <tr key={t.id}>
            <td>
              <Link href={`/forum/thread/${t.id}`} legacyBehavior>
                <a className="threadLink">
                  {unreadIds.has(t.id) && (
                    <span style={{ color: "orange", fontWeight: "bold", marginRight: 6 }}>NEU</span>
                  )}
                  {t.is_pinned && <span style={{ marginRight: 4 }}>📌</span>}
                  {t.locked && <span style={{ marginRight: 4 }}>🔒</span>}
                  {t.done && <span style={{ color: "green", marginRight: 4 }}>✅</span>}
                  {t.title}
                </a>
              </Link>

            </td>
            <td>{t.category?.name}</td>
            <td>
                {t.stats?.last_post_at
                  ? <>
                      {new Date(t.stats.last_post_at).toLocaleString()} {" · von "}
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
                      {!["admin", "moderator"].includes(t.stats.last_post_role?.toLowerCase()) && (
                        <span style={{ color: "#1e2ba0", fontWeight: "bold" }}>
                          {t.stats.last_post_user || "Unbekannt"}
                        </span>
                      )}
                    </>
                  : "—"}
              </td>

          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p style={{ color: "#555", marginTop: "8px" }}>Tabelle ausgeblendet.</p>
  )}
</div>
        </>


      {/* Top Wünsche & Anregungen */}
        <>
          <div className="forum-table-container">
  <div className="forum-table-header">
    <h2 className="forum-table-title">Top 10 Wünsche & Anregungen</h2>
    <button
      className="toggle-btn"
      onClick={() => setShowTopVoted((s) => !s)}
    >
      {showTopVoted ? "Ausblenden" : "Einblenden"}
    </button>
  </div>

  {showTopVoted ? (
    <table className="forum-table">
      <thead>
        <tr>
          <th>Thread</th>
          <th>Punkte</th>
        </tr>
      </thead>
      <tbody>
        {topVoted.length === 0 && (
          <tr><td colSpan={2}>Keine Threads vorhanden</td></tr>
        )}
        {topVoted.map((t) => (
          <tr key={t.id}>
            <td>
              <Link href={`/forum/thread/${t.id}`} legacyBehavior>
                <a className="threadLink">
                  {unreadIds.has(t.id) && (
                    <span style={{ color: "orange", fontWeight: "bold", marginRight: 6 }}>NEU</span>
                  )}
                  {t.is_pinned && <span style={{ marginRight: 4 }}>📌</span>}
                  {t.locked && <span style={{ marginRight: 4 }}>🔒</span>}
                  {t.done && <span style={{ color: "green", marginRight: 4 }}>✅</span>}
                  {t.title}
                </a>
              </Link>

            </td>
            <td>{t.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p style={{ color: "#555", marginTop: "8px" }}>Tabelle ausgeblendet.</p>
  )}
</div>
        </>

     <style jsx>{`
  .forum-table-container {
    width: 75%;
    margin: 0 auto;
  }

  .forum-table {
    width: 100%;
    margin-top: 16px;
    border-collapse: collapse;
    table-layout: fixed;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }

  .forum-table thead tr {
    background: #34495e;
    color: white;
  }

  .forum-table th {
    padding: 12px 16px;
    font-weight: 600;
    border-right: 2px solid #d1d5db;
  }

  .forum-table td {
    padding: 10px 16px;
    border-top: 1px solid #e5e7eb;
    border-right: 2px solid #e5e7eb;
    background: #fff;
    transition: background 0.2s ease-in-out;
  }

  .forum-table tr:hover td {
    background: #f9fafb;
  }

  .forum-table th:not(:first-child),
  .forum-table td:not(:first-child) {
    text-align: center;
  }

  /* Einheitlicher Thread-Link-Stil wie auf den anderen Forum-Seiten */
.threadLink {
  color: #2c3e50;
  font-weight: 600;
  text-decoration: none;
}

.threadLink:hover {
  text-decoration: underline !important;
}

.threadLink:visited,
.threadLink:active,
.threadLink:focus {
  color: #2c3e50 !important;
}

    .forum-table-title {
  margin-top: 24px;
  margin-bottom: 8px;
  font-size: 20px;
  font-weight: 600;
  color: #000000ff;
  text-align: left;   /* ganz links innerhalb des Containers */
}
.forum-table-welcome {
  margin-top: 10px;
  margin-bottom: 24px;
  font-size: 24px;
  font-weight: 600;
  color: #000; /* Schwarz */
  text-align: left; /* bündig mit Tabellen */
}
.forum-table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24px;
  margin-bottom: 8px;
}

.toggle-btn {
  background: #34495e;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  transition: background 0.2s ease-in-out;
}

.toggle-btn:hover {
  background: #3f5875;
}

`}</style>
    </div>
  );
}
