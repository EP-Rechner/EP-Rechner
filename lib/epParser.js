// lib/epParser.js

// -------------------- Helpers --------------------
const safe = (m, i = 1) => (m && m[i] != null ? m[i].toString().trim() : null);
const toNumDE = (s) => (s ? parseFloat(s.replace(',', '.')) : null);

// -------------------- Hauptparser --------------------
export function parsePferdepass(pferdepassText, opts = {}) {
  if (!pferdepassText || typeof pferdepassText !== 'string') {
    return { ok: false, error: 'Kein Pferdepass-Text', data: null };
  }

  // 1) Name + ID
  let name = null, id = null;
  const nm = pferdepassText.match(/Zuchtname:\s*(.*?)(?:\s*\( (?:Zuchtname ändern|Namen geben)\))?\n/);
  name = safe(nm, 1);
  const idm = pferdepassText.match(/\nID:\s*(\d+)\s*\n/);
  id = safe(idm, 1);
  if (!name) {
    const fm = pferdepassText.match(/Forum\n(.*)\n/);
    name = safe(fm, 1);
  }
  const nameIdCombined = name && id ? `${name} (ID: ${id})` : name || null;

  // 2) Besitzer
  const besM = pferdepassText.match(/(?:geboren bei|verkauft an|ersteigert von|adoptiert von|importiert von)\s+([^\n.]+)\.\s*\n+Impressum/);
  const besitzer = safe(besM, 1);

  // 3) Rasse & Statur
  const rasse = safe(
    pferdepassText.match(/\nRasse:\s*(.*?)(?:\s+zum Zuchtverband)?(?:\s+mit Papieren)?(?:\s*\[.*?\]|\s*\(.*?\))*\s*\n/),
    1
  );
  const statur = safe(
    pferdepassText.match(/\nStatur:\s*(.*?)(?:\s*\(alte Grafik(?:\s+zum Änderungsformular)?\))?\s*\n/),
    1
  );

  // 4) Abzeichen
  const abz = safe(pferdepassText.match(/\nAbzeichen:\s*(.*)\n/), 1) || '';
  const kopfabzeichen = /Kopf/i.test(abz) ? 'Ja' : 'Nein';
  const beinabzeichen = /Bein/i.test(abz) ? 'Ja' : 'Nein';

  // 5) Geschlecht + HS + Deckbereit
  const geschlecht = safe(pferdepassText.match(/\nGeschlecht:\s*(\w+)/), 1);
  const hengststation = pferdepassText.includes('verkauft an Hengststation.');
  let deckbereit = null;

  if (geschlecht === 'Hengst') {
    const alterM = pferdepassText.match(/\nAlter:\s*(\d{1,2})/);
    const alter = alterM ? parseInt(alterM[1], 10) : null;
    if (alter != null && alter < 3) {
      if (hengststation) {
        if (pferdepassText.includes('geboren bei')) {
          const gebJ = pferdepassText.match(/(\d{4}) geboren bei/);
          deckbereit = gebJ ? (parseInt(gebJ[1], 10) + 3) : null;
        } else {
          const mon = safe(pferdepassText.match(/(\w+)\s+(\d{4}) importiert von/), 1);
          const j = safe(pferdepassText.match(/(\w+)\s+(\d{4}) importiert von/), 2);
          if (mon && j) {
            const first6 = ['Januar','Februar','März','April','Mai','Juni'];
            deckbereit = first6.includes(mon) ? (parseInt(j,10)+2) : (parseInt(j,10)+3);
          }
        }
      } else {
        const gJ = safe(pferdepassText.match(/\nGeburtsdatum:\s*.*?(\d{4})\s*\n/), 1);
        deckbereit = gJ ? (parseInt(gJ,10)+3) : null;
      }
    } else {
      deckbereit = 'Ja';
    }
  }

  // 6) Stockmaß
  let groesse = null;
  const gm = pferdepassText.match(/\nStockmaß:\s*(\d{2,3}),\d\s*cm(?:\s*\(erwartetes Endmaß:\s*(\d{2,3})\s*cm\))?\s*\n/);
  if (gm) groesse = gm[2] ? parseInt(gm[2],10) : parseInt(gm[1],10);

  // 7) Interieur
  const temperament   = safe(pferdepassText.match(/\n(?: {4})?(.*)\s+Temperament\n/), 1);
  const ausstrahlung  = safe(pferdepassText.match(/\n(?: {4})?(.*)\s+Ausstrahlung\n/), 1);
  const aufmerksam    = safe(pferdepassText.match(/\n(?: {4})?(.*)\s+aufmerksam\n/), 1);
  const ausgeglichen  = safe(pferdepassText.match(/\n(?: {4})?(.*)\s+ausgeglichen\n/), 1);
  const haendelbar    = safe(pferdepassText.match(/\n(?: {4})?(.*)\s+händelbar\n/), 1);
  const nervenstark   = safe(pferdepassText.match(/\n(?: {4})?(.*)\s+nervenstark\n/), 1);
  const intelligent   = safe(pferdepassText.match(/\n(?: {4})?(.*)\s+intelligent\n/), 1);

  // 8) Exterieur
  const kopf        = safe(pferdepassText.match(/\nDer Kopf ist (.*)\.\n/), 1);
  const halsansatz  = safe(pferdepassText.match(/\nDer Halsansatz ist (.*)\.\n/), 1);
  const hals        = safe(pferdepassText.match(/\nDer Hals ist (.*)\.\n/), 1);
  const ruecken     = safe(pferdepassText.match(/\nDer Rücken ist (.*)\.\n/), 1);

  // 9) Beine
  const legs = computeLegs(pferdepassText);

  // 10) Eltern
  const { vater, mutter } = extractParentsFromStammbaum(pferdepassText, name);

  // 11) Rasseanteile
  const rasseanteile = parseRasseanteile(pferdepassText);

  return {
    ok: true,
    error: null,
    data: {
      name,
      id,
      nameIdCombined,
      besitzer,
      rasse,
      statur,
      kopfabzeichen,
      beinabzeichen,
      geschlecht,
      hengststation,
      deckbereit,
      stockmass_cm: groesse ?? null,
      interieur: { temperament, ausstrahlung, aufmerksam, ausgeglichen, haendelbar, nervenstark, intelligent },
      exterieur: { kopf, halsansatz, hals, ruecken },
      beine: legs,
      eltern: { vater, mutter },
      rasseanteile
    }
  };
}

