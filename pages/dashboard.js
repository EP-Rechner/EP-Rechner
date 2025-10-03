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

  // Einstellungen aus localStorage lesen
  useEffect(() => {
    const latest = localStorage.getItem("showLatest");
    const unread = localStorage.getItem("showUnread");
    const top = localStorage.getItem("showTopVoted");
    if (latest !== null) setShowLatest(latest === "true");
    if (unread !== null) setShowUnread(unread === "true");
    if (top !== null) setShowTopVoted(top === "true");
  }, []);

  // Änderungen speichern
  useEffect(() => { localStorage.setItem("showLatest", showLatest); }, [showLatest]);
  useEffect(() => { localStorage.setItem("showUnread", showUnread); }, [showUnread]);
  useEffect(() => { localStorage.setItem("showTopVoted", showTopVoted); }, [showTopVoted]);

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
      const { data: latest } = await supabase
        .from("forum_threads")
        .select(`
          id, title, created_at, locked, done, is_pinned,
          category:forum_categories ( id, name )
        `)
        .order("created_at", { ascending: false })
        .limit(10);
      setLatestThreads(latest || []);

      // 📌 Ungelesene Threads
      const { data: allThreads } = await supabase
        .from("forum_threads")
        .select(`
          id, title, created_at, locked, done, is_pinned,
          category:forum_categories ( id, name ),
          posts:forum_posts ( created_at )
        `);
      const { data: reads } = await supabase
        .from("forum_thread_reads")
        .select("thread_id, last_read_at")
        .eq("user_id", session.user.id);
      const readMap = new Map((reads || []).map(r => [r.thread_id, r.last_read_at]));

      const unread = (allThreads || []).map(t => {
        const lastPostDate = t.posts?.length
          ? new Date(Math.max(...t.posts.map(p => new Date(p.created_at).getTime())))
          : null;
        const lastActivity = lastPostDate
          ? new Date(Math.max(new Date(t.created_at).getTime(), lastPostDate.getTime()))
          : new Date(t.created_at);
        const lastRead = readMap.get(t.id);
        const isUnread = !lastRead || new Date(lastRead) < lastActivity;
        return { ...t, last_activity: lastActivity, isUnread };
      }).filter(t => t.isUnread);

      unread.sort((a, b) => b.last_activity - a.last_activity);
      setUnreadThreads(unread);

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
      <h1>Willkommen {username ? username : "..."} </h1>

      {/* Toggle Buttons */}
      <div style={{ marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={() => setShowLatest(s => !s)}>
          {showLatest ? "Neueste Threads ausblenden" : "Neueste Threads einblenden"}
        </button>
        <button onClick={() => setShowUnread(s => !s)}>
          {showUnread ? "Ungelesene Threads ausblenden" : "Ungelesene Threads einblenden"}
        </button>
        <button onClick={() => setShowTopVoted(s => !s)}>
          {showTopVoted ? "Top Wünsche & Anregungen ausblenden" : "Top Wünsche & Anregungen einblenden"}
        </button>
      </div>

      {/* Neueste Threads */}
      {showLatest && (
        <>
          <h2 style={{ marginTop: 24 }}>Neueste Threads</h2>
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
                    <Link href={`/forum/thread/${t.id}`}>
                      {unreadIds.has(t.id) && <span style={{ color: "orange", fontWeight: "bold", marginRight: 6 }}>NEU</span>}
                      {t.is_pinned && <span style={{ marginRight: 4 }}>📌</span>}
                      {t.locked && <span style={{ marginRight: 4 }}>🔒</span>}
                      {t.done && <span style={{ color: "green", marginRight: 4 }}>✅</span>}
                      {t.title}
                    </Link>
                  </td>
                  <td>{t.category?.name}</td>
                  <td>{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Ungelesene Threads */}
      {showUnread && (
        <>
          <h2 style={{ marginTop: 24 }}>Ungelesene Threads</h2>
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
                    <Link href={`/forum/thread/${t.id}`}>
                      <span style={{ color: "orange", fontWeight: "bold", marginRight: 6 }}>NEU</span>
                      {t.is_pinned && <span style={{ marginRight: 4 }}>📌</span>}
                      {t.locked && <span style={{ marginRight: 4 }}>🔒</span>}
                      {t.done && <span style={{ color: "green", marginRight: 4 }}>✅</span>}
                      {t.title}
                    </Link>
                  </td>
                  <td>{t.category?.name}</td>
                  <td>{new Date(t.last_activity).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Top Wünsche & Anregungen */}
      {showTopVoted && (
        <>
          <h2 style={{ marginTop: 24 }}>Top 10 Wünsche & Anregungen</h2>
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
                    <Link href={`/forum/thread/${t.id}`}>
                      {t.is_pinned && <span style={{ marginRight: 4 }}>📌</span>}
                      {t.locked && <span style={{ marginRight: 4 }}>🔒</span>}
                      {t.done && <span style={{ color: "green", marginRight: 4 }}>✅</span>}
                      {t.title}
                    </Link>
                  </td>
                  <td>{t.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <style jsx>{`
        .forum-table {
          width: 100%;
          margin-top: 12px;
          border-collapse: collapse;
          background: #fff;
        }
        .forum-table th,
        .forum-table td {
          border: 1px solid #e5e7eb;
          padding: 8px 10px;
          vertical-align: middle;
        }
        .forum-table th {
          background: #f9fafb;
        }
        .forum-table tr:nth-child(even) {
          background: #fafafa;
        }
        /* Alle außer die erste Spalte zentrieren */
        .forum-table th:not(:first-child),
        .forum-table td:not(:first-child) {
          text-align: center;
        }
      `}</style>
    </div>
  );
}
