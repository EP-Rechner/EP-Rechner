// lib/utils.js

// ---------------------- Gruppen-Helfer ----------------------
export function buildGroupMap(linksArray) {
  const map = new Map();
  for (const row of linksArray || []) {
    const key = `${row.pferd_table}:${row.pferd_id}`;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(row.gruppe_id);
  }
  return map;
}

// ---------------------- Basics ----------------------
const safe = (v, dash = "—") =>
  v === null || v === undefined || v === "" ? dash : v;

const parseNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Zugriff auf Felder mit oder ohne Leerzeichen
function getField(obj, ...names) {
  for (const n of names) {
    if (obj[n] !== undefined && obj[n] !== null) return obj[n];
  }
  return null;
}

const norm = (v) => (v ?? "").toString().trim().toLowerCase();
const pretty = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const span = (mid, minus, plus) =>
  `${Math.round(mid - minus)} / ${Math.round(mid)} / ${Math.round(mid + plus)}`;

const isNumber = (x) => typeof x === "number" && Number.isFinite(x);

// ---------------------- Trait-Mappings ----------------------
function makeTraitMapping(goodMap, badMap, transformFn) {
  return { good: goodMap, bad: badMap, transform: transformFn };
}

// Generisches -10..10 → 0..10 (in 0.5-Schritten)
const OUTSCALE_GENERIC = {
  "-10": 0, "-9": 0.5, "-8": 1, "-7": 1.5, "-6": 2, "-5": 2.5, "-4": 3, "-3": 3.5, "-2": 4, "-1": 4.5,
  "0": 5, "1": 5.5, "2": 6, "3": 6.5, "4": 7, "5": 7.5, "6": 8, "7": 8.5, "8": 9, "9": 9.5, "10": 10
};
const outGeneric = (x) => OUTSCALE_GENERIC[String(Math.max(-10, Math.min(10, Math.round(x))))];