// -------------------- Eltern robust extrahieren --------------------
function extractParentsFromStammbaum(txt, horseName) {
  const m = txt.match(/Stammbaum([\s\S]*?)(?:\n\s*erweiterten Stammbaum anzeigen|\n{2,}|$)/i);
  if (!m) return { vater: null, mutter: null };

  const rawLines = m[1].split('\n').map(s => s.trim()).filter(Boolean);
  const isBreedLine = (s) => /^\(.*\)$/.test(s);

  let idx = -1;
  if (horseName) idx = rawLines.findIndex(l => l === horseName);
  if (idx < 0) {
    for (let i = 0; i < rawLines.length - 1; i++) {
      const cur = rawLines[i];
      const next = rawLines[i + 1];
      if (cur !== 'von' && cur !== 'aus' && !isBreedLine(cur) && (next === 'von' || next === 'aus')) {
        idx = i;
        break;
      }
    }
  }
  if (idx < 0) return { vater: null, mutter: null };

  let vater = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (rawLines[i] === 'von' && i + 1 < rawLines.length) {
      vater = rawLines[i + 1];
      break;
    }
  }

  let mutter = null;
  for (let i = idx + 1; i < rawLines.length - 1; i++) {
    if (rawLines[i] === 'aus' && i + 1 < rawLines.length) {
      mutter = rawLines[i + 1];
      break;
    }
  }

  return { vater, mutter };
}

