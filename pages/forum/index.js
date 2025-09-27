// pages/forum/index.js
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function ForumHome() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErr(null);

        // Kategorien laden
const { data: cats, error: catErr } = await supabase
  .from("forum_categories")
  .select("id, name, slug, description")
  .order("position", { ascending: true });  // Reihenfolge fix

// Stats laden
const { data: stats, error: statErr } = await supabase
  .from("forum_category_stats")
  .select("*");

// Map für schnellen Zugriff
const statMap = new Map(stats?.map(s => [s.category_id, s]));

// Threads laden und zählen
const { data: threads, error: thErr } = await supabase
  .from("forum_threads")
  .select("id, category_id, created_at");
if (thErr) throw thErr;

const countMap = new Map();
threads.forEach(t => {
  countMap.set(t.category_id, (countMap.get(t.category_id) || 0) + 1);
});

// Kategorien + Stats + ThreadCount zusammenführen
const categoriesFinal = (cats || []).map(c => {
  const stats = statMap.get(c.id) || { thread_count: 0, last_post_at: null };
  return {
    ...c,
    stats: {
      ...stats,
      thread_count: countMap.get(c.id) || stats.thread_count || 0
    }
  };
});

setCategories(categoriesFinal);

      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Forum</h1>

      {err && <p style={{ color: "red" }}>{err}</p>}
      {loading && <p>Lade…</p>}

      {!loading && !err && (
        <table className="forum-table">
          <thead>
  <tr>
    <th style={{ width: "28%" }}>Kategorie</th>
    <th>Beschreibung</th>
    <th style={{ width: 120, textAlign: "right" }}>Threads</th>
    <th style={{ width: 180, textAlign: "right" }}>Letzter Beitrag</th>
  </tr>
</thead>
<tbody>
  {categories.length === 0 && (
    <tr>
      <td colSpan={4} style={{ textAlign: "center", color: "#666" }}>
        Keine Kategorien vorhanden.
      </td>
    </tr>
  )}
  {categories.map(cat => (
    <tr key={cat.id}>
      <td>
        <Link href={`/forum/${cat.slug}`}>{cat.name}</Link>
      </td>
      <td>{cat.description || "—"}</td>
      <td style={{ textAlign: "right" }}>
        {cat.stats?.thread_count || 0}
      </td>
      <td style={{ textAlign: "right" }}>
  {cat.stats?.last_post_at ? (
    <>
      {new Date(cat.stats.last_post_at).toLocaleString()}
      {" · von "}
      {cat.stats.last_post_role?.toLowerCase() === "admin" && (
        <span style={{ color: "red", fontWeight: "bold" }}>
          {cat.stats.last_post_user} (Admin)
        </span>
      )}
      {cat.stats.last_post_role?.toLowerCase() === "moderator" && (
        <span style={{ color: "green", fontWeight: "bold" }}>
          {cat.stats.last_post_user} (Moderator)
        </span>
      )}
      {!["admin", "moderator"].includes(
        (cat.stats.last_post_role || "").toLowerCase()
      ) && (
        <span style={{ color: "#1e2ba0ff", fontWeight: "bold" }}>
          {cat.stats.last_post_user || "Unbekannt"}
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
      )}

      <style jsx>{`
        .forum-table {
          width: 100%;
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
          white-space: normal;
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
