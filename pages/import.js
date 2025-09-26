// pages/import.js
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { parsePferdepass, parsePraeKoer, parseFarbgene, parseDisziplinen } from '../lib/epParser'
import { mapToDbRow } from '../lib/mapToDb'

export default function ImportTest() {
  const [link, setLink] = useState('')
  const [pferdepass, setPferdepass] = useState('')
  const [praekoer, setPraeKoer] = useState('')
  const [farbgene, setFarbgene] = useState('')
  const [flaxen, setFlaxen] = useState(false)
  const [rot, setRot] = useState(false)

  // Disziplinen
  const [d1, setD1] = useState('')
  const [t1, setT1] = useState('')
  const [d2, setD2] = useState('')
  const [t2, setT2] = useState('')
  const [d3, setD3] = useState('')
  const [t3, setT3] = useState('')

  // Freie Eingaben
  const [zucht, setZucht] = useState('')
  const [zuchtziel, setZuchtziel] = useState('')
  const [notizen, setNotizen] = useState('')
  const [hengstOrt, setHengstOrt] = useState('')

  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleParse = () => {
    setError(null)
    try {
      const pp = parsePferdepass(pferdepass)
      if (!pp.ok) throw new Error(pp.error || 'Pferdepass konnte nicht gelesen werden')

      const pk = parsePraeKoer(praekoer)

      // Farbgene: übergeben auch pferdepassText, damit untestbare Gene erkannt werden
      const fg = parseFarbgene(farbgene, { 
        flaxenManual: flaxen, 
        rotManual: rot, 
        pferdepassText: pferdepass 
      })

      const dis = parseDisziplinen(
        { primary: d1 || '-', second: d2 || '-', third: d3 || '-' },
        { primaryText: t1, secondText: t2, thirdText: t3 },
        t1 + "\n" + t2 + "\n" + t3   // oder den kompletten Trainingsseiten-Text, falls du den hast
      )

      const combined = {
        link: link || null,
        ...pp.data,
        praekoer: pk.data || null,
        farbgene: fg.data || null,
        disziplinen: dis.data || null
      }

      setResult(combined)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSubmit = async () => {
  setError(null)
  setSaving(true)
  try {
    // --- Schritt 1: Parsen ---
    const pp = parsePferdepass(pferdepass)
    if (!pp.ok) throw new Error(pp.error || 'Pferdepass konnte nicht gelesen werden')

    const pk = parsePraeKoer(praekoer)
    const fg = parseFarbgene(farbgene, { 
      flaxenManual: flaxen, 
      rotManual: rot, 
      pferdepassText: pferdepass 
    })

    const dis = parseDisziplinen(
      { primary: d1 || '-', second: d2 || '-', third: d3 || '-' },
      { primaryText: t1, secondText: t2, thirdText: t3 },
      t1 + "\n" + t2 + "\n" + t3
    )

    const combined = {
      link: link || null,
      ...pp.data,
      praekoer: pk.data || null,
      farbgene: fg.data || null,
      disziplinen: dis.data || null
    }

    // --- Schritt 2: Speichern ---
    const user = await supabase.auth.getUser()
    const userId = user.data.user?.id
    if (!userId) throw new Error('Kein eingeloggter User gefunden')

    const row = mapToDbRow(combined, userId, {
      zucht,
      zuchtziel,
      notizen,
      hengstOrt,
      link
    })

    const table = combined.geschlecht === 'Hengst' ? 'Hengste' : 'Stuten'

    const { error: insertError } = await supabase.from(table).insert(row)
    if (insertError) throw insertError

    alert(`Pferd erfolgreich gespeichert in ${table}!`)

    // --- Formular leeren ---
    setLink('')
    setPferdepass('')
    setPraeKoer('')
    setFarbgene('')
    setFlaxen(false)
    setRot(false)
    setD1('')
    setT1('')
    setD2('')
    setT2('')
    setD3('')
    setT3('')
    setZucht('')
    setZuchtziel('')
    setNotizen('')
    setHengstOrt('')

  } catch (e) {
    setError(e.message)
  } finally {
    setSaving(false)
  }
}
const handleReset = () => {
  setLink('');
  setPferdepass('');
  setPraeKoer('');
  setFarbgene('');
  setFlaxen(false);
  setRot(false);

  // Disziplinen
  setD1('');
  setT1('');
  setD2('');
  setT2('');
  setD3('');
  setT3('');

  // Freie Eingaben
  setZucht('');
  setZuchtziel('');
  setNotizen('');
  setHengstOrt('');

  setResult(null);
  setError(null);
};


  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>
      <h1>Pferd importieren</h1>

      <label>Link (optional):</label>
      <input value={link} onChange={e=>setLink(e.target.value)} style={{width:'100%', marginBottom:10}} />

      <label>Pferdepass (Pflicht, copy-paste):</label>
      <textarea value={pferdepass} onChange={e=>setPferdepass(e.target.value)} rows={14} style={{width:'100%', marginBottom:10}} />

      <label>Prämierung / Körung (optional, copy-paste):</label>
      <textarea value={praekoer} onChange={e=>setPraeKoer(e.target.value)} rows={8} style={{width:'100%', marginBottom:10}} />

      <label>Farbgene (optional, copy-paste):</label>
      <textarea value={farbgene} onChange={e=>setFarbgene(e.target.value)} rows={10} style={{width:'100%', marginBottom:10}} />

      <div style={{ display:'flex', gap:20, margin:'10px 0' }}>
        <label><input type="checkbox" checked={flaxen} onChange={e=>setFlaxen(e.target.checked)} /> Flaxen-Träger (manuell)</label>
        <label><input type="checkbox" checked={rot} onChange={e=>setRot(e.target.checked)} /> Rot-Träger (manuell)</label>
      </div>

      <hr />

      <select value={d1} onChange={e=>setD1(e.target.value)}>
  <option value="">Disziplin 1 auswählen</option>
  <option value="Barock">Barock</option>
  <option value="Cross Country">Cross Country</option>
  <option value="Distanz">Distanz</option>
  <option value="Dressur">Dressur</option>
  <option value="Fahren">Fahren</option>
  <option value="Galopprennen">Galopprennen</option>
  <option value="Holzrücken">Holzrücken</option>
  <option value="Mehrgang">Mehrgang</option>
  <option value="Reining">Reining</option>
  <option value="Springen">Springen</option>
  <option value="Trail">Trail</option>
</select>
<textarea placeholder="Trainingsseite (copy-paste)" value={t1} onChange={e=>setT1(e.target.value)} rows={6} />

<select value={d2} onChange={e=>setD2(e.target.value)}>
  <option value="">Disziplin 2 auswählen</option>
  <option value="Barock">Barock</option>
  <option value="Cross Country">Cross Country</option>
  <option value="Distanz">Distanz</option>
  <option value="Dressur">Dressur</option>
  <option value="Fahren">Fahren</option>
  <option value="Galopprennen">Galopprennen</option>
  <option value="Holzrücken">Holzrücken</option>
  <option value="Mehrgang">Mehrgang</option>
  <option value="Reining">Reining</option>
  <option value="Springen">Springen</option>
  <option value="Trail">Trail</option>
</select>
<textarea placeholder="Trainingsseite" value={t2} onChange={e=>setT2(e.target.value)} rows={6} />

<select value={d3} onChange={e=>setD3(e.target.value)}>
  <option value="">Disziplin 3 auswählen</option>
  <option value="Barock">Barock</option>
  <option value="Cross Country">Cross Country</option>
  <option value="Distanz">Distanz</option>
  <option value="Dressur">Dressur</option>
  <option value="Fahren">Fahren</option>
  <option value="Galopprennen">Galopprennen</option>
  <option value="Holzrücken">Holzrücken</option>
  <option value="Mehrgang">Mehrgang</option>
  <option value="Reining">Reining</option>
  <option value="Springen">Springen</option>
  <option value="Trail">Trail</option>
</select>
<textarea placeholder="Trainingsseite" value={t3} onChange={e=>setT3(e.target.value)} rows={6} />


      <hr />

      <h3>Weitere Angaben</h3>
      <label>Zucht (optional):</label>
      <input value={zucht} onChange={e=>setZucht(e.target.value)} style={{width:'100%', marginBottom:10}} />

      <label>Zuchtziel (optional):</label>
      <input value={zuchtziel} onChange={e=>setZuchtziel(e.target.value)} style={{width:'100%', marginBottom:10}} />

      <label>Notizen (optional):</label>
      <textarea value={notizen} onChange={e=>setNotizen(e.target.value)} rows={4} style={{width:'100%', marginBottom:10}} />

      <label>Standort Hengst (nur wenn Hengst):</label>
      <input value={hengstOrt} onChange={e=>setHengstOrt(e.target.value)} style={{width:'100%', marginBottom:10}} placeholder="Eigener / ZG / HS / frei" />

{error && <p style={{ color:'red' }}>{error}</p>}

<div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
  <button onClick={handleSubmit} disabled={saving}>
    {saving ? 'Speichern...' : 'Eintragen'}
  </button>

  <button
    type="button"
    onClick={handleReset}
    style={{
      background: '#e74c3c',
      color: '#fff',
      border: 'none',
      padding: '8px 12px',
      borderRadius: 4,
      cursor: 'pointer'
    }}
  >
    Formular leeren
  </button>
</div>
</div>
  );
}
