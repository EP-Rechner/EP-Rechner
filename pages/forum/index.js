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
  const isMod = isAdmin || role === 'moderator';

  // Session + User laden (gleiches Muster wie in deinen anderen Seiten)
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      if (session?.user) {
        const { data: meRow } = await supabase
          .from('Users')
          .select('Username, role')
          .eq('id', session.user.id)
          .single();
        setMe(meRow || null);
      }
    };
    init();
  }, []);

  // Kategorien + "NEU"-Status berechnen
  useEffect(() => {
    const load = async () => {
      // Kategorien
      const { data: categories, error: catErr } = await supabase
        .from('forum_categories')
        .select('id, name, slug, description')
        .order('name', { ascending: true });

      if (catErr) {
        console.error(catErr);
        setCats([]);
        return;
      }

      // Alle Threads (nur IDs, Kategorie & created_at)
      const { data: threads, error: thrErr } = await supabase
        .from('forum_threads')
        .select('id, category_id, created_at');

      if (thrErr) {
        console.error(thrErr);
        setCats(categories || []);
        return;
      }

      // Stats pro Thread (für last_post_at)
      const { data: stats, error: statErr } = await supabase
        .from('forum_thread_stats')
        .select('thread_id, last_post_at');

      if (statErr) {
        console.error(statErr);
      }

      const statsMap = new Map((stats || []).map(s => [s.thread_id, s.last_post_at || null]));

      // Reads des eingeloggten Users
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

      // Threads -> letzte Aktivität (letzter Post oder Erstellung)
      const activityByThread = new Map(
        (threads || []).map(t => {
          const lastPost = statsMap.get(t.id);
          const lastActivity = new Date(lastPost || t.created_at).toISOString();
          return [t.id, { category_id: t.category_id, lastActivity }];
        })
      );

      // Pro Kategorie: gibt es mind. einen "neuen" Thread?
      // "Neu" = kein Read vorhanden ODER last_read_at < lastActivity
      const categoryHasNew = new Map();
      for (const t of threads || []) {
        const activity = activityByThread.get(t.id);
        if (!activity) continue;

        const lastRead = readMap.get(t.id);
        const isNew = !lastRead || new Date(lastRead) < new Date(activity.lastActivity);
        if (isNew) {
          categoryHasNew.set(t.category_id, true); // mind. einer reicht
        }
      }

      const merged = (categories || []).map(c => ({
        ...c,
        isNewCategory: !!categoryHasNew.get(c.id),
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
              <th style={{ width: '60%' }}>Kategorie</th>
              <th>Beschreibung</th>
            </tr>
          </thead>
          <tbody>
            {cats.length === 0 && (
              <tr>
                <td colSpan={2} style={{ textAlign: 'center', color: '#666' }}>
                  Keine Kategorien vorhanden.
                </td>
              </tr>
            )}
            {cats.map(c => (
              <tr key={c.id}>
                <td>
                  <Link href={`/forum/${c.slug}`}>
                    {c.isNewCategory && session?.user && (
                      <span style={{ color: 'orange', fontWeight: 'bold', marginRight: 6 }}>NEU</span>
                    )}
                    {c.name}
                  </Link>
                </td>
                <td style={{ color: '#555' }}>
                  {c.description || '—'}
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