// Alle Texte exakt wie vorgegeben
const MAPPINGS = {
  Temperament: makeTraitMapping(
    { "viel zu viel": 8, "zu viel": 5, "etwas zu viel": 2, "gutes": 0, "etwas wenig": -2, "wenig": -5, "sehr wenig": -8 },
    { "viel zu viel": 10, "sehr wenig": -10, "wenig": -7, "zu viel": 7, "etwas wenig": -4, "etwas zu viel": 4, "gutes": 0 },
    (val) => 10 - Math.abs(val) // spezielle Skala lt. Vorgabe
  ),
  Ausstrahlung: makeTraitMapping(
    { "sehr viel": 10, "viel": 7, "recht viel": 4, "durchschnittliche": 1, "etwas wenig": -2, "wenig": -5, "sehr wenig": -8 },
    { "sehr viel": 8, "sehr wenig": -10, "wenig": -7, "viel": 5, "etwas wenig": -4, "recht viel": 2, "durchschnittliche": -1 },
    outGeneric
  ),
  Aufmerksamkeit: makeTraitMapping(
    { "sehr": 10, "überdurchschnittlich": 7, "recht": 4, "durchschnittlich": 1, "etwas wenig": -2, "wenig": -5, "sehr wenig": -8 },
    { "sehr": 8, "sehr wenig": -10, "wenig": -7, "überdurchschnittlich": 5, "etwas wenig": -4, "recht": 2, "durchschnittlich": -1 },
    outGeneric
  ),
  Ausgeglichenheit: null, // wird unten gespiegelt
  Nervenstärke:   null,
  Intelligenz:    null,
  Händelbarkeit: makeTraitMapping(
    { "sehr leicht": 10, "leicht": 7, "recht leicht": 4, "durchschnittlich": 1, "etwas schwer": -2, "schwer": -5, "sehr schwer": -8 },
    { "sehr leicht": 8, "sehr schwer": -10, "schwer": -7, "leicht": 5, "etwas schwer": -4, "recht leicht": 2, "durchschnittlich": -1 },
    outGeneric
  ),
  Kopf: makeTraitMapping(
    { "viel zu groß": 8, "zu groß": 5, "etwas zu groß": 2, "gut": 0, "etwas zu klein": -2, "zu klein": -5, "viel zu klein": -8 },
    { "viel zu groß": 10, "viel zu klein": -10, "zu klein": -7, "zu groß": 7, "etwas zu klein": -4, "etwas zu groß": 4, "gut": 0 },
    (val) => 10 - Math.abs(val)
  ),
  Halsansatz: makeTraitMapping(
    { "viel zu hoch": 8, "zu hoch": 5, "etwas zu hoch": 2, "gut": 0, "etwas zu tief": -2, "zu tief": -5, "viel zu tief": -8 },
    { "viel zu hoch": 10, "viel zu tief": -10, "zu tief": -7, "zu hoch": 7, "etwas zu tief": -4, "etwas zu hoch": 4, "gut": 0 },
    (val) => 10 - Math.abs(val)
  ),
  Hals: makeTraitMapping(
    { "viel zu lang": 8, "zu lang": 5, "etwas zu lang": 2, "gut": 0, "etwas zu kurz": -2, "zu kurz": -5, "viel zu kurz": -8 },
    { "viel zu lang": 10, "viel zu kurz": -10, "zu kurz": -7, "zu lang": 7, "etwas zu kurz": -4, "etwas zu lang": 4, "gut": 0 },
    (val) => 10 - Math.abs(val)
  ),
  Rücken: makeTraitMapping(
    { "viel zu lang": 8, "zu lang": 5, "etwas zu lang": 2, "gut": 0, "etwas zu kurz": -2, "zu kurz": -5, "viel zu kurz": -8 },
    { "viel zu lang": 10, "viel zu kurz": -10, "zu kurz": -7, "zu lang": 7, "etwas zu kurz": -4, "etwas zu lang": 4, "gut": 0 },
    (val) => 10 - Math.abs(val)
  ),
  // Beine (6 Spalten)
  "Vorderbeine Stand": makeTraitMapping(
    { "sehr vorständig": 8, "vorständig": 5, "etwas vorständig": 2, "gut": 0, "etwas rückständig": -2, "rückständig": -5, "sehr rückständig": -8 },
    { "sehr vorständig": 10, "sehr rückständig": -10, "rückständig": -7, "vorständig": 7, "etwas rückständig": -4, "etwas vorständig": 4, "gut": 0 },
    (val) => 10 - Math.abs(val)
  ),
  "Vorderbeine Boden": makeTraitMapping(
    { "sehr bodenweit": 8, "bodenweit": 5, "etwas bodenweit": 2, "gut": 0, "etwas bodeneng": -2, "bodeneng": -5, "sehr bodeneng": -8 },
    { "sehr bodenweit": 10, "sehr bodeneng": -10, "bodeneng": -7, "bodenweit": 7, "etwas bodeneng": -4, "etwas bodenweit": 4, "gut": 0 },
    (val) => 10 - Math.abs(val)
  ),
  "Vorderbeine Zehen": makeTraitMapping(
    { "sehr zehenweit": 8, "zehenweit": 5, "etwas zehenweit": 2, "gut": 0, "etwas zeheneng": -2, "zeheneng": -5, "sehr zeheneng": -8 },
    { "sehr zehenweit": 10, "sehr zeheneng": -10, "zeheneng": -7, "zehenweit": 7, "etwas zeheneng": -4, "etwas zehenweit": 4, "gut": 0 },
    (val) => 10 - Math.abs(val)
  ),
  "Hinterbeine Stand": makeTraitMapping(
    { "sehr vorständig": 8, "vorständig": 5, "etwas vorständig": 2, "gut": 0, "etwas rückständig": -2, "rückständig": -5, "sehr rückständig": -8 },
    { "sehr vorständig": 10, "sehr rückständig": -10, "rückständig": -7, "vorständig": 7, "etwas rückständig": -4, "etwas vorständig": 4, "gut": 0 },
    (val) => 10 - Math.abs(val)
  ),
  "Hinterbeine Boden": makeTraitMapping(
    { "sehr bodenweit": 8, "bodenweit": 5, "etwas bodenweit": 2, "gut": 0, "etwas bodeneng": -2, "bodeneng": -5, "sehr bodeneng": -8 },
    { "sehr bodenweit": 10, "sehr bodeneng": -10, "bodeneng": -7, "bodenweit": 7, "etwas bodeneng": -4, "etwas bodenweit": 4, "gut": 0 },
    (val) => 10 - Math.abs(val)
  ),
  "Hinterbeine Zehen": makeTraitMapping(
    { "sehr zehenweit": 8, "zehenweit": 5, "etwas zehenweit": 2, "gut": 0, "etwas zeheneng": -2, "zeheneng": -5, "sehr zeheneng": -8 },
    { "sehr zehenweit": 10, "sehr zeheneng": -10, "zeheneng": -7, "zehenweit": 7, "etwas zeheneng": -4, "etwas zehenweit": 4, "gut": 0 },
    (val) => 10 - Math.abs(val)
  ),
};
// Spiegeln
["Ausgeglichenheit", "Nervenstärke", "Intelligenz"].forEach((k) => {
  if (!MAPPINGS[k]) MAPPINGS[k] = MAPPINGS["Aufmerksamkeit"];
});

