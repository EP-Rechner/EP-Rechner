// pages/pferde.js
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { buildGroupMap } from "../lib/utils.mjs";

export default function Pferde() {
  const [hengste, setHengste] = useState([]);
  const [stuten, setStuten] = useState([]);

  // Gruppen
  const [gruppen, setGruppen] = useState([]);                  // [{id,name,user_id,...}]
  const [selectedGroup, setSelectedGroup] = useState("all");   // "all" | gruppe_id (uuid)
  const [newGroupName, setNewGroupName] = useState("");

  // Zuordnungen pferd<->gruppe (aus "pferde_gruppen")
  const [groupLinks, setGroupLinks] = useState([]);            // raw rows
  const [groupMap, setGroupMap] = useState(new Map());         // key `${table}:${id}` -> Set(gruppe_id)

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ NEU: Status-Toast (grüne Box oben, auto-hide)
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("success"); // "success" | "error"
  const showStatus = (msg, type = "success") => {
    setStatusMessage(msg);
    setStatusType(type);
    // nach 3s wieder ausblenden
    window.clearTimeout((showStatus)._t);
    (showStatus)._t = window.setTimeout(() => setStatusMessage(""), 3000);
  };

  // Auswahlzustand
  const [selectedHengste, setSelectedHengste] = useState(new Set());
  const [selectedStuten, setSelectedStuten] = useState(new Set());

  // Modal zum Sammel-Bearbeiten
  const [editOpen, setEditOpen] = useState(false);
  const [editTable, setEditTable] = useState(null); // "Hengste" | "Stuten"
  const [editValues, setEditValues] = useState({
    Notizen: "",
    Zucht: "",
    Zuchtziel: "",
    hengstOrt: "", // für Hengste => DB-Spalte 'ZG/HS/Eigener'
    Deckbereit: "",
  });

  // Pagination (NEU)
  const [pageSize, setPageSize] = useState(25);       // gilt für beide Tabellen
  const [pageHengste, setPageHengste] = useState(1);  // Seite für Hengste
  const [pageStuten, setPageStuten] = useState(1);    // Seite für Stuten


  // ---- Gruppen-Modal (Mehrfachauswahl von Gruppen) ----
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalTable, setGroupModalTable] = useState(null); // "Hengste" | "Stuten"
  const [groupModalIds, setGroupModalIds] = useState([]);       // ausgewählte Pferde-IDs
  const [groupSelections, setGroupSelections] = useState(new Set()); // ausgewählte Gruppen-IDs

    // Toast-Nachrichten
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000); // 3s automatisch ausblenden
  };


  // Reload-Loop-Schutz
  const isMountedRef = useRef(true);
  const loadingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    const loadData = async (user) => {
      if (!isMountedRef.current || loadingRef.current) return;
      loadingRef.current = true;
      try {
        setLoading(true);
        setError(null);

        if (!user) {
          setError("Nicht eingeloggt");
          setHengste([]);
          setStuten([]);
          setGruppen([]);
          setGroupLinks([]);
          setGroupMap(new Map());
          setPageHengste(1);
          setPageStuten(1);
          return;
        }

        const [
          { data: hengsteData, error: hError },
          { data: stutenData, error: sError },
          { data: gruppenData, error: gError },
          { data: linksData,   error: lError }
        ] = await Promise.all([
          supabase.from("Hengste").select("*").eq("user_id", user.id),
          supabase.from("Stuten").select("*").eq("user_id", user.id),
          supabase.from("gruppen").select("*").eq("user_id", user.id),
          supabase.from("pferde_gruppen").select("*").eq("user_id", user.id), // Join-Tabelle
        ]);

        if (hError) throw hError;
        if (sError) throw sError;
        if (gError) throw gError;
        if (lError) throw lError;

        if (!isMountedRef.current) return;

        setHengste(hengsteData || []);
        setStuten(stutenData || []);
        setGruppen(gruppenData || []);
        setGroupLinks(linksData || []);
        setGroupMap(buildGroupMap(linksData || []));

        // Auswahl zurücksetzen, falls Datensätze sich geändert haben
        setSelectedHengste(new Set());
        setSelectedStuten(new Set());
      } catch (e) {
        if (isMountedRef.current) setError(e.message);
      } finally {
        if (isMountedRef.current) setLoading(false);
        loadingRef.current = false;
      }
    };

    // initial laden
    supabase.auth.getUser().then(({ data: { user } }) => loadData(user));

    // nur auf sign-in / sign-out hören (kein USER_UPDATED mehr!)
