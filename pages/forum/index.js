// pages/forum/index.js
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

export default function ForumIndex() {
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [cats, setCats] = useState([]);

  const role = (me?.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  const isMod   = isAdmin || role === 'moderator';

  // Session + User laden
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      if (session?.user) {
        const { data: meRow } = await supabase
          .from('mitglieder')
          .select('username, role')
          .eq('id', session.user.id)
          .single();
        setMe(meRow || null);
      }
    };
    init();
  }, []);

  // Kategorien + Stats laden
  useEffect(() => {
    const load = async () => {
      const { data: categories } = await supabase
        .from('forum_categories')
        .select('id, name, slug, description')
        .order('position', { ascending: true });

      const { data: stats } = await supabase.from('forum_thread_stats').select('*');
      const { data: threads } = await supabase.from('forum_threads').select('id, category_id, created_at');

      let readMap = new Map();
      if (session?.user) {
        const { data: reads } = await supabase
          .from('forum_thread_reads')
          .select('thread_id, last_read_at')
          .eq('user_id', session.user.id);
        readMap = new Map((reads || []).map(r => [r.thread_id, r.last_read_at]));
      }

      const statsMap = new Map((stats || []).map(s => [s.thread_id, s]));
      const categoryInfo = {};

      for (const t of threads || []) {
        const s = statsMap.get(t.id);
        const lastActivity = new Date(s?.last_post_at || t.created_at);
        if (!categoryInfo[t.category_id]) {
          categoryInfo[t.category_id] = { count: 0, lastActivity: null, lastUser: null, lastRole: null };
        }
        categoryInfo[t.category_id].count++;
        if (!categoryInfo[t.category_id].lastActivity || lastActivity > categoryInfo[t.category_id].lastActivity) {
          categoryInfo[t.category_id].lastActivity = lastActivity;
          categoryInfo[t.category_id].lastUser = s?.last_post_user || null;
          categoryInfo[t.category_id].lastRole = s?.last_post_role || null;
        }
        const lastRead = readMap.get(t.id);
        const isNew = !lastRead || new Date(lastRead) < lastActivity;
        if (isNew) categoryInfo[t.category_id].isNew = true;
      }

      const merged = (categories || []).map(c => ({
        ...c,
        threadCount: categoryInfo[c.id]?.count || 0,
        lastActivity: categoryInfo[c.id]?.lastActivity || null,
        lastUser: categoryInfo[c.id]?.lastUser || null,
        lastRole: categoryInfo[c.id]?.lastRole || null,
        isNewCategory: categoryInfo[c.id]?.isNew || false,
      }));

      setCats(merged);
    };

    load();
  }, [session?.user]);

  return (
    <div style={{ padding: 20, maxWidth: "75%", margin: "0 auto" }}>
      <div className="forum-wrapper">
        <h1 style={{ marginBottom: 16, fontSize: 22, fontWeight: 600 }}>Forum</h1>

        {/* Neue Tabelle im Stil der Threads-Seite */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            overflow: "hidden",
            background: "white",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
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
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", width: "35%", borderRight: "2px solid #d1d5db" }}>
                  Kategorie
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", width: "35%", borderRight: "2px solid #d1d5db" }}>
                  Beschreibung
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", width: "80px", borderRight: "2px solid #d1d5db" }}>
                  Threads
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", width: "200px" }}>
                  Letzter Beitrag
                </th>
              </tr>
            </thead>

            <tbody>
              {cats.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "20px", textAlign: "center", color: "#777" }}>
                    Keine Kategorien vorhanden.
                  </td>
                </tr>
              ) : (
                cats.map((c) => (
                  <tr
                    key={c.id}
                    style={{
                      borderTop: "1px solid #e5e7eb",
                      background: "#fff",
                      transition: "background 0.2s ease-in-out",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                  >
                    {/* Kategorie */}
                    <td style={{ padding: "10px 16px", borderRight: "2px solid #e5e7eb" }}>
                        <Link href={`/forum/${c.slug}`} className="catLink">
                          {c.isNewCategory && session?.user && (
                            <span style={{ color: "orange", fontWeight: "bold", marginRight: 6 }}>NEU</span>
                          )}
                          {c.name}
                        </Link>
                      </td>


                    {/* Beschreibung */}
                    <td style={{ color: "#000000ff", padding: "10px 16px", borderRight: "2px solid #e5e7eb" }}>
                      {c.description || "—"}
                    </td>

                    {/* Anzahl Threads */}
                    <td style={{ textAlign: "center", borderRight: "2px solid #e5e7eb" }}>
                      {c.threadCount}
                    </td>

                    {/* Letzter Beitrag */}
                    <td style={{ textAlign: "center", padding: "10px 16px" }}>
                      {c.lastActivity ? (
                        <>
                          {c.lastActivity.toLocaleString()} {" · von "}
                          {c.lastRole?.toLowerCase() === "admin" && (
                            <span style={{ color: "red", fontWeight: "bold" }}>
                              {c.lastUser} (Admin)
                            </span>
                          )}
                          {c.lastRole?.toLowerCase() === "moderator" && (
                            <span style={{ color: "green", fontWeight: "bold" }}>
                              {c.lastUser} (Moderator)
                            </span>
                          )}
                          {!["admin", "moderator"].includes(c.lastRole?.toLowerCase()) && (
                            <span style={{ color: "#1e2ba0", fontWeight: "bold" }}>
                              {c.lastUser || "Unbekannt"}
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
      </div>
      <style jsx>{`
  /* Stile für den Kategorie-Link */
  :global(.catLink) {
    color: #2c3e50;
    font-weight: 600;
    text-decoration: none;
  }

  /* Beim Darüberfahren */
  :global(.catLink:hover) {
    text-decoration: underline !important;
  }

  /* Gleiche Farbe behalten, auch nach Klick */
  :global(.catLink:visited),
  :global(.catLink:active),
  :global(.catLink:focus) {
    color: #2c3e50 !important;
  }
`}</style>

    </div>
  );
}
