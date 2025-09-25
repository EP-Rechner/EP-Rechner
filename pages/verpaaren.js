// pages/verpaaren.js
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { buildGroupMap, computeFoalRow } from "../lib/utils.mjs";

// Fallback nur falls du pferde_gruppen noch nicht pflegst
const buildGroupMapLocal = buildGroupMap;

export default function Verpaaren() {
  const [stuten, setStuten] = useState([]);
  const [hengste, setHengste] = useState([]);
  const [gruppen, setGruppen] = useState([]);
  const [links, setLinks] = useState([]);
  const [groupMap, setGroupMap] = useState(new Map());

  const [stutenGroupFilter, setStutenGroupFilter] = useState("all");
  const [hengsteGroupFilter, setHengsteGroupFilter] = useState("all");
  const [selectedStuteId, setSelectedStuteId] = useState(null);
  const [selectedHengstIds, setSelectedHengstIds] = useState(new Set());

  const [rows, setRows] = useState([]);
  const [hiddenRowKeys, setHiddenRowKeys] = useState(new Set());
  const [checkedRowKeys, setCheckedRowKeys] = useState(new Set());

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  // Laden
  useEffect(() => {
    let alive = true;
    const loadAll = async () => {
      try {
        setLoading(true);
        setErr(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Nicht eingeloggt");

        const [
          { data: stutenData,  error: sErr },
          { data: hengsteData, error: hErr },
          { data: gruppenData, error: gErr },
          { data: linksData,   error: lErr },
        ] = await Promise.all([
          supabase.from("Stuten").select("*").eq("user_id", user.id),
          supabase.from("Hengste").select("*").eq("user_id", user.id),
          supabase.from("gruppen").select("*").eq("user_id", user.id),
          supabase.from("pferde_gruppen").select("*").eq("user_id", user.id),
        ]);
        if (sErr) throw sErr; if (hErr) throw hErr; if (gErr) throw gErr; if (lErr) throw lErr;
        if (!alive) return;

        setStuten(stutenData || []);
        setHengste(hengsteData || []);
        setGruppen(gruppenData || []);
        setLinks(linksData || []);
        setGroupMap(buildGroupMapLocal(linksData || []));
      } catch (e) {
        if (alive) setErr(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    };
    loadAll();
    return () => { alive = false; };
  }, []);

  // Filter
  const isInGroup = (table, id, wanted) => {
    if (wanted === "all") return true;
    const key = `${table}:${id}`;
    const set = groupMap.get(key);
    return set ? set.has(wanted) : false;
  };
  const visibleStuten = useMemo(
    () => (stuten || []).filter((s) => isInGroup("Stuten", s.id, stutenGroupFilter)),
    [stuten, stutenGroupFilter, groupMap]
  );
  const visibleHengste = useMemo(
    () => (hengste || []).filter((h) => isInGroup("Hengste", h.id, hengsteGroupFilter)),
    [hengste, hengsteGroupFilter, groupMap]
  );

  // Auswahl
  const toggleHengst = (id) => {
    setSelectedHengstIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  useEffect(() => {
    setHiddenRowKeys(new Set());
    setCheckedRowKeys(new Set());
    setRows([]);
  }, [selectedStuteId]);

  // Spalten
  const allColumns = useMemo(() => [
    "Hengstname",
    "Größe",
    "Hauptdisziplin",
    "FK Gesamt",
    "Disziplin 1","FK 1","FK 1.1","FK 1.2","FK 1.3","FK 1.4","FK 1.5",
    "Disziplin 2","FK 2","FK 2.1","FK 2.2","FK 2.3","FK 2.4","FK 2.5",
    "Disziplin 3","FK 3","FK 3.1","FK 3.2","FK 3.3","FK 3.4","FK 3.5",
    "Temperament","Ausstrahlung","Aufmerksamkeit","Ausgeglichenheit","Händelbarkeit","Nervenstärke","Intelligenz",
    "Kopf","Halsansatz","Hals","Rücken",
    "Vorderbeine Stand","Vorderbeine Boden","Vorderbeine Zehen",
    "Hinterbeine Stand","Hinterbeine Boden","Hinterbeine Zehen",
    "Interieur","Exterieur",
    "Inzuchtprüfung","Größencheck",
    "Extension","Agouti","Cream/Pearl","Dun","Champagne","Mushroom","Silver","Graying","Kit","Overo","Leopard","Patn1","Patn2","Splashed White","Flaxen","Sooty","Rabicano","Pangare","Dapples","Rotfaktor",
    "Papiere","Zuchtschau","Papiere & Zuchtschau",
  ], []);

  // Ergebnisse bauen
  const buildRows = () => {
    if (!selectedStuteId || selectedHengstIds.size === 0) {
      setRows([]); setHiddenRowKeys(new Set()); setCheckedRowKeys(new Set()); return;
    }
    const stute = (stuten || []).find((s) => s.id === selectedStuteId);
    if (!stute) return setRows([]);
    const selectedH = (hengste || []).filter((h) => selectedHengstIds.has(h.id));
    const newRows = selectedH.map((h) => computeFoalRow(stute, h));
    setRows(newRows);
    setHiddenRowKeys(new Set());
    setCheckedRowKeys(new Set());
  };

  // Speichern
  const saveSelectedPairs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");
      const toSave = rows.filter((r) => checkedRowKeys.has(r.key));
      if (toSave.length === 0) return;
      const payload = toSave.map((r) => ({
        user_id: user.id,
        hengst_id: r.hengst_id,
        stute_id: r.stute_id,
      }));
      const { error } = await supabase.from("Verpaarungen").upsert(payload, {
        onConflict: "user_id,hengst_id,stute_id",
      });
      if (error) throw error;
      showToast(`Gespeichert: ${toSave.length} Verpaarung(en).`);
    } catch (e) {
      setErr(e.message);
    }
  };

  // Renderer-Helfer (unterstützt {text,style:'red'})
  const renderCell = (val) => {
    if (val == null) return "—";
    if (typeof val === "object" && val.text) {
      const isRed = val.style === "red";
      return (
        <span style={isRed ? { background: "#fee2e2", color: "#991b1b", padding: "2px 6px", borderRadius: 4 } : {}}>
          {val.text}
        </span>
      );
    }
    if (typeof val === "number") return val.toFixed(2);
    return val;
  };

  // UI
  return (
    <div className="page">
      <header className="site-bar top">
        <h1>Verpaarungen – Vergleich</h1>
      </header>

      {toast && <div className="toast success">{toast}</div>}
      {err && <p className="err">{err}</p>}

      {loading ? (
        <p>Lade…</p>
      ) : (
        <>
          <section className="filters">
            <div className="filter-col">
              <h3>Stute wählen</h3>
              <div className="row">
                <label>Stuten-Gruppe</label>
                <select value={stutenGroupFilter} onChange={(e)=>setStutenGroupFilter(e.target.value)}>
                  <option value="all">Alle Stuten</option>
                  {gruppen.map((g)=> (<option key={g.id} value={g.id}>{g.name}</option>))}
                </select>
              </div>
              <div className="list">
                {visibleStuten.length === 0 && <p>Keine Stuten gefunden.</p>}
                {visibleStuten.map((s)=>(
                  <label key={s.id} className="radio-item">
                    <input type="radio" name="stute" checked={selectedStuteId === s.id} onChange={()=>setSelectedStuteId(s.id)} />
                    <span>{s.Name || "(ohne Name)"} </span>
                    <Link href={{ pathname: `/pferd/${s.id}`, query: { table: "Stuten" } }} className="small-link">Details</Link>
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-col">
              <h3>Hengste wählen</h3>
              <div className="row">
                <label>Hengste-Gruppe</label>
                <select value={hengsteGroupFilter} onChange={(e)=>setHengsteGroupFilter(e.target.value)}>
                  <option value="all">Alle Hengste</option>
                  {gruppen.map((g)=> (<option key={g.id} value={g.id}>{g.name}</option>))}
                </select>
              </div>
              <div className="list">
                {visibleHengste.length === 0 && <p>Keine Hengste gefunden.</p>}
                {visibleHengste.map((h)=>(
                  <label key={h.id} className="check-item">
                    <input type="checkbox" checked={selectedHengstIds.has(h.id)} onChange={()=>toggleHengst(h.id)} />
                    <span>{h.Name || "(ohne Name)"} </span>
                    <Link href={{ pathname: `/pferd/${h.id}`, query: { table: "Hengste" } }} className="small-link">Details</Link>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <div className="actions">
            <button className="btn primary" onClick={buildRows} disabled={!selectedStuteId || selectedHengstIds.size === 0}>
              Kombinationen anzeigen
            </button>
            <button
              className="btn"
              onClick={()=>{
                setSelectedStuteId(null);
                setSelectedHengstIds(new Set());
                setRows([]); setHiddenRowKeys(new Set()); setCheckedRowKeys(new Set());
              }}
            >
              Auswahl zurücksetzen
            </button>
          </div>

          {selectedStuteId && rows.length > 0 && (
            <section className="result">
              <h2>
                Mögliche Fohlen – Stute:{" "}
                <em>{(stuten.find((s)=>s.id===selectedStuteId)?.Name) || "Unbekannt"}</em>
              </h2>

              <div className="table-actions">
                <button className="btn" onClick={()=>setHiddenRowKeys(new Set())}>Alle einblenden</button>
                <button className="btn" onClick={()=>setCheckedRowKeys(new Set())}>Auswahl (Speichern) zurücksetzen</button>
                <button className="btn success" onClick={saveSelectedPairs} disabled={checkedRowKeys.size===0}>
                  Markierte Verpaarungen speichern
                </button>
              </div>

              <div className="table-hscroll">
                <table className="styled-table">
                  <thead>
                    <tr>
                      <th style={{width: 42}} title="Für Speichern auswählen">✓</th>
                      <th style={{width: 80}}>Sichtbar</th>
                      <th>Hengstname</th>
                      {allColumns.filter(c=>c!=="Hengstname").map((c)=>(<th key={c}>{c}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r)=> {
                      if (hiddenRowKeys.has(r.key)) return null;
                      const checked = checkedRowKeys.has(r.key);
                      return (
                        <tr key={r.key}>
                          <td style={{textAlign:"center"}}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e)=>{
                                setCheckedRowKeys(prev=>{
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(r.key); else next.delete(r.key);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td>
                            <button className="btn small" onClick={()=>{
                              setHiddenRowKeys(prev=>{ const next = new Set(prev); next.add(r.key); return next; });
                            }}>Ausblenden</button>
                          </td>
                          <td>
                            <div className="name-cell">
                              <strong>{r.hengst_name}</strong>{" "}
                              <Link href={{ pathname: `/pferd/${r.hengst_id}`, query: { table: "Hengste" } }} className="small-link">öffnen</Link>
                            </div>
                          </td>
                          {allColumns.filter(c=>c!=="Hengstname").map((col)=>(
                            <td key={col}>{renderCell(r[col])}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <style jsx>{`
        .page { padding: 0; font-size: 13px; color: #222; }
        .site-bar { background: #f6f7fb; border-bottom: 1px solid #e3e6ef; padding: 14px 16px; }
        .site-bar h1 { margin: 0; font-size: 16px; font-weight: 700; }
        .err { color: #c00; padding: 12px 16px; }
        .toast { position: sticky; top: 0; margin: 8px 16px; padding: 10px 12px; border-radius: 6px; }
        .toast.success { background: #e8f7ee; color: #0a7a2a; border: 1px solid #bfe7cf; }

        .filters { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 12px 16px; }
        .filter-col { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; background: #fff; }
        .filter-col h3 { margin: 0 0 8px 0; font-size: 14px; }
        .row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        .row select { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
        .list { max-height: 280px; overflow: auto; border-top: 1px dashed #eee; padding-top: 8px; }
        .radio-item, .check-item { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
        .small-link { font-size: 12px; color: #2563eb; text-decoration: underline; }
        .actions { display: flex; gap: 10px; padding: 0 16px 8px; }
        .btn { padding: 8px 12px; border: 1px solid #cbd5e1; background: #fff; border-radius: 6px; cursor: pointer; }
        .btn.small { padding: 4px 8px; font-size: 12px; }
        .btn.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
        .btn.success { background: #16a34a; color: #fff; border-color: #16a34a; }
        .table-hscroll { overflow: auto; padding: 0 16px 16px; }
        .styled-table { border-collapse: separate; border-spacing: 0; background: #fff; font-size: 12px; width: 100%; }
        .styled-table th, .styled-table td { border: 1px solid #e5e7eb; padding: 6px 8px; white-space: nowrap; text-align: left; }
        .result h2 { padding: 0 16px; font-size: 14px; }
        .table-actions { display: flex; gap: 8px; padding: 4px 16px 8px; }
        .name-cell { display: flex; gap: 8px; align-items: baseline; }
      `}</style>
    </div>
  );
}