function valueFromMap(val, map) {
  if (!map) return 0;
  return map[val] ?? 0;
}
// --- Neues Noten-Schema für Ausstrahlung..Intelligenz ---
const GOOD_NOTE_REMAP = {
  "10": 10, "7": 8.5, "4": 7, "1": 5.5, "-2": 4, "-5": 2.5, "-8": 1
};
const BAD_NOTE_REMAP = {
  "-10": 0, "-7": 1.5, "-4": 3, "-1": 4.5, "2": 6, "5": 7.5, "8": 9
};

const mapGoodNote = (v) => GOOD_NOTE_REMAP[String(v)];
const mapBadNote  = (v) => BAD_NOTE_REMAP[String(v)];

// Traits, die das neue Notenschema verwenden
const NEW_SCHEME_TRAITS = new Set([
  "ausstrahlung",
  "aufmerksamkeit",
  "ausgeglichenheit",
  "händelbarkeit",
  "nervenstärke",
  "intelligenz"
]);
// --- Neues Schema für Temperament & Kopf..Beine ---
// Schlechte Noten Mapping
const BAD_NOTE_REMAP2 = {
  "-10": 0, "-7": 3, "-4": 6, "0": 9, "4": 6, "7": 3, "10": 0
};
// Gute Noten Mapping
const GOOD_NOTE_REMAP2 = {
  "-8": 2, "-5": 5, "-2": 8, "0": 10, "2": 8, "5": 5, "8": 2
};

function mapBadNote2(v)  { return BAD_NOTE_REMAP2[String(v)]; }
function mapGoodNote2(v) { return GOOD_NOTE_REMAP2[String(v)]; }


