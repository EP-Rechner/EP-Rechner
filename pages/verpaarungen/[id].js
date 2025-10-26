// pages/verpaarungen/[id].js
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { computeFoalRow } from "../../lib/utils.mjs";

export default function VerpaarungDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [stutenname, setStutenname] = useState("");
  const [hengstname, setHengstname] = useState("");

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  const allColumns = useMemo(() => [
    "Stutenname","Hengstname","Größe","Hauptdisziplin","FK Gesamt",
    "Disziplin 1","FK 1","FK 1.1","FK 1.2","FK 1.3","FK 1.4","FK 1.5",
    "Disziplin 2","FK 2","FK 2.1","FK 2.2","FK 2.3","FK 2.4","FK 2.5",
    "Disziplin 3","FK 3","FK 3.1","FK 3.2","FK 3.3","FK 3.4","FK 3.5",
    "Temperament","Ausstrahlung","Aufmerksamkeit","Ausgeglichenheit","Händelbarkeit","Nervenstärke","Intelligenz",
    "Kopf","Halsansatz","Hals","Rücken",
    "Vorderbeine Stand","Vorderbeine Boden","Vorderbeine Zehen",
    "Hinterbeine Stand","Hinterbeine Boden","Hinterbeine Zehen",
    "Interieur","Exterieur","Inzuchtprüfung","Größencheck",
    "Extension","Agouti","Cream/Pearl","Dun","Champagne","Mushroom","Silver","Graying","Kit","Overo","Leopard","Patn1","Patn2","Splashed White","Flaxen","Sooty","Rabicano","Pangare","Dapples","Rotfaktor",
    "Papiere","Zuchtschau","Papiere & Zuchtschau",
  ], []);

    // Laden
    useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        setLoading(true); setErr(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Nicht eingeloggt");

        // 1) Direkt aus Verpaarungen lesen (alle gespeicherten Felder)
        const { data: vp, error: vpErr } = await supabase
          .from("Verpaarungen")
          .select(`
            id, stute_id, hengst_id,
            stute_name, hengst_name,
            groesse, hauptdisziplin, fk_gesamt,
            disziplin_1, fk_1, fk_1_1, fk_1_2, fk_1_3, fk_1_4, fk_1_5,
            disziplin_2, fk_2, fk_2_1, fk_2_2, fk_2_3, fk_2_4, fk_2_5,
            disziplin_3, fk_3, fk_3_1, fk_3_2, fk_3_3, fk_3_4, fk_3_5,
            temperament, ausstrahlung, aufmerksamkeit, ausgeglichenheit,
            haendelbarkeit, nervenstaerke, intelligenz,
            kopf, halsansatz, hals, ruecken,
            vorderbeine_stand, vorderbeine_boden, vorderbeine_zehen,
            hinterbeine_stand, hinterbeine_boden, hinterbeine_zehen,
            interieur, exterieur,
            inzuchtpruefung, groessencheck,
            extension, agouti, cream_pearl, dun, champagne, mushroom,
            silver, graying, kit, overo, leopard, patn1, patn2,
            splashed_white, flaxen, sooty, rabicano, pangare, dapples, rotfaktor,
            papiere, zuchtschau, papiere_und_zuchtschau
          `)
          .eq("id", id)
          .single();

        if (vpErr) throw vpErr;

        // 2) DB -> UI-Row mappen (deutsche Spaltenüberschriften)
        const foal = {
          key: `vp_${vp.id}`,
          stute_id: vp.stute_id,
          hengst_id: vp.hengst_id,
          stute_name: vp.stute_name ?? "—",
          hengst_name: vp.hengst_name ?? "—",

          "Stutenname": vp.stute_name ?? "—",
          "Hengstname": vp.hengst_name ?? "—",
          "Größe": vp.groesse ?? "—",
          "Hauptdisziplin": vp.hauptdisziplin ?? "—",
          "FK Gesamt": vp.fk_gesamt ?? "—",

          "Disziplin 1": vp.disziplin_1 ?? "—",
          "FK 1": vp.fk_1 ?? "—",
          "FK 1.1": vp.fk_1_1 ?? "—",
          "FK 1.2": vp.fk_1_2 ?? "—",
          "FK 1.3": vp.fk_1_3 ?? "—",
          "FK 1.4": vp.fk_1_4 ?? "—",
          "FK 1.5": vp.fk_1_5 ?? "—",

          "Disziplin 2": vp.disziplin_2 ?? "—",
          "FK 2": vp.fk_2 ?? "—",
          "FK 2.1": vp.fk_2_1 ?? "—",
          "FK 2.2": vp.fk_2_2 ?? "—",
          "FK 2.3": vp.fk_2_3 ?? "—",
          "FK 2.4": vp.fk_2_4 ?? "—",
          "FK 2.5": vp.fk_2_5 ?? "—",

          "Disziplin 3": vp.disziplin_3 ?? "—",
          "FK 3": vp.fk_3 ?? "—",
          "FK 3.1": vp.fk_3_1 ?? "—",
          "FK 3.2": vp.fk_3_2 ?? "—",
          "FK 3.3": vp.fk_3_3 ?? "—",
          "FK 3.4": vp.fk_3_4 ?? "—",
          "FK 3.5": vp.fk_3_5 ?? "—",

          "Temperament": vp.temperament ?? "—",
          "Ausstrahlung": vp.ausstrahlung ?? "—",
          "Aufmerksamkeit": vp.aufmerksamkeit ?? "—",
          "Ausgeglichenheit": vp.ausgeglichenheit ?? "—",
          "Händelbarkeit": vp.haendelbarkeit ?? "—",
          "Nervenstärke": vp.nervenstaerke ?? "—",
          "Intelligenz": vp.intelligenz ?? "—",

          "Kopf": vp.kopf ?? "—",
          "Halsansatz": vp.halsansatz ?? "—",
          "Hals": vp.hals ?? "—",
          "Rücken": vp.ruecken ?? "—",

          "Vorderbeine Stand": vp.vorderbeine_stand ?? "—",
          "Vorderbeine Boden": vp.vorderbeine_boden ?? "—",
          "Vorderbeine Zehen": vp.vorderbeine_zehen ?? "—",

          "Hinterbeine Stand": vp.hinterbeine_stand ?? "—",
          "Hinterbeine Boden": vp.hinterbeine_boden ?? "—",
          "Hinterbeine Zehen": vp.hinterbeine_zehen ?? "—",

          "Interieur": vp.interieur ?? "—",
          "Exterieur": vp.exterieur ?? "—",

          // JSONB-Felder (bereits als {text, style} gespeichert): direkt durchreichen
          "Inzuchtprüfung": vp.inzuchtpruefung ?? null,
          "Größencheck": vp.groessencheck ?? null,

          "Extension": vp.extension ?? "—",
          "Agouti": vp.agouti ?? "—",
          "Cream/Pearl": vp.cream_pearl ?? "—",
          "Dun": vp.dun ?? "—",
          "Champagne": vp.champagne ?? "—",
          "Mushroom": vp.mushroom ?? "—",
          "Silver": vp.silver ?? "—",
          "Graying": vp.graying ?? "—",
          "Kit": vp.kit ?? "—",
          "Overo": vp.overo ?? "—",
          "Leopard": vp.leopard ?? "—",
          "Patn1": vp.patn1 ?? "—",
          "Patn2": vp.patn2 ?? "—",
          "Splashed White": vp.splashed_white ?? "—",
          "Flaxen": vp.flaxen ?? "—",
          "Sooty": vp.sooty ?? "—",
          "Rabicano": vp.rabicano ?? "—",
          "Pangare": vp.pangare ?? "—",
          "Dapples": vp.dapples ?? "—",
          "Rotfaktor": vp.rotfaktor ?? "—",

          "Papiere": vp.papiere ?? "—",
          "Zuchtschau": vp.zuchtschau ?? "—",
          "Papiere & Zuchtschau": vp.papiere_und_zuchtschau ?? "—",
        };

        setStutenname(foal["Stutenname"]);
        setHengstname(foal["Hengstname"]);
        setRows([foal]);
      } catch (e) {
        setErr(e.message); setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);


  // Löschen
  const handleDelete = async () => {
    if (!window.confirm("Diese Verpaarung wirklich löschen?")) return;
    try {
      const { error } = await supabase.from("Verpaarungen").delete().eq("id", id);
      if (error) throw error;
      showToast("✅ Verpaarung gelöscht");
      setTimeout(()=> router.push("/verpaarungen"), 1200);
    } catch (e) {
      setErr(e.message);
    }
  };

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

  if (loading) return <p>Lade…</p>;
  if (err) return <p style={{ color: "red" }}>{err}</p>;

  return (
    <div className="page">
      <h1>Mögliches Fohlen aus {stutenname} und {hengstname}</h1>

      {toast && <div className="toast success">{toast}</div>}

      <button className="btn danger" onClick={handleDelete}>Verpaarung löschen</button>

      {rows.length === 0 ? (
        <p>Keine Daten vorhanden.</p>
      ) : (
        <div className="table-hscroll">
          <table className="styled-table">
            <thead>
              <tr>
                {allColumns.map((c)=> (<th key={c}>{c}</th>))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r)=>(
                <tr key={r.key}>
                  {allColumns.map((c)=> (<td key={c}>{renderCell(r[c])}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .page { padding: 20px; font-size: 13px; }
        .btn { padding: 8px 12px; margin-bottom: 12px; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; }
        .btn.danger { background: #ef4444; border-color: #ef4444; color: #fff; }
        .toast { margin: 10px 0; padding: 8px 12px; border-radius: 6px; background: #e8f7ee; color: #0a7a2a; border: 1px solid #bfe7cf; }
        .table-hscroll { overflow-x: auto; }
        .styled-table { border-collapse: collapse; width: 100%; background: #fff; }
        .styled-table th, .styled-table td { border: 1px solid #ddd; padding: 6px 8px; white-space: nowrap; text-align: left; }
        .styled-table th { background: #f2f2f2; font-weight: 600; }
      `}</style>
    </div>
  );
}
