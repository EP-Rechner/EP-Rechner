// pages/pferd/[id].js
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function PferdDetail() {
  const router = useRouter();
  const { id, table } = router.query;

  const [pferd, setPferd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editierbare Felder (alle Spalten außer id und user_id)
  const [formValues, setFormValues] = useState({});

  // Gruppen
  const [gruppen, setGruppen] = useState([]);
  const [gruppenDesPferds, setGruppenDesPferds] = useState(new Set());

  // Toast
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  useEffect(() => {
    if (!id || !table) return;

    const loadHorseAndGroups = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Nicht eingeloggt");

        // Pferd laden
        const { data, error: fetchError } = await supabase
          .from(table)
          .select("*")
          .eq("id", id)
          .eq("user_id", user.id)
          .single();

        if (fetchError) throw fetchError;
        setPferd(data);

        const { id: _, user_id, ...rest } = data;
        setFormValues(rest);

        // Gruppen laden
        const [{ data: gruppenData, error: gErr }, { data: linksData, error: lErr }] =
          await Promise.all([
            supabase.from("gruppen").select("*").eq("user_id", user.id),
            supabase.from("pferde_gruppen").select("*").eq("user_id", user.id),
          ]);

        if (gErr) throw gErr;
        if (lErr) throw lErr;

        setGruppen(gruppenData || []);

        // Gruppen des aktuellen Pferds extrahieren
        const pferdGroups = new Set(
          (linksData || [])
            .filter((row) => row.pferd_id === id && row.pferd_table === table)
            .map((row) => row.gruppe_id)
        );
        setGruppenDesPferds(pferdGroups);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    loadHorseAndGroups();
  }, [id, table]);

  const handleChange = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      const { error: updError } = await supabase
        .from(table)
        .update(formValues)
        .eq("id", id);

      if (updError) throw updError;

      showToast("Änderungen gespeichert");
      router.push("/pferde");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = async (gruppeId, checked) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      if (checked) {
        // hinzufügen
        const { error: insErr } = await supabase
          .from("pferde_gruppen")
          .upsert(
            [
              {
                gruppe_id: gruppeId,
                pferd_id: id,
                pferd_table: table,
                user_id: user.id,
              },
            ],
            { onConflict: "gruppe_id,pferd_id,pferd_table" }
          );
        if (insErr) throw insErr;
        setGruppenDesPferds((prev) => new Set([...prev, gruppeId]));
      } else {
        // entfernen
        const { error: delErr } = await supabase
          .from("pferde_gruppen")
          .delete()
          .eq("gruppe_id", gruppeId)
          .eq("pferd_id", id)
          .eq("pferd_table", table)
          .eq("user_id", user.id);
        if (delErr) throw delErr;
        setGruppenDesPferds((prev) => {
          const copy = new Set(prev);
          copy.delete(gruppeId);
          return copy;
        });
      }
      showToast("Änderungen gespeichert");
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <p>Lade...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!pferd) return <p>Kein Pferd gefunden.</p>;

  return (
    <div className="page">
      {toastMsg && <div className="toast">{toastMsg}</div>}

      <h1>{formValues.Name || "Pferd bearbeiten"}</h1>
      <p>
        Tabelle: <b>{table}</b> | ID: {id}
      </p>

      <div className="form-grid">
        {Object.entries(formValues).map(([field, value]) => (
          <div key={field} className="form-row">
            <label>{field}</label>
            <input
              value={value ?? ""}
              onChange={(e) => handleChange(field, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="actions">
        <button onClick={() => router.push("/pferde")}>Abbrechen</button>
        <button className="primary" onClick={handleSave}>
          Speichern
        </button>
      </div>

      <h2 style={{ marginTop: "30px" }}>Gruppen</h2>
      <div className="group-list">
        {gruppen.length === 0 && <p>Keine Gruppen vorhanden.</p>}
        {gruppen.map((g) => (
          <label key={g.id} className="group-check">
            <input
              type="checkbox"
              checked={gruppenDesPferds.has(g.id)}
              onChange={(e) => toggleGroup(g.id, e.target.checked)}
            />
            {g.name}
          </label>
        ))}
      </div>

      <style jsx>{`
        .page {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
          font-size: 13px;
          position: relative;
        }
        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #22c55e;
          color: #fff;
          padding: 10px 16px;
          border-radius: 6px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 150px 1fr;
          gap: 10px;
          margin-top: 20px;
        }
        .form-row label {
          font-weight: 600;
          padding-top: 6px;
        }
        .form-row input {
          width: 100%;
          border: 1px solid #ccc;
          border-radius: 4px;
          padding: 6px 8px;
        }
        .actions {
          margin-top: 20px;
          display: flex;
          gap: 10px;
        }
        .actions button {
          padding: 8px 14px;
          border: 1px solid #ccc;
          border-radius: 6px;
          cursor: pointer;
          background: #fff;
        }
        .actions button.primary {
          background: #2563eb;
          border-color: #2563eb;
          color: #fff;
        }
        .group-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 8px 12px;
          margin-top: 10px;
        }
        .group-check {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      `}</style>
    </div>
  );
}
