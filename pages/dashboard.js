// pages/dashboard.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState(null);

  const [latestThreads, setLatestThreads] = useState([]);
  const [unreadThreads, setUnreadThreads] = useState([]);

  const router = useRouter();

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

      // Neueste Threads laden (mit letzter Aktivität)
      const { data: threadsData, error: tErr } = await supabase
        .rpc("get_latest_threads_with_activity", { limit_count: 10 }); 
      // dafür legen wir gleich eine Supabase Function an (s.u.)

      if (!tErr) setLatestThreads(threadsData || []);

      // Ungelesene Threads laden
      const { data: unreadData, error: uErr } = await supabase
        .rpc("get_unread_threads_for_user", { this_user: session.user.id });

      if (!uErr) setUnreadThreads(unreadData || []);

      setLoading(false);
    };
    init();
  }, [router]);

  if (loading) return <p>Lade...</p>;
  if (!user) return null;

  return (
    <div style={{ padding: "20px" }}>
      <h1>Willkommen {username ? username : "..."}</h1>

      <h2>Neueste Threads</h2>
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
            <tr>
              <td colSpan={3}>Keine Threads vorhanden</td>
            </tr>
          )}
          {latestThreads.map((t) => (
            <tr key={t.id}>
              <td>
                <Link href={`/forum/thread/${t.id}`}>{t.title}</Link>
              </td>
              <td>{t.category_name}</td>
              <td>{new Date(t.last_activity).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Ungelesene Threads</h2>
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
            <tr>
              <td colSpan={3}>Keine ungelesenen Threads</td>
            </tr>
          )}
          {unreadThreads.map((t) => (
            <tr key={t.id}>
              <td>
                <Link href={`/forum/thread/${t.id}`}>{t.title}</Link>
              </td>
              <td>{t.category_name}</td>
              <td>{new Date(t.last_activity).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
        }
        .forum-table th {
          background: #f9fafb;
        }
        .forum-table tr:nth-child(even) {
          background: #fafafa;
        }
      `}</style>
    </div>
  );
}
