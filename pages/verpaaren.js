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

  // Spalten-Prefs (Verpaaren Ergebnis-Tabelle)
  const DEFAULT_COL_PREFS = { visible: null, order: null };

  const [colPrefs, setColPrefs] = useState(DEFAULT_COL_PREFS);

  // Spalten-Modal
  const [colModalOpen, setColModalOpen] = useState(false);
  const [colDraft, setColDraft] = useState({ visible: [], order: [] });

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
          { data: prefsRows,   error: pErr },
        ] = await Promise.all([
          supabase.from("Stuten").select("*").eq("user_id", user.id),
          supabase.from("Hengste").select("*").eq("user_id", user.id),
          supabase.from("gruppen").select("*").eq("user_id", user.id),
          supabase.from("pferde_gruppen").select("*").eq("user_id", user.id),

          // ✅ NEU
          supabase
            .from("user_table_prefs")
            .select("pref")
            .eq("user_id", user.id)
            .eq("table_name", "Verpaaren")
            .eq("pref_key", "columns")
            .maybeSingle(),
        ]);
        if (sErr) throw sErr; if (hErr) throw hErr; if (gErr) throw gErr; if (lErr) throw lErr;if (pErr) throw pErr;

          if (prefsRows?.pref) {
            setColPrefs(prefsRows.pref);
          }
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

    useEffect(() => {
    // nur noch Hengste selektiert lassen, die im aktuellen Filter sichtbar sind
    const allowed = new Set(visibleHengste.map(h => h.id));
    setSelectedHengstIds(prev => {
      const next = new Set([...prev].filter(id => allowed.has(id)));
      return next;
    });

    // Ergebnisse zurücksetzen, weil sich die Basis geändert hat
    setRows([]);
    setHiddenRowKeys(new Set());
    setCheckedRowKeys(new Set());
  }, [hengsteGroupFilter, visibleHengste]);


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

    const applyColumnPrefs = (allCols, prefs) => {
    const visibleSet = new Set(prefs?.visible ?? allCols);

    const ordered = prefs?.order
      ? [
          ...prefs.order.filter((c) => allCols.includes(c)),
          ...allCols.filter((c) => !prefs.order.includes(c)),
        ]
      : allCols;

    const filtered = ordered.filter((c) => visibleSet.has(c));
if (!filtered.includes("Hengstname")) filtered.unshift("Hengstname");
return filtered;
  };

  const openColModal = (baseCols) => {
    const pref = colPrefs || DEFAULT_COL_PREFS;

    const visible = pref.visible ?? baseCols;
    const order = pref.order ?? baseCols;

    const orderFixed = [
      ...order.filter((c) => baseCols.includes(c)),
      ...baseCols.filter((c) => !order.includes(c)),
    ];

    setColDraft({ visible: [...visible], order: [...orderFixed] });
    setColModalOpen(true);
  };

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

  const visibleColumns = applyColumnPrefs(allColumns, colPrefs);

    const saveColumnPrefs = async (pref) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("user_table_prefs").upsert(
      {
        user_id: user.id,
        table_name: "Verpaaren",
        pref_key: "columns",
        pref,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,table_name,pref_key" }
    );

    if (error) {
      setErr("Fehler beim Speichern der Spalten.");
      return;
    }

    setColPrefs(pref);
    showToast("Spalten gespeichert");
  };

  // Ergebnisse bauen
  const buildRows = () => {
    if (!selectedStuteId || selectedHengstIds.size === 0) {
      setRows([]); setHiddenRowKeys(new Set()); setCheckedRowKeys(new Set()); return;
    }
    const stute = (stuten || []).find((s) => s.id === selectedStuteId);
    if (!stute) return setRows([]);
      const selectedH = (hengste || []).filter(
    (h) => selectedHengstIds.has(h.id) && isInGroup("Hengste", h.id, hengsteGroupFilter)
  );

      const newRows = selectedH.map((h) => computeFoalRow(stute, h));
      setRows(newRows);
      setHiddenRowKeys(new Set());
      setCheckedRowKeys(new Set());
    };

    // ---- HELFER: Formatierung für DB ----
  const asText = (v) => {
    if (v == null) return null;
    if (typeof v === "number") return v.toFixed(2);   // konsistente Darstellung
    return String(v);                                  // z.B. "4,5 / 8,9"
  };
  const asJsonb = (v) => {
    if (v == null) return null;
    if (typeof v === "object" && "text" in v) return v; // {text, style}
    return { text: String(v) };
  };

  // ---- MAPPING: FoalRow -> DB-Spalten ----
  const mapFoalRowToDbColumns = (r) => ({
    // Basis
    groesse: asText(r["Größe"]),
    hauptdisziplin: asText(r["Hauptdisziplin"]),
    fk_gesamt: asText(r["FK Gesamt"]),

    // Disziplin 1
    disziplin_1: asText(r["Disziplin 1"]),
    fk_1: asText(r["FK 1"]),
    fk_1_1: asText(r["FK 1.1"]),
    fk_1_2: asText(r["FK 1.2"]),
    fk_1_3: asText(r["FK 1.3"]),
    fk_1_4: asText(r["FK 1.4"]),
    fk_1_5: asText(r["FK 1.5"]),

    // Disziplin 2
    disziplin_2: asText(r["Disziplin 2"]),
    fk_2: asText(r["FK 2"]),
    fk_2_1: asText(r["FK 2.1"]),
    fk_2_2: asText(r["FK 2.2"]),
    fk_2_3: asText(r["FK 2.3"]),
    fk_2_4: asText(r["FK 2.4"]),
    fk_2_5: asText(r["FK 2.5"]),

    // Disziplin 3
    disziplin_3: asText(r["Disziplin 3"]),
    fk_3: asText(r["FK 3"]),
    fk_3_1: asText(r["FK 3.1"]),
    fk_3_2: asText(r["FK 3.2"]),
    fk_3_3: asText(r["FK 3.3"]),
    fk_3_4: asText(r["FK 3.4"]),
    fk_3_5: asText(r["FK 3.5"]),

    // Charakter
    temperament: asText(r["Temperament"]),
    ausstrahlung: asText(r["Ausstrahlung"]),
    aufmerksamkeit: asText(r["Aufmerksamkeit"]),
    ausgeglichenheit: asText(r["Ausgeglichenheit"]),
    haendelbarkeit: asText(r["Händelbarkeit"]),
    nervenstaerke: asText(r["Nervenstärke"]),
    intelligenz: asText(r["Intelligenz"]),

    // Exterieur – Körper
    kopf: asText(r["Kopf"]),
    halsansatz: asText(r["Halsansatz"]),
    hals: asText(r["Hals"]),
    ruecken: asText(r["Rücken"]),

    // Beine
    vorderbeine_stand: asText(r["Vorderbeine Stand"]),
    vorderbeine_boden: asText(r["Vorderbeine Boden"]),
    vorderbeine_zehen: asText(r["Vorderbeine Zehen"]),
    hinterbeine_stand: asText(r["Hinterbeine Stand"]),
    hinterbeine_boden: asText(r["Hinterbeine Boden"]),
    hinterbeine_zehen: asText(r["Hinterbeine Zehen"]),

    // Gesamtnoten
    interieur: asText(r["Interieur"]),
    exterieur: asText(r["Exterieur"]),

    // Prüfungen (mit Style)
    inzuchtpruefung: asJsonb(r["Inzuchtprüfung"]),
    groessencheck: asJsonb(r["Größencheck"]),

    // Genetik
    extension: asText(r["Extension"]),
    agouti: asText(r["Agouti"]),
    cream_pearl: asText(r["Cream/Pearl"]),
    dun: asText(r["Dun"]),
    champagne: asText(r["Champagne"]),
    mushroom: asText(r["Mushroom"]),
    silver: asText(r["Silver"]),
    graying: asText(r["Graying"]),
    kit: asText(r["Kit"]),
    overo: asText(r["Overo"]),
    leopard: asText(r["Leopard"]),
    patn1: asText(r["Patn1"]),
    patn2: asText(r["Patn2"]),
    splashed_white: asText(r["Splashed White"]),
    flaxen: asText(r["Flaxen"]),
    sooty: asText(r["Sooty"]),
    rabicano: asText(r["Rabicano"]),
    pangare: asText(r["Pangare"]),
    dapples: asText(r["Dapples"]),
    rotfaktor: asText(r["Rotfaktor"]),

    // Veranstaltungen / Papiere
    papiere: asText(r["Papiere"]),
    zuchtschau: asText(r["Zuchtschau"]),
    papiere_und_zuchtschau: asText(r["Papiere & Zuchtschau"]),
  });


  // Speichern
  const saveSelectedPairs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      const toSave = rows.filter((r) => checkedRowKeys.has(r.key));
      if (toSave.length === 0) return;

      // Stuten-Snapshot aus der aktuellen Auswahl
      const mare = (stuten || []).find((s) => s.id === selectedStuteId);
      const mareName = mare?.Name ?? null;

      // Für Hengst-Namen zusätzlich aus State mappen (falls computeFoalRow mal nichts gesetzt hat)
      const hengstMap = new Map((hengste || []).map((h) => [h.id, h]));

      const payload = toSave.map((r) => {
        const h = hengstMap.get(r.hengst_id);
        const base = {
          user_id: user.id,
          stute_id: r.stute_id,
          hengst_id: r.hengst_id,
          stute_name: mareName ?? r.stute_name ?? null,
          hengst_name: r.hengst_name ?? h?.Name ?? null,
        };
        const details = mapFoalRowToDbColumns(r);
        return { ...base, ...details };
      });

      const { error } = await supabase
        .from("Verpaarungen")
        .upsert(payload, { onConflict: "user_id,hengst_id,stute_id" });

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
                <button
                  className="btn"
                  onClick={() => openColModal(allColumns)}
                >
                  Spalten
                </button>
              </div>

              <div className="table-hscroll">
                <table className="styled-table">
                  <thead>
                    <tr>
                      <th style={{width: 42}} title="Für Speichern auswählen">✓</th>
                      <th style={{width: 80}}>Sichtbar</th>
                      <th>Hengstname</th>
                        {visibleColumns
                          .filter(c => c !== "Hengstname")
                          .map((c)=>(
                            <th key={c}>{c}</th>
                        ))}
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
                              onChange={(e) => {
                                setCheckedRowKeys((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(r.key);
                                  else next.delete(r.key);
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
                          {visibleColumns
                            .filter(c => c !== "Hengstname")
                            .map((col)=>(
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

      {/* Modal: Spalten ein-/ausblenden + Reihenfolge */}
  {colModalOpen && (
    <div className="modal-backdrop" onClick={() => setColModalOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Spalten anpassen</h3>
        <p style={{ marginTop: -6, color: "#666" }}>
          Häkchen = sichtbar. Pfeile = Reihenfolge.
        </p>

        <div className="col-list">
          {colDraft.order.map((col, idx) => {
            const checked = colDraft.visible.includes(col);

            return (
              <div
                key={col}
                className="col-item"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setColDraft((d) => {
                      const vis = new Set(d.visible);
                      if (e.target.checked) vis.add(col);
                      else vis.delete(col);
                      return { ...d, visible: Array.from(vis) };
                    });
                  }}
                />

                <span className="col-name">{col}</span>

                <button
                  className="btn small"
                  disabled={idx === 0}
                  onClick={() => {
                    setColDraft((d) => {
                      const arr = [...d.order];
                      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                      return { ...d, order: arr };
                    });
                  }}
                  title="Nach oben"
                >
                  ↑
                </button>

                <button
                  className="btn small"
                  disabled={idx === colDraft.order.length - 1}
                  onClick={() => {
                    setColDraft((d) => {
                      const arr = [...d.order];
                      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                      return { ...d, order: arr };
                    });
                  }}
                  title="Nach unten"
                >
                  ↓
                </button>
              </div>
            );
          })}
        </div>

        <div className="modal-actions sticky-actions">
          <button className="btn" onClick={() => setColModalOpen(false)}>
            Abbrechen
          </button>

          <button
            className="btn danger"
            onClick={() => {
              const base = colDraft.order;
              setColDraft({ visible: [...base], order: [...base] });
            }}
            title="Alle Spalten wieder einblenden"
          >
            Reset
          </button>

          <button
            className="btn primary"
            onClick={async () => {
              await saveColumnPrefs(colDraft);
              setColModalOpen(false);
            }}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
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
        .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .modal {
    background: #fff;
    width: 680px;
    max-width: calc(100% - 32px);
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.25);
    padding: 18px;

    max-height: calc(100vh - 80px);
    overflow-y: auto;
  }

  .col-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 10px 0 6px;
  }

  .col-item {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .col-name {
    flex: 1;
  }

  .sticky-actions {
    position: sticky;
    bottom: 0;
    background: #fff;
    padding-top: 10px;
    margin-top: 12px;
    border-top: 1px solid #e5e7eb;
    z-index: 5;
  }

  .btn.danger {
    background: #ef4444;
    color: #fff;
    border-color: #ef4444;
  }
  .btn.danger:hover {
    background: #dc2626;
    border-color: #dc2626;
  }
      `}</style>
    </div>
  );
}