function computeTraitTriple(stute, hengst, traitName) {
  const cfg = MAPPINGS[traitName];
  if (!cfg) return "— / — / —";

  const sVal = getField(stute, traitName, traitName.replace(" ", ""));
  const hVal = getField(hengst, traitName, traitName.replace(" ", ""));
  const sGood = valueFromMap(sVal, cfg.good);
  const hGood = valueFromMap(hVal, cfg.good);
  const sBad  = valueFromMap(sVal, cfg.bad);
  const hBad  = valueFromMap(hVal, cfg.bad);

  // 1) Neues Schema für Temperament + Kopf..Beine
  const IS_NEW2 = (
    traitName === "Temperament" ||
    [
      "kopf","halsansatz","hals","rücken",
      "vorderbeine stand","vorderbeine boden","vorderbeine zehen",
      "hinterbeine stand","hinterbeine boden","hinterbeine zehen"
    ].includes(norm(traitName))
  );

  if (IS_NEW2) {
    // schlechte Note
    let worst;
    if (sBad === -10 || hBad === -10 || sBad === 10 || hBad === 10) {
      worst = 0; // Sonderfall: -10/10 → 0
    } else {
      const sDist = Math.abs(sBad);
      const hDist = Math.abs(hBad);
      if (sDist === hDist) {
        worst = mapBadNote2(sBad);              // Gleichstand → Stute
      } else {
        const farther = (sDist > hDist ? sBad : hBad);
        worst = mapBadNote2(farther);           // weiter weg von 0
      }
    }

    // gute Note
    let best;
    if (sGood === 0 || hGood === 0) {
      best = 10;                                // 0 → 10
    } else if ((sGood > 0 && hGood < 0) || (sGood < 0 && hGood > 0)) {
      best = 10;                                // Vorzeichen unterschiedlich → 10
    } else {
      const sDist = Math.abs(sGood);
      const hDist = Math.abs(hGood);
      if (sDist === hDist) {
        best = mapGoodNote2(sGood);             // Gleichstand → Stute
      } else {
        const nearer = (sDist < hDist ? sGood : hGood);
        best = mapGoodNote2(nearer);            // näher an 0
      }
    }

    if (worst === undefined || best === undefined) return "— / — / —";
    const avg = Number(((worst + best) / 2).toFixed(1));
    return `${pretty(worst)} / ${pretty(avg)} / ${pretty(best)}`;
  }

  // 2) Neues Schema für Ausstrahlung..Intelligenz
  if (NEW_SCHEME_TRAITS.has(norm(traitName))) {
    const sGoodNote = mapGoodNote(sGood);
    const hGoodNote = mapGoodNote(hGood);
    const sBadNote  = mapBadNote(sBad);
    const hBadNote  = mapBadNote(hBad);

    if ([sGoodNote, hGoodNote, sBadNote, hBadNote].some(v => v === undefined)) {
      return "— / — / —";
    }
    const worstNote = (sBadNote <= hBadNote) ? sBadNote : hBadNote;   // Gleichstand → Stute
    const bestNote  = (sGoodNote >= hGoodNote) ? sGoodNote : hGoodNote;
    const avgNote = Number(((worstNote + bestNote) / 2).toFixed(1));
    return `${pretty(worstNote)} / ${pretty(avgNote)} / ${pretty(bestNote)}`;
  }

  // 3) Fallback (sollte selten greifen)
  const worst = sBad < hBad ? sBad : hBad;
  const best  = sGood > hGood ? sGood : hGood;
  const avg   = (worst + best) / 2;
  const W = cfg.transform(worst);
  const A = cfg.transform(avg);
  const B = cfg.transform(best);
  return `${pretty(W)} / ${pretty(A)} / ${pretty(B)}`;
}




// Für Interieur/Exterieur – extrahiert Worst/Best (bereits konvertiert)
function traitWorstBestConverted(stute, hengst, traitName) {
  const triple = computeTraitTriple(stute, hengst, traitName); // "w / a / b"
  const [w, , b] = triple.split("/").map((x) => parseNum(x));
  return { worst: w ?? 0, best: b ?? 0 };
}

// ---------------------- Interieur / Exterieur ----------------------
function computeInterieur(stute, hengst) {
  const keys = ["Temperament","Ausstrahlung","Aufmerksamkeit","Ausgeglichenheit","Händelbarkeit","Nervenstärke","Intelligenz"];
  const worsts = [], bests = [];
  for (const k of keys) {
    const { worst, best } = traitWorstBestConverted(stute, hengst, k);
    worsts.push(worst);
    bests.push(best);
  }
  const w = worsts.reduce((a,b)=>a+b,0) / worsts.length;
  const b = bests.reduce((a,b)=>a+b,0) / bests.length;
  return `${w.toFixed(1)} / ${b.toFixed(1)}`;
}

function computeExterieur(stute, hengst) {
  const keys = ["Kopf","Halsansatz","Hals","Rücken","Vorderbeine Stand","Vorderbeine Boden","Vorderbeine Zehen","Hinterbeine Stand","Hinterbeine Boden","Hinterbeine Zehen"];
  const worsts = [], bests = [];
  for (const k of keys) {
    const { worst, best } = traitWorstBestConverted(stute, hengst, k);
    worsts.push(worst);
    bests.push(best);
  }
  const w = worsts.reduce((a,b)=>a+b,0) / worsts.length;
  const b = bests.reduce((a,b)=>a+b,0) / bests.length;
  return `${w.toFixed(1)} / ${b.toFixed(1)}`;
}

// ---------------------- Disziplin / FK ----------------------
// Entfernt alles ab "TK" (inklusive Zahl dahinter)
function stripTK(value) {
  if (!value) return "";
  return value.toString().replace(/\s*TK\s*\d+$/, "").trim();
}