// -------------------- Beine --------------------
function computeLegs(txt) {
  const vStand = safe(txt.match(/\nDie Vorderbeine sind (.*rückständig|.*vorständig)/), 1) || 'gut';
  const vBoden = safe(txt.match(/\nDie Vorderbeine sind (?:.*(?: und |, ))?(.*bodeneng|.*bodenweit)/), 1) || 'gut';
  const vZehen = safe(txt.match(/\nDie Vorderbeine sind (?:.* und )?(.*zeheneng|.*zehenweit)\.\n/), 1) || 'gut';
  const hStand = safe(txt.match(/\nDie Hinterbeine sind (.*rückständig|.*vorständig)/), 1) || 'gut';
  const hBoden = safe(txt.match(/\nDie Hinterbeine sind (?:.*(?: und |, ))?(.*bodeneng|.*bodenweit)/), 1) || 'gut';
  const hZehen = safe(txt.match(/\nDie Hinterbeine sind (?:.* und )?(.*zeheneng|.*zehenweit)\.\n/), 1) || 'gut';
  return { vStand, vBoden, vZehen, hStand, hBoden, hZehen };
}

// -------------------- Rasseanteile --------------------
function parseRasseanteile(txt) {
  const block = txt.match(/Rasseanteile:\n([\s\S]*?)\n\n/);
  if (!block) return [];
  const lines = block[1].split('\n').map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const pm = line.match(/^\s*([<\d.,]+)%\s+(.*)$/);
    if (!pm) continue;
    let p = pm[1];
    const breed = pm[2].trim();
    let val;
    if (p.startsWith('<')) val = 0.99;
    else val = parseFloat(p.replace(',', '.'));
    out.push({ breed, percent: val });
  }
  return out;
}

// -------------------- Prämierung/Körung --------------------
export function parsePraeKoer(text) {
  if (!text) return { ok: true, data: null };
  const ex = toNumDE(safe(text.match(/Bewertung des Exterieurs:\s*(\d{1,2},\d)/), 1));
  const intr = toNumDE(safe(text.match(/Bewertung des Interieurs:\s*(\d{1,2},\d)/), 1));
  const note = toNumDE(safe(text.match(/Gesamtnote:\s*(\d{1,2},\d)/), 1));
  return { ok: true, data: { exterieur: ex, interieur: intr, note } };
}

// -------------------- Farbgene --------------------
export function parseFarbgene(
  text,
  opts = { flaxenManual: false, rotManual: false, pferdepassText: '' }
) {
  if (!text) return { ok: true, data: null };

  const m = text.match(/Extension[\s\S]+Splashed White[\s\S]+?\n/i);
  if (!m) return { ok: true, data: null };

  let cleaned = m[0]
    .replace(/.*\n(?=[\w+]+\/[\w+]+|(Leopard )?nicht getestet)/g, '')
    .replace(/   /g, '\n')
    .replace(/(Patn1 )?(Leopard )?nicht getestet/g, '-');

  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
  const rechnerLines = cleaned.replace(/\b[a-z]+/g, 'n').split('\n').map(s => s.trim());

  let agoutiShort = (rechnerLines[1] || '').replace(/At/g, 'T').replace(/A\+/g, '+');
  if (agoutiShort.startsWith('+')) agoutiShort = `'${agoutiShort}`;
  const roanShort = (rechnerLines[8] || '').replace(/Rn/g, 'Ro');

  // jetzt mit pferdepassText statt text
  const untestable = computeUntestableFromPferdepassLike(opts.pferdepassText || '', opts);

  return {
    ok: true,
    data: {
      lines,
      rechnerLines,
      filterbar: { agoutiShort, roanShort },
      untestable
    }
  };
}

// -------------------- Untestable Farben/Zeichnungen --------------------
function computeUntestableFromPferdepassLike(pferdepassText, opts) {
  const out = {
    flaxen: 'Nein',
    sooty: 'Nein',
    rabicano: 'Nein',
    pangare: 'Nein',
    dapples: 'Nein',
    rotfaktor: 'Nein',
    patn2: 'Nein'
  };

  const farbeLine = (pferdepassText.match(/Farbe:\s*(.*)/i) || [])[1] || '';
  const zeichnungLine = (pferdepassText.match(/Zeichnung:\s*(.*)/i) || [])[1] || '';

  if (/Flaxen|Licht/i.test(farbeLine)) out.flaxen = 'Zeiger';
  if (/Rotfuchs|Rotbrauner|Lichtrotfuchs/i.test(farbeLine)) out.rotfaktor = 'Zeiger';
  if (/Sooty/i.test(farbeLine)) out.sooty = 'Ja';
  if (/Rabicano/i.test(zeichnungLine)) out.rabicano = 'Ja';
  if (/Pangare/i.test(farbeLine)) out.pangare = 'Ja';
  if (/Dapples/i.test(farbeLine)) out.dapples = 'Ja';
  if (/Blanket with Spots|Snowcap/i.test(zeichnungLine)) out.patn2 = 'Ja';

  if (opts?.flaxenManual && out.flaxen === 'Nein') out.flaxen = 'Träger';
  if (opts?.rotManual && out.rotfaktor === 'Nein') out.rotfaktor = 'Träger';

  return out;
}

