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
      // Kategorien
      const { data: categories, error: catErr } = await supabase
        .from('forum_categories')
        .select('id, name, slug, description')
        .order('position', { ascending: true });

      if (catErr) {
        console.error(catErr);
        setCats([]);
        return;
      }

      // Stats pro Thread
      const { data: stats, error: statErr } = await supabase
        .from('forum_thread_stats')
        .select('*');

      if (statErr) {
        console.error(statErr);
      }

      // Threads laden (für Zuordnung zu Kategorien + created_at)
      const { data: threads, error: thrErr } = await supabase
        .from('forum_threads')
        .select('id, category_id, created_at');
      if (thrErr) console.error(thrErr);

      // Reads des mitglieder (für NEU)
      let readMap = new Map();
      if (session?.user) {
        const { data: reads, error: readErr } = await supabase
          .from('forum_thread_reads')
          .select('thread_id, last_read_at')
          .eq('user_id', session.user.id);

        if (!readErr) {
          readMap = new Map((reads || []).map(r => [r.thread_id, r.last_read_at]));
        } else {
          console.error(readErr);
        }
      }

      // Threads -> letzte Aktivität + "NEU"-Check
      const statsMap = new Map((stats || []).map(s => [s.thread_id, s]));
      const categoryInfo = {};

      for (const t of threads || []) {
        const s = statsMap.get(t.id);
        const lastActivity = new Date(s?.last_post_at || t.created_at);

        // Kategorie initialisieren
        if (!categoryInfo[t.category_id]) {
          categoryInfo[t.category_id] = {
            count: 0,
            lastActivity: null,
            lastUser: null,
            lastRole: null,
          };
        }

        // Anzahl erhöhen
        categoryInfo[t.category_id].count++;

        // Letzter Beitrag
        if (
          !categoryInfo[t.category_id].lastActivity ||
          lastActivity > categoryInfo[t.category_id].lastActivity
        ) {
          categoryInfo[t.category_id].lastActivity = lastActivity;
          categoryInfo[t.category_id].lastUser = s?.last_post_user || null;
          categoryInfo[t.category_id].lastRole = s?.last_post_role || null;
        }

        // NEU prüfen
        const lastRead = readMap.get(t.id);
        const isNew = !lastRead || new Date(lastRead) < lastActivity;
        if (isNew) {
          categoryInfo[t.category_id].isNew = true;
        }
      }

      // Kategorien zusammenbauen
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
    <div style={{ padding: 20 }}>
      <div className="forum-wrapper">
        <h1>Forum</h1>

        <table className="forum-table">
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Kategorie</th>
              <th style={{ width: '35%' }}>Beschreibung</th>
              <th style={{ width: 80, textAlign: "center" }}>Threads</th>
              <th style={{ width: 200, textAlign: "center" }}>Letzter Beitrag</th>
            </tr>
          </thead>
          <tbody>
            {cats.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: '#666' }}>
                  Keine Kategorien vorhanden.
                </td>
              </tr>
            )}
            {cats.map(c => (
              <tr key={c.id}>
                {/* Kategorie */}
                <td>
                  <Link href={`/forum/${c.slug}`}>
                    {c.isNewCategory && session?.user && (
                      <span style={{ color: 'orange', fontWeight: 'bold', marginRight: 6 }}>NEU</span>
                    )}
                    {c.name}
                  </Link>
                </td>

                {/* Beschreibung */}
                <td style={{ color: '#555' }}>
                  {c.description || '—'}
                </td>

                {/* Anzahl Threads */}
                <td style={{ textAlign: "center" }}>
                  {c.threadCount}
                </td>

                {/* Letzter Beitrag */}
                <td style={{ textAlign: "right" }}>
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
                      {!["admin","moderator"].includes(c.lastRole?.toLowerCase()) && (
                        <span style={{ color: "#1e2ba0ff", fontWeight: "bold" }}>
                          {c.lastUser || "Unbekannt"}
                        </span>
                      )}
                    </>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
          margin-top: 16px;
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
  );
}