/**
 * Vergleicht die Disziplin der Stute mit allen 3 Disziplinen des Hengstes.
 * Gibt die Disziplin zurück, wenn ein Match vorhanden ist,
 * sonst "Kein Match" (mit rotem Stil).
 */
function matchDisziplin(stute, hengst, disNr) {
  const sRaw = getField(stute, `Disziplin ${disNr}`, `Disziplin${disNr}`, `disziplin_${disNr}`);
  if (!sRaw) return "—";

  // TK-Teile abschneiden
  const sClean = stripTK(sRaw);

  const hVals = [
    getField(hengst, "Disziplin 1", "Disziplin1", "disziplin_1"),
    getField(hengst, "Disziplin 2", "Disziplin2", "disziplin_2"),
    getField(hengst, "Disziplin 3", "Disziplin3", "disziplin_3"),
  ]
    .filter(Boolean)
    .map(stripTK) // ebenfalls TK entfernen
    .map(norm);   // normalisieren

  if (hVals.includes(norm(sClean))) {
    return sClean; // ohne TK zurückgeben
  }
  return { text: "Kein Match", style: "red" };
}



/**
 * Berechnet den FK-Wert für eine bestimmte Spalte (z. B. FK 1, FK 2.3, FK Gesamt).
 * 
 * - stuteKey: Spaltenname bei der Stute (z. B. "FK 1")
 * - hengstKey: Spaltenname beim Hengst (z. B. "FK 1")
 * - minus / plus: Abzüge und Zuschläge für die Spanne
 */
function computeFK(stute, hengst, stuteKey, hengstKey, minus, plus) {
  const sVal = parseNum(stute[stuteKey]);
  const hVal = parseNum(hengst[hengstKey]);

  // Falls einer fehlt oder einer == 0 → "—"
  if (sVal == null || hVal == null || sVal === 0 || hVal === 0) {
    return "—";
  }

  const avg = (sVal + hVal) / 2;
  return `${Math.round(avg - minus)} / ${Math.round(avg)} / ${Math.round(avg + plus)}`;
}



// ---------------------- Genetik ----------------------
function combineAlleles(s, h) {
  if (!s || !h) return "—";
  const sa = s.split("/").map(x=>x.trim()).filter(Boolean);
  const ha = h.split("/").map(x=>x.trim()).filter(Boolean);
  if (sa.length === 0 || ha.length === 0) return "—";
  const combos = [];
  for (const i of sa) for (const j of ha) combos.push(i + j);
  return combos.join(" / ");
}

function yesNoMaybe(v1, v2) {
  const a = (v1 ?? "").toString().trim().toLowerCase();
  const b = (v2 ?? "").toString().trim().toLowerCase();
  if (a === "ja" && b === "ja") return "Ja";
  if (a === "nein" && b === "nein") return "Nein";
  return "Vielleicht";
}

function flaxenCombine(v1, v2) {
  const a = (v1 ?? "").toString().trim().toLowerCase();
  const b = (v2 ?? "").toString().trim().toLowerCase();
  if (a === "zeiger" && b === "zeiger") return "Zeiger";
  if (a === "nein" && b === "nein") return "Nein";
  if ((a === "zeiger" && b === "träger") || (a === "träger" && b === "zeiger")) return "Zeiger/Träger";
  if (a === "träger" && b === "träger") return "Zeiger/Träger/Nein";
  if ((a === "träger" && b === "nein") || (a === "nein" && b === "träger")) return "Träger/Nein";
  return "—";
}

// ---------------------- Inzucht & Größe ----------------------
function inbreedingCheck(stute, hengst) {
  const A = [stute?.Name, stute?.Mutter, stute?.Vater].map(norm).filter(Boolean);
  const B = [hengst?.Name, hengst?.Mutter, hengst?.Vater].map(norm).filter(Boolean);
  const set = new Set(A);
  const hit = B.find((x) => set.has(x));
  if (hit) return { text: "Inzucht", style: "red" };
  return "Keine Inzucht";
}

function sizeRange(stute, hengst) {
  const ms = parseNum(stute["Größe"]);
  const hs = parseNum(hengst["Größe"]);
  if (!isNumber(ms) || !isNumber(hs)) return "—";
  const avg = (ms + hs) / 2;
  return `${Math.round(avg - 5)}-${Math.round(avg + 5)}`;
}