// -------------------- Disziplinen / FKs / TKs --------------------
export function parseDisziplinen(selection, texts) {
  const dArr = [selection?.primary || '-', selection?.second || '-', selection?.third || '-'];
  const tArr = [texts?.primaryText || '', texts?.secondText || '', texts?.thirdText || ''];

  const fks = dArr.map((d, i) => getFKs(d, tArr[i]));
  const tks = fks.map(fk => getTK(fk));

  let disziplin = selection?.combined || '';
  if (!disziplin) {
    const has = (x) => dArr.includes(x);
    if (has('Dressur') && has('Springen') && has('Cross Country')) disziplin = 'Vielseitigkeit';
    else if (has('Barock') && has('Trail')) disziplin = 'Working Equitation';
    else if (has('Galopprennen') && has('Cross Country')) disziplin = 'Hindernisrennen';
    else if (has('Distanz') && has('Fahren')) disziplin = 'Distanzfahren';
    else if (has('Reining') && has('Trail')) disziplin = 'Superhorse';
    else if (dArr[1] !== '-' || dArr[2] !== '-') disziplin = 'andere Kombidisziplin';
    else disziplin = dArr[0];
  }

  const dWithTK = dArr.map((d, i) => (d === '-' ? '-' : `${d} TK ${tks[i]}`));
  const gesFK = fks.reduce((acc, fk) => acc + Number(fk[0] || 0), 0);

  return {
    ok: true,
    data: { disziplin, disziplinenTK: dWithTK, fks, tks, gesFK }
  };
}

function getFKs(begabung, text) {
  if (!begabung || begabung === '-' || !text) return [0, 0, 0, 0, 0, 0];
  const re = new RegExp(
    "\\n" + escapeRegex(begabung) + " - .*(Potenzial: Turnierklasse \\d\\d?|kein Turnierpotenzial)( \\((\\d\\d?\\d?) Punkte\\))?" +
    "\\n(\\n.*?Beritt.*\\n)?(.*?Trainingseinheiten.*\\n)?(.*?Lohn.*\\n)?(\\n.*Auftrag.*\\n.*\\n.*\\n)?( ?an Turnier teilnehmen.*\\n)?" +
    "(\\n ?an Jungpferd-Meisterschaft teilnehmen\\n)?(\\n.*Reitanlage.*\\n)?(Grundlagen\\n?.*\\/.*|.*\\/.*Grundlagen)(\\n|\\D*\\n)?.* \\/ (\\d\\d?\\d?).*\\n" +
    "(\\n|\\D*\\n)?.* \\/ (\\d\\d?\\d?).*\\n(\\n|\\D*\\n)?.* \\/ (\\d\\d?\\d?).*\\n(\\n|\\D*\\n)?.* \\/ (\\d\\d?\\d?).*\\n(\\n|\\D*\\n)?.* \\/ (\\d\\d?\\d?).*\\n",
    "s"
  );
  const m = text.match(re);
  if (!m) return [0, 0, 0, 0, 0, 0];
  const arr = [m[3], m[13], m[15], m[17], m[19], m[21]].map(x => (x ? Number(x) : 0));
  if (!arr[0]) arr[0] = arr.slice(1).reduce((a, b) => a + b, 0);
  return arr;
}

function getTK(fkArray) {
  if (!fkArray || fkArray.length === 0) return '';
  const numeric = fkArray.filter(n => typeof n === 'number' && isFinite(n));
  if (!numeric.length) return '';
  const min = Math.min(...numeric);
  let tk = Math.floor(min / 10);
  if (min % 10 !== 0) tk++;
  return tk;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
