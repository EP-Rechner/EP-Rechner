// pages/verpaarungen.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Link from "next/link";

export default function Verpaarungen() {
  const [verpaarungen, setVerpaarungen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [selectedIds, setSelectedIds] = useState(new Set());

  // Toast für Feedback
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Daten laden
  const loadVerpaarungen = async () => {
    try {
      setLoading(true);
      setErr(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      const { data, error } = await supabase
        .from("Verpaarungen")
        .select(
          `
          id, created_at, user_id,
          hengst_id, stute_id,
          Hengste (id, Name),
          Stuten (id, Name)
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false, nullsLast: true })
        .order("id", { ascending: false })                   // stabile Zweitsortierung
        .range(0, 9999);                                     // falls ihr >1000 Zeilen habt

      if (error) throw error;

      setVerpaarungen(data || []);
      setSelectedIds(new Set());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVerpaarungen();
  }, []);

  // Auswahl toggeln
  const toggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = () =>
    verpaarungen.length > 0 && verpaarungen.every((v) => selectedIds.has(v.id));

  const toggleSelectAll = () => {
    if (isAllSelected()) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(verpaarungen.map((v) => v.id)));
    }
  };

  // Löschen
  const handleDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!window.confirm(`Wirklich ${selectedIds.size} Verpaarung(en) löschen?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("Verpaarungen")
        .delete()
        .in("id", Array.from(selectedIds));

      if (error) throw error;

      setToast("✅ Verpaarungen gelöscht.");
      await loadVerpaarungen();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="page">
      <header className="site-bar top">
        <h1>Gespeicherte Verpaarungen</h1>
      </header>

      {toast && <div className="toast success">{toast}</div>}
      {err && <p className="err">{err}</p>}
      {loading && <p>Lade…</p>}

      {!loading && verpaarungen.length === 0 && (
        <p style={{ padding: "12px 16px" }}>Keine gespeicherten Verpaarungen.</p>
      )}

      {!loading && verpaarungen.length > 0 && (
        <>
          <div className="table-actions">
            <button
              className={
                selectedIds.size === 0 ? "btn danger disabled" : "btn danger"
              }
              onClick={handleDelete}
              disabled={selectedIds.size === 0}
            >
              Ausgewählte löschen
            </button>
          </div>

          <div className="table-hscroll">
            <table className="styled-table">
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected()}
                      onChange={toggleSelectAll}
                      aria-label="Alle auswählen"
                    />
                  </th>
                  <th>Details</th>
                  <th>Stute</th>
                  <th>Hengst</th>
                  <th>Gespeichert am</th>
                </tr>
              </thead>
              <tbody>
                {verpaarungen.map((v) => {
                  const checked = selectedIds.has(v.id);
                  return (
                    <tr key={v.id}>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRow(v.id)}
                          aria-label={`Verpaarung ${v.id} auswählen`}
                        />
                      </td>
                      <td>
                        <Link href={`/verpaarungen/${v.id}`}>
                          Mögliches Fohlen anzeigen
                        </Link>
                      </td>
                      <td>
                        {v.Stuten ? (
                          <Link
                            href={{
                              pathname: `/pferd/${v.Stuten.id}`,
                              query: { table: "Stuten" },
                            }}
                          >
                            {v.Stuten.Name || "(ohne Name)"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {v.Hengste ? (
                          <Link
                            href={{
                              pathname: `/pferd/${v.Hengste.id}`,
                              query: { table: "Hengste" },
                            }}
                          >
                            {v.Hengste.Name || "(ohne Name)"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {new Date(v.created_at).toLocaleString("de-DE", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <footer className="site-bar bottom">
        © 2025 Equinepassion Rechner
      </footer>

      <style jsx>{`
        .page {
          font-size: 13px;
          color: #222;
        }
        .site-bar {
          background: #f6f7fb;
          border-bottom: 1px solid #e3e6ef;
          padding: 14px 16px;
        }
        .site-bar.bottom {
          margin-top: 24px;
          border-top: 1px solid #e3e6ef;
          text-align: center;
        }
        .toast {
          margin: 8px 16px;
          padding: 8px 12px;
          border-radius: 6px;
        }
        .toast.success {
          background: #e8f7ee;
          color: #0a7a2a;
          border: 1px solid #bfe7cf;
        }
        .err {
          color: #c00;
          padding: 12px 16px;
        }
        .table-actions {
          padding: 8px 16px;
        }
        .btn {
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #fff;
          cursor: pointer;
        }
        .btn.danger {
          background: #ef4444;
          color: #fff;
          border-color: #ef4444;
        }
        .btn.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .table-hscroll {
          overflow-x: auto;
          padding: 0 16px;
        }
        .styled-table {
          border-collapse: collapse;
          background: #fff;
          font-size: 13px;
          width: 100%;
          table-layout: auto; /* Automatische Spaltenbreite */
        }
        .styled-table th,
        .styled-table td {
          border: 1px solid #e5e7eb;
          padding: 6px 8px;
          white-space: nowrap; /* Kein Zeilenumbruch */
          text-align: left;
        }
        .styled-table thead {
          background: #f3f4f6;
        }
      `}</style>
    </div>
  );
}