const { subscription } = supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
    loadData(session?.user || null);
  }
});


    return () => {
      isMountedRef.current = false;
      subscription?.unsubscribe();
    };
  }, []);

  // ---------- Gruppen ----------
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      const { error: gError } = await supabase
        .from("gruppen")
        .insert({ name: newGroupName.trim(), user_id: user.id });
      if (gError) throw gError;

      setNewGroupName("");

      // Gruppen neu laden
      const { data: gruppenData, error: g2Err } = await supabase
        .from("gruppen")
        .select("*")
        .eq("user_id", user.id);
      if (g2Err) throw g2Err;
      setGruppen(gruppenData || []);

      // (Optional) Erfolg anzeigen
      showStatus("✅ Gruppe erstellt!");
    } catch (e) {
      setError(e.message);
      showStatus("Fehler beim Erstellen der Gruppe.", "error");
    }
  };

  const handleRenameGroup = async (gruppeId) => {
    const group = gruppen.find((g) => g.id === gruppeId);
    if (!group) return;

    const newName = prompt("Neuer Name für die Gruppe:", group.name);
    if (!newName || newName.trim() === "") return;

    try {
      const { error: updErr } = await supabase
        .from("gruppen")
        .update({ name: newName.trim() })
        .eq("id", gruppeId);

      if (updErr) throw updErr;

      // Gruppen neu laden
      const { data: gruppenData, error: gErr } = await supabase
        .from("gruppen")
        .select("*")
        .eq("user_id", group.user_id);
      if (gErr) throw gErr;

      setGruppen(gruppenData || []);
      showToast("Gruppe umbenannt");
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteGroup = async (gruppeId) => {
    const group = gruppen.find((g) => g.id === gruppeId);
    if (!group) return;

    if (!window.confirm(`Ausgewählte Gruppe "${group.name}" wirklich löschen?\n\nDie Zuordnungen der Pferde zu dieser Gruppe werden ebenfalls entfernt, andere Gruppen bleiben unberührt.`)) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      // Zuordnungen löschen (nur für diese Gruppe)
      await supabase
        .from("pferde_gruppen")
        .delete()
        .eq("gruppe_id", gruppeId)
        .eq("user_id", user.id);

      // Gruppe löschen
      const { error: delErr } = await supabase
        .from("gruppen")
        .delete()
        .eq("id", gruppeId)
        .eq("user_id", user.id);
      if (delErr) throw delErr;

      // Neu laden
      const [{ data: gruppenData }, { data: linksData }] = await Promise.all([
        supabase.from("gruppen").select("*").eq("user_id", user.id),
        supabase.from("pferde_gruppen").select("*").eq("user_id", user.id),
      ]);

      setGruppen(gruppenData || []);
      setGroupLinks(linksData || []);
      setGroupMap(buildGroupMap(linksData || []));
      setSelectedGroup("all");

      showToast("Gruppe gelöscht");
    } catch (e) {
      setError(e.message);
    }
  };


  const handleAddToGroup = async (gruppeId) => {
    const selectedH = Array.from(selectedHengste);
    const selectedS = Array.from(selectedStuten);
    if (selectedH.length + selectedS.length === 0) return;

    try {
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!user) throw new Error("Nicht eingeloggt");

      // Inserts vorbereiten mit garantiertem user_id
      const inserts = [
        ...selectedH.map((id) => ({
          gruppe_id: gruppeId,
          pferd_id: id,
          pferd_table: "Hengste",
          user_id: user.id,
        })),
        ...selectedS.map((id) => ({
          gruppe_id: gruppeId,
          pferd_id: id,
          pferd_table: "Stuten",
          user_id: user.id,
        })),
      ];

      const { error: insErr } = await supabase
        .from("pferde_gruppen")
        .upsert(inserts, { onConflict: "gruppe_id,pferd_id,pferd_table, user_id" });
      if (insErr) throw insErr;

      // Links neu laden und Mapping aktualisieren
      const { data: linksData, error: lErr } = await supabase
        .from("pferde_gruppen")
        .select("*")
        .eq("user_id", user.id);
      if (lErr) throw lErr;

      setGroupLinks(linksData || []);
      setGroupMap(buildGroupMap(linksData || []));

      // ✅ Erfolg-Toast
      showStatus("✅ Pferde erfolgreich zur Gruppe hinzugefügt!");
    } catch (e) {
      setError(e.message);
      showStatus("Fehler beim Hinzufügen zur Gruppe.", "error");
    }
  };

  // ---- Gruppen-Modal Steuerung ----
  const openGroupModal = (table) => {
    const ids =
      table === "Hengste" ? Array.from(selectedHengste) : Array.from(selectedStuten);
    if (ids.length === 0) return;
    setGroupModalTable(table);
    setGroupModalIds(ids);
    setGroupSelections(new Set()); // leer starten
    setGroupModalOpen(true);
  };

  const applyGroupModalAdd = async () => {
    // ausgewählte Pferde den ausgewählten Gruppen hinzufügen (upsert)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      const inserts = [];
      for (const gruppeId of groupSelections) {
        for (const id of groupModalIds) {
          inserts.push({
            gruppe_id: gruppeId,
            pferd_id: id,
            pferd_table: groupModalTable,
            user_id: user.id,
          });
        }
      }

      if (inserts.length > 0) {
        const { error: insErr } = await supabase
          .from("pferde_gruppen")
          .upsert(inserts, { onConflict: "gruppe_id,pferd_id,pferd_table, user_id" });
        if (insErr) throw insErr;
      }

      // Neu laden
      const { data: linksData, error: lErr } = await supabase
        .from("pferde_gruppen")
        .select("*")
        .eq("user_id", user.id);
      if (lErr) throw lErr;

      setGroupLinks(linksData || []);
      setGroupMap(buildGroupMap(linksData || []));
      setGroupModalOpen(false);

      // ✅ Erfolg-Toast
      showStatus("✅ Pferde wurden Gruppen hinzugefügt!");
    } catch (e) {
      setError(e.message);
      showStatus("Fehler: Hinzufügen zu Gruppen fehlgeschlagen.", "error");
    }
  };

  const applyGroupModalRemove = async () => {
    // ausgewählte Pferde aus den ausgewählten Gruppen entfernen
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      const ids = groupModalIds;
      const gruppeIds = Array.from(groupSelections);
      if (ids.length === 0 || gruppeIds.length === 0) {
        setGroupModalOpen(false);
        return;
      }

      const { error: delErr } = await supabase
        .from("pferde_gruppen")
        .delete()
        .in("pferd_id", ids)
        .in("gruppe_id", gruppeIds)
        .eq("pferd_table", groupModalTable)
        .eq("user_id", user.id);
      if (delErr) throw delErr;

      // Neu laden
      const { data: linksData, error: lErr } = await supabase
        .from("pferde_gruppen")
        .select("*")
        .eq("user_id", user.id);
      if (lErr) throw lErr;

      setGroupLinks(linksData || []);
      setGroupMap(buildGroupMap(linksData || []));
      setGroupModalOpen(false);

      // ✅ Erfolg-Toast
      showStatus("ℹ️ Pferde wurden aus Gruppen entfernt!");
    } catch (e) {
      setError(e.message);
      showStatus("Fehler: Entfernen aus Gruppen fehlgeschlagen.", "error");
    }
  };

  // ---------- Auswahl-Helpers ----------
  const isAllSelected = (rows, table) => {
    const set = table === "Hengste" ? selectedHengste : selectedStuten;
    return rows.length > 0 && rows.every((r) => set.has(r.id));
  };

  const toggleSelectAll = (rows, table) => {
    const set = new Set(table === "Hengste" ? selectedHengste : selectedStuten);
    if (isAllSelected(rows, table)) {
      rows.forEach((r) => set.delete(r.id)); // abwählen
    } else {
      rows.forEach((r) => set.add(r.id));    // auswählen
    }
    if (table === "Hengste") setSelectedHengste(set);
    else setSelectedStuten(set);
  };

  const toggleRow = (id, table) => {
    const set = new Set(table === "Hengste" ? selectedHengste : selectedStuten);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    if (table === "Hengste") setSelectedHengste(set);
    else setSelectedStuten(set);
  };

  // ---------- Löschen ----------
  const handleDeleteSelected = async (table) => {
    const selected =
      table === "Hengste" ? Array.from(selectedHengste) : Array.from(selectedStuten);
    if (selected.length === 0) return;

    if (
      !window.confirm(
        `Möchtest du wirklich ${selected.length} ${table === "Hengste" ? "Hengst(e)" : "Stute(n)"} löschen?`
      )
    ) {
      return;
    }

    try {
      // Zuerst aus Join-Tabelle löschen (falls dort Einträge vorhanden sind)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      await supabase
        .from("pferde_gruppen")
        .delete()
        .in("pferd_id", selected)
        .eq("pferd_table", table)
        .eq("user_id", user.id);

      // Dann aus Haupttabelle löschen
      const { error: delErr } = await supabase
        .from(table)
        .delete()
        .in("id", selected);
      if (delErr) throw delErr;

      // Neu laden
      setLoading(true);
      const [
        { data: rowsNew, error: errNew },
        { data: linksData, error: lErr }
      ] = await Promise.all([
        supabase.from(table).select("*").eq("user_id", user.id),
        supabase.from("pferde_gruppen").select("*").eq("user_id", user.id),
      ]);
      if (errNew) throw errNew;
      if (lErr) throw lErr;

      if (table === "Hengste") {
        setHengste(rowsNew || []);
        setSelectedHengste(new Set());
      } else {
        setStuten(rowsNew || []);
        setSelectedStuten(new Set());
      }
      setGroupLinks(linksData || []);
      setGroupMap(buildGroupMap(linksData || []));

      // Optionaler Erfolg für Löschaktion (nicht explizit angefragt)
      // showStatus("Einträge gelöscht.");
    } catch (e) {
      setError(e.message);
      showStatus("Fehler beim Löschen.", "error");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Sammel-Bearbeiten (Modal) ----------
  const openBatchEdit = (table) => {
    const count = table === "Hengste" ? selectedHengste.size : selectedStuten.size;
    if (count === 0) return;
    setEditTable(table);
    setEditValues({
      Notizen: "",
      Zucht: "",
      Zuchtziel: "",
      hengstOrt: "",
      Deckbereit: "",
    });
    setEditOpen(true);
  };

  const applyBatchEdit = async () => {
    if (!editTable) return;
    const ids =
      editTable === "Hengste"
        ? Array.from(selectedHengste)
        : Array.from(selectedStuten);
    if (ids.length === 0) return;

    const updateObj = {};
    if (editValues.Notizen.trim() !== "") updateObj["Notizen"] = editValues.Notizen.trim();
    if (editValues.Zucht.trim() !== "") updateObj["Zucht"] = editValues.Zucht.trim();
    if (editValues.Zuchtziel.trim() !== "") updateObj["Zuchtziel"] = editValues.Zuchtziel.trim();

    if (editTable === "Hengste") {
      if (editValues.hengstOrt.trim() !== "") {
        updateObj["ZG/HS/Eigener"] = editValues.hengstOrt.trim();
      }
      if (editValues.Deckbereit.trim() !== "") {
        updateObj["Deckbereit"] = editValues.Deckbereit.trim();
      }
    }

    if (Object.keys(updateObj).length === 0) {
      setEditOpen(false);
      return;
    }

    try {
      const { error: updErr } = await supabase
        .from(editTable)
        .update(updateObj)
        .in("id", ids);
      if (updErr) throw updErr;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      const { data: refreshed, error: refErr } = await supabase
        .from(editTable)
        .select("*")
        .eq("user_id", user.id);
      if (refErr) throw refErr;

      if (editTable === "Hengste") {
        setHengste(refreshed || []);
      } else {
        setStuten(refreshed || []);
      }

      setEditOpen(false);
      // Optional: showStatus("Änderungen übernommen");
    } catch (e) {
      setError(e.message);
      showStatus("Fehler beim Übernehmen der Änderungen.", "error");
    }
  };

  // ---------- Filter nach Gruppe ----------
  const isInSelectedGroup = (table, id) => {
    if (selectedGroup === "all") return true;
    const key = `${table}:${id}`;
    const set = groupMap.get(key);
    return set ? set.has(selectedGroup) : false;
  };

  const filterRowsByGroup = (rows, table) => {
    if (selectedGroup === "all") return rows;
    return rows.filter((r) => isInSelectedGroup(table, r.id));
  };

  // ---------- Tabellen-Render ----------
  const renderTable = (rows, title, color, table) => {
    const selectedSet = table === "Hengste" ? selectedHengste : selectedStuten;
    const filtered = filterRowsByGroup(rows, table);
    // Pagination-Berechnung (NEU)
const page = table === "Hengste" ? pageHengste : pageStuten;
const setPage = table === "Hengste" ? setPageHengste : setPageStuten;

const totalRows = filtered.length;
const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
const currentPage = Math.min(page, totalPages); // falls Filter/PageSize kleiner wird
const start = (currentPage - 1) * pageSize;
const end = start + pageSize;
const pageRows = filtered.slice(start, end);


    if (!filtered || filtered.length === 0) {
      return (
        <section className="table-block">
          <h2 className="block-title">{title}</h2>
          <div className="table-actions disabled">
            <button disabled>Ausgewählte bearbeiten</button>
            <button disabled>Ausgewählte löschen</button>
            <button disabled>Zu Gruppe hinzufügen / entfernen</button>
          </div>
          <div className="table-hscroll">
            <table className="styled-table">
              <thead>
                <tr style={{ backgroundColor: color }}>
                  <th>Keine Daten vorhanden</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>-</td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: color }}>
                  <td>{title}</td>
                </tr>
              </tfoot>
            </table>
            <div className="pagination">
  <button
    className="btn"
    onClick={() => setPage(Math.max(1, currentPage - 1))}
    disabled={currentPage <= 1}
  >
    ◀️ Zurück
  </button>

  <span className="page-indicator">
    Seite {currentPage} / {totalPages} — {totalRows} Einträge
  </span>

  <button
    className="btn"
    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
    disabled={currentPage >= totalPages}
  >
    Weiter ▶️
  </button>
</div>


          </div>
        </section>
      );
    }

    const columns = Object.keys(filtered[0]).filter(
      (col) => col !== "id" && col !== "user_id" && col !== "created_at"
    );

    const allChecked = pageRows.length > 0 && pageRows.every((r) => selectedSet.has(r.id));
    const anySelected = selectedSet.size > 0; // unverändert: Auswahl über Seiten hinweg bleibt bestehen


    return (
      <section className="table-block">
        <h2 className="block-title">{title}</h2>

        <div className="table-actions">
          <button
            onClick={() => openBatchEdit(table)}
            disabled={!anySelected}
            className={!anySelected ? "btn disabled" : "btn"}
            title={
              table === "Hengste"
                ? "Notizen, Zucht, Zuchtziel, ZG/HS/Eigener, Deckbereit"
                : "Notizen, Zucht, Zuchtziel"
            }
          >
            Ausgewählte bearbeiten
          </button>
          <button
            onClick={() => handleDeleteSelected(table)}
            disabled={!anySelected}
            className={!anySelected ? "btn danger disabled" : "btn danger"}
          >
            Ausgewählte löschen
          </button>

          <button
            onClick={() => openGroupModal(table)}
            disabled={!anySelected}
            className={!anySelected ? "btn disabled" : "btn"}
            title="Ausgewählte Pferde zu einer oder mehreren Gruppen hinzufügen/entfernen"
          >
            Zu Gruppe hinzufügen / entfernen
          </button>
        </div>

        <div className="table-hscroll">
          <table className="styled-table">
            <thead>
              <tr style={{ backgroundColor: color }}>
                <th style={{ width: 36, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => toggleSelectAll(pageRows, table)}
                    aria-label="Alle auswählen"
                  />
                </th>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
                <th style={{ width: 120 }}>Gruppen</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const checked = selectedSet.has(row.id);
                const key = `${table}:${row.id}`;
                const rowGroupIds = Array.from(groupMap.get(key) || []);
                const rowGroupNames = rowGroupIds
                  .map((gid) => gruppen.find((g) => g.id === gid)?.name)
                  .filter(Boolean);

                return (
                  <tr key={row.id}>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRow(row.id, table)}
                        aria-label="Zeile auswählen"
                      />
                    </td>
                    {columns.map((col) => {
                      const value =
                        row[col] !== null && row[col] !== undefined
                          ? row[col].toString()
                          : "";
                      if (col.toLowerCase() === "name") {
                        return (
                          <td key={col}>
                            <Link
                              href={{
                                pathname: `/pferd/${row.id}`,
                                query: { table },
                              }}
                            >
                              {value}
                            </Link>
                          </td>
                        );
                      }
                      return <td key={col}>{value}</td>;
                    })}
                    <td>{rowGroupNames.length ? rowGroupNames.join(", ") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: color }}>
                <td colSpan={columns.length + 2}>{title}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="pagination">
  <button
    className="btn"
    onClick={() => setPage(Math.max(1, currentPage - 1))}
    disabled={currentPage <= 1}
  >
    ◀️ Zurück
  </button>

  <span className="page-indicator">
    Seite {currentPage} / {totalPages} — {totalRows} Einträge
  </span>

  <button
    className="btn"
    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
    disabled={currentPage >= totalPages}
  >
    Weiter ▶️
  </button>
</div>

      </section>
    );
  };

  return (
    <div className="page">
      {/* ✅ Status-Toast */}
      {statusMessage && (
        <div className={`status-toast ${statusType}`}>
          {statusMessage}
        </div>
      )}

      {/* gemeinsamer horizontaler Scroll-Container */}
      <div className="hscroll">
        <div className="content">
          <header className="site-bar top">
  <h1>Equinepassion Rechner — Meine Pferde</h1>
</header>


          {/* Gruppen-Toolbar */}
          <div className="groups-bar">
            <input
              placeholder="Neue Gruppe"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <button onClick={handleCreateGroup}>Gruppe erstellen</button>

            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setPageHengste(1);
                setPageStuten(1);
              }}
              title="Nur eine Gruppe anzeigen"
            >
              <option value="all">Alle anzeigen</option>
              {gruppen.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <div className="page-size">
  <label>pro Seite:&nbsp;</label>
  <select
    value={pageSize}
    onChange={(e) => {
      setPageSize(Number(e.target.value));
      setPageHengste(1);
      setPageStuten(1);
    }}
    aria-label="Anzahl Einträge pro Seite"
  >
    <option value={5}>5</option>
    <option value={10}>10</option>
    <option value={25}>25</option>
    <option value={50}>50</option>
    <option value={75}>75</option>
    <option value={100}>100</option>
  </select>
</div>

          </div>

                      {selectedGroup !== "all" && (
              <>
                <button onClick={() => handleRenameGroup(selectedGroup)}>
                  Gruppe umbenennen
                </button>
                <button
                  className="btn danger"
                  onClick={() => handleDeleteGroup(selectedGroup)}
                >
                  Gruppe löschen
                </button>
              </>
            )}


          {loading && <p>Lade...</p>}
          {error && <p className="err">{error}</p>}

          {!loading && !error && (
            <>
              {renderTable(hengste, "🐴 Hengste", "#e0f7fa", "Hengste")}
              {renderTable(stuten, "🐴 Stuten", "#fce4ec", "Stuten")}
            </>
          )}

                    {toastMessage && (
            <div className="toast">{toastMessage}</div>
          )}


          <footer className="site-bar bottom">© 2025 Equinepassion Rechner</footer>
        </div>
      </div>

      {/* Modal fürs Sammel-Bearbeiten */}
      {editOpen && (
        <div className="modal-backdrop" onClick={() => setEditOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {editTable === "Hengste"
                ? "Ausgewählte Hengste bearbeiten"
                : "Ausgewählte Stuten bearbeiten"}
            </h3>
            <p style={{ marginTop: -6, color: "#666" }}>
              Nur ausgefüllte Felder werden übernommen (leere Felder bleiben unverändert).
            </p>

            <div className="form-grid">
              <label>Notizen</label>
              <textarea
                rows={3}
                value={editValues.Notizen}
                onChange={(e) =>
                  setEditValues((v) => ({ ...v, Notizen: e.target.value }))
                }
              />

              <label>Zucht</label>
              <input
                value={editValues.Zucht}
                onChange={(e) =>
                  setEditValues((v) => ({ ...v, Zucht: e.target.value }))
                }
              />

              <label>Zuchtziel</label>
              <input
                value={editValues.Zuchtziel}
                onChange={(e) =>
                  setEditValues((v) => ({ ...v, Zuchtziel: e.target.value }))
                }
              />

              {editTable === "Hengste" && (
                <>
                  <label>ZG/HS/Eigener</label>
                  <input
                    placeholder="z. B. Eigener / ZG / HS / frei"
                    value={editValues.hengstOrt}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, hengstOrt: e.target.value }))
                    }
                  />

                  <label>Deckbereit</label>
                  <input
                    placeholder='z. B. "Ja" oder Jahr (2071)'
                    value={editValues.Deckbereit}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, Deckbereit: e.target.value }))
                    }
                  />
                </>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setEditOpen(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={applyBatchEdit}>
                Änderungen übernehmen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Gruppen hinzufügen/entfernen */}
      {groupModalOpen && (
        <div className="modal-backdrop" onClick={() => setGroupModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Zu Gruppen hinzufügen / aus Gruppen entfernen</h3>
            <p style={{ marginTop: -6, color: "#666" }}>
              Wähle eine oder mehrere Gruppen aus, um die ausgewählten Pferde hinzuzufügen oder zu entfernen.
            </p>

            <div className="group-checkbox-grid">
              {gruppen.length === 0 && <p>Du hast noch keine Gruppen angelegt.</p>}
              {gruppen.map((g) => (
                <label key={g.id} className="group-check">
                  <input
                    type="checkbox"
                    checked={groupSelections.has(g.id)}
                    onChange={(e) => {
                      const newSet = new Set(groupSelections);
                      if (e.target.checked) newSet.add(g.id);
                      else newSet.delete(g.id);
                      setGroupSelections(newSet);
                    }}
                  />
                  {g.name}
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setGroupModalOpen(false)}>
                Abbrechen
              </button>
              <button
                className="btn"
                onClick={applyGroupModalRemove}
                disabled={groupSelections.size === 0}
                title="Ausgewählte Pferde aus den markierten Gruppen entfernen"
              >
                Aus Gruppen entfernen
              </button>
              <button
                className="btn primary"
                onClick={applyGroupModalAdd}
                disabled={groupSelections.size === 0}
                title="Ausgewählte Pferde zu den markierten Gruppen hinzufügen"
              >
                Zu Gruppen hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page {
          padding: 0;
          font-size: 13px;
          color: #222;
        }

        .err {
          color: #c00;
          padding: 12px 16px;
        }

        /* ✅ Status-Toast Styles */
        .status-toast {
          position: fixed;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          padding: 10px 14px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.12);
          border: 1px solid transparent;
        }
        .status-toast.success {
          background: #d1fae5;   /* green-100 */
          color: #065f46;        /* green-800 */
          border-color: #34d399; /* green-400 */
        }
        .status-toast.error {
          background: #fee2e2;   /* red-100 */
          color: #991b1b;        /* red-800 */
          border-color: #f87171; /* red-400 */
        }

                .toast {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #22c55e;
          color: white;
          padding: 10px 18px;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 100;
          font-size: 14px;
          font-weight: 500;
          animation: fadein 0.3s, fadeout 0.5s 2.5s;
        }

        @keyframes fadein {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fadeout {
          from { opacity: 1; }
          to { opacity: 0; }
        }


        .hscroll {
          overflow-x: auto;
        }
        .content {
          width: max-content;
          min-width: 100vw;
        }

        .site-bar {
          background: #f6f7fb;
          border-bottom: 1px solid #e3e6ef;
          padding: 14px 16px;
        }
        .site-bar.bottom {
          margin-top: 24px;
          border-top: 1px solid #e3e6ef;
          border-bottom: none;
          text-align: center;
        }
        .site-bar h1 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
        }

        .groups-bar {
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 8px 16px;
        }
        .groups-bar input,
        .groups-bar select {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 13px;
        }
        .groups-bar button {
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          background: #fff;
          border-radius: 6px;
          cursor: pointer;
         }

        .groups-bar button.btn.danger {
          background: #ef4444;
          border-color: #ef4444;
          color: #fff;
        }

        .table-block {
          margin: 24px 0;
          padding: 0 16px;
        }
        .block-title {
          margin: 0 0 8px 0;
          font-size: 14px;
          font-weight: 700;
        }

        .table-actions {
          display: flex;
          gap: 10px;
          margin: 8px 0 10px;
        }
        .table-actions .btn {
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          background: #fff;
          border-radius: 6px;
          cursor: pointer;
        }
        .table-actions .btn.primary {
          background: #2563eb;
          color: #fff;
          border-color: #2563eb;
        }
        .table-actions .btn.danger {
          background: #ef4444;
          color: #fff;
          border-color: #ef4444;
        }
        .table-actions .btn.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .table-hscroll {
          overflow-x: auto;
          max-width: 100%;
        }

        .styled-table {
          border-collapse: separate;
          border-spacing: 0;
          background: #fff;
          font-size: 13px;
          width: 100%;
          table-layout: auto;
        }

        .styled-table th,
        .styled-table td {
          border: 1px solid #e5e7eb;
          box-sizing: border-box;
          padding: 8px 10px;
          text-align: left;
          white-space: nowrap;
        }

        .styled-table thead th {
          font-weight: 700;
          color: #000;
          position: sticky;
          top: 0;
          z-index: 2;
          background: inherit;
        }

        .styled-table tfoot td {
          font-weight: 600;
          position: sticky;
          bottom: 0;
          z-index: 1;
          background: inherit;
        }

        .styled-table tbody tr:nth-child(even) {
          background: #fafafa;
        }
        .styled-table tbody tr:hover {
          background: #f5f5f5;
        }

        /* Modal */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
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
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
          padding: 18px;
        }
        .modal h3 {
          margin: 0 0 12px 0;
          font-size: 18px;
          font-weight: 700;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 10px 12px;
          margin-top: 8px;
        }
        .form-grid input,
        .form-grid textarea {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 13px;
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 14px;
        }
        .modal .btn {
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          background: #fff;
          border-radius: 6px;
          cursor: pointer;
        }
        .modal .btn.primary {
          background: #2563eb;
          color: #fff;
          border-color: #2563eb;
        }

        /* Gruppen-Modal Checkboxen */
        .group-checkbox-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 8px 12px;
          margin: 10px 0 6px;
        }
        .group-check {
          display: flex;
          align-items: center;
          gap: 8px;
        }
          .site-bar.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-links {
  display: flex;
  gap: 16px;
}

.nav-links a {
  color: #2563eb;
  text-decoration: none;
  font-weight: 600;
}

.nav-links a:hover {
  text-decoration: underline;
}


        /* Pagination */
.pagination {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 16px 0;
}
.pagination .page-indicator {
  font-size: 12px;
  color: #555;
}

/* Page-size in Toolbar */
.groups-bar .page-size {
  display: flex;
  align-items: center;
  gap: 6px;
}

      `}</style>
    </div>
  );
}