function sizeCheck(stute, hengst) {
  const ms = parseNum(stute["Größe"]);
  const hs = parseNum(hengst["Größe"]);
  if (!isNumber(ms) || !isNumber(hs)) return "—";
  if (Math.abs(ms - hs) > 50) return { text: "Decken nicht möglich", style: "red" };
  return "Ja";
}

// ---------------------- Hauptdisziplin ----------------------
function mainDisziplinCell(stute, hengst) {
  // Vorgabe: "Hauptdisziplin" prüfen anhand Spalte "Disziplin" – sonst Fallback auf "Hauptdisziplin"
  const s = (stute?.Disziplin ?? stute?.["Hauptdisziplin"] ?? "").toString().trim();
  const h = (hengst?.Disziplin ?? hengst?.["Hauptdisziplin"] ?? "").toString().trim();
  if (!s || !h) return "—";
  if (norm(s) === norm(h)) return s;
  return { text: "Nein", style: "red" };
}

// ---------------------- computeFoalRow (ALLE SPALTEN) ----------------------
// ---------------------- computeFoalRow ----------------------
export function computeFoalRow(stute, hengst) {
  const mareSize = parseNum(stute.Groesse || stute["Größe"]);
  const stallionSize = parseNum(hengst.Groesse || hengst["Größe"]);

  let sizeRange = "—";
  if (mareSize != null && stallionSize != null) {
    const avg = (mareSize + stallionSize) / 2;
    sizeRange = `${avg - 5}-${avg + 5}`;
  }

  return {
    key: `${stute.id}:${hengst.id}`,
    stute_id: stute.id,
    stute_name: safe(stute.Name || stute.name),
    hengst_id: hengst.id,
    hengst_name: safe(hengst.Name || hengst.name),

    // Größe + Hauptdisziplin
    "Größe": sizeRange,
    "Hauptdisziplin": stute.Disziplin === hengst.Disziplin
      ? stute.Disziplin
      : { text: "Nein", style: "red" },

    // FK Gesamt
    "FK Gesamt": computeFK(stute, hengst, "FK Gesamt", "FK Gesamt", 15, 25),

    // Disziplinen
    "Disziplin 1": matchDisziplin(stute, hengst, 1),
    "Disziplin 2": matchDisziplin(stute, hengst, 2),
    "Disziplin 3": matchDisziplin(stute, hengst, 3),

    // FK 1 + Unterspalten
    "FK 1": computeFK(stute, hengst, "FK 1", "FK 1", 15, 25),
    "FK 1.1": computeFK(stute, hengst, "FK 1.1", "FK 1.1", 3, 5),
    "FK 1.2": computeFK(stute, hengst, "FK 1.2", "FK 1.2", 3, 5),
    "FK 1.3": computeFK(stute, hengst, "FK 1.3", "FK 1.3", 3, 5),
    "FK 1.4": computeFK(stute, hengst, "FK 1.4", "FK 1.4", 3, 5),
    "FK 1.5": computeFK(stute, hengst, "FK 1.5", "FK 1.5", 3, 5),

    // FK 2 + Unterspalten
    "FK 2": computeFK(stute, hengst, "FK 2", "FK 2", 15, 25),
    "FK 2.1": computeFK(stute, hengst, "FK 2.1", "FK 2.1", 3, 5),
    "FK 2.2": computeFK(stute, hengst, "FK 2.2", "FK 2.2", 3, 5),
    "FK 2.3": computeFK(stute, hengst, "FK 2.3", "FK 2.3", 3, 5),
    "FK 2.4": computeFK(stute, hengst, "FK 2.4", "FK 2.4", 3, 5),
    "FK 2.5": computeFK(stute, hengst, "FK 2.5", "FK 2.5", 3, 5),

    // FK 3 + Unterspalten
    "FK 3": computeFK(stute, hengst, "FK 3", "FK 3", 15, 25),
    "FK 3.1": computeFK(stute, hengst, "FK 3.1", "FK 3.1", 3, 5),
    "FK 3.2": computeFK(stute, hengst, "FK 3.2", "FK 3.2", 3, 5),
    "FK 3.3": computeFK(stute, hengst, "FK 3.3", "FK 3.3", 3, 5),
    "FK 3.4": computeFK(stute, hengst, "FK 3.4", "FK 3.4", 3, 5),
    "FK 3.5": computeFK(stute, hengst, "FK 3.5", "FK 3.5", 3, 5),

    // Traits (verwenden computeTrait)
    "Temperament": computeTraitTriple(stute, hengst, "Temperament"),
"Ausstrahlung": computeTraitTriple(stute, hengst, "Ausstrahlung"),
"Aufmerksamkeit": computeTraitTriple(stute, hengst, "Aufmerksamkeit"),
"Ausgeglichenheit": computeTraitTriple(stute, hengst, "Ausgeglichenheit"),
"Händelbarkeit": computeTraitTriple(stute, hengst, "Händelbarkeit"),
"Nervenstärke": computeTraitTriple(stute, hengst, "Nervenstärke"),
"Intelligenz": computeTraitTriple(stute, hengst, "Intelligenz"),
"Kopf": computeTraitTriple(stute, hengst, "Kopf"),
"Halsansatz": computeTraitTriple(stute, hengst, "Halsansatz"),
"Hals": computeTraitTriple(stute, hengst, "Hals"),
"Rücken": computeTraitTriple(stute, hengst, "Rücken"),
"Vorderbeine Stand": computeTraitTriple(stute, hengst, "Vorderbeine Stand"),
"Vorderbeine Boden": computeTraitTriple(stute, hengst, "Vorderbeine Boden"),
"Vorderbeine Zehen": computeTraitTriple(stute, hengst, "Vorderbeine Zehen"),
"Hinterbeine Stand": computeTraitTriple(stute, hengst, "Hinterbeine Stand"),
"Hinterbeine Boden": computeTraitTriple(stute, hengst, "Hinterbeine Boden"),
"Hinterbeine Zehen": computeTraitTriple(stute, hengst, "Hinterbeine Zehen"),


    // Interieur & Exterieur
    "Interieur": computeInterieur(stute, hengst),
    "Exterieur": computeExterieur(stute, hengst),

    // Inzucht + Größencheck (Platzhalter)
    "Inzuchtprüfung": inbreedingCheck(stute, hengst),
    "Größencheck": sizeRange !== "—" ? "Ja" : "—",

    // Genetik
    "Extension": combineAlleles(stute.Extension, hengst.Extension),
    "Agouti": combineAlleles(stute.Agouti, hengst.Agouti),
    "Cream/Pearl": combineAlleles(stute["Cream/Pearl"], hengst["Cream/Pearl"]),
    "Dun": combineAlleles(stute.Dun, hengst.Dun),
    "Champagne": combineAlleles(stute.Champagne, hengst.Champagne),
    "Mushroom": combineAlleles(stute.Mushroom, hengst.Mushroom),
    "Silver": combineAlleles(stute.Silver, hengst.Silver),
    "Graying": combineAlleles(stute.Graying, hengst.Graying),
    "Kit": combineAlleles(stute.Kit, hengst.Kit),
    "Overo": combineAlleles(stute.Overo, hengst.Overo),
    "Leopard": combineAlleles(stute.Leopard, hengst.Leopard),
    "Patn1": combineAlleles(stute.Patn1, hengst.Patn1),
    "Patn2": yesNoMaybe(stute.Patn2, hengst.Patn2),
    "Splashed White": combineAlleles(stute["Splashed White"], hengst["Splashed White"]),
    "Flaxen": flaxenCombine(stute.Flaxen, hengst.Flaxen),
    "Sooty": yesNoMaybe(stute.Sooty, hengst.Sooty),
    "Rabicano": yesNoMaybe(stute.Rabicano, hengst.Rabicano),
    "Pangare": yesNoMaybe(stute.Pangare, hengst.Pangare),
    "Dapples": yesNoMaybe(stute.Dapples, hengst.Dapples),
    "Rotfaktor": flaxenCombine(stute.Rotfaktor, hengst.Rotfaktor),

    // Platzhalter für später
    "Papiere": "kommt bald",
    "Zuchtschau": "kommt bald",
    "Papiere & Zuchtschau": "kommt bald",
  };
}