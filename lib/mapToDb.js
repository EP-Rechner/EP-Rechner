// lib/mapToDb.js
// Mapped das Ergebnis der Parser in die Spalten deiner Supabase-Tabellen

export function mapToDbRow(parsed, userId, extras = {}) {
  if (!parsed) throw new Error("Keine Daten zum Mappen")

  const {
    nameIdCombined,
    besitzer,
    rasse,
    stockmass_cm,
    statur,
    geschlecht,
    interieur,
    exterieur,
    beine,
    eltern,
    praekoer,
    farbgene,
    disziplinen,
    rasseanteile,
    kopfabzeichen,
    beinabzeichen,
    deckbereit,
  } = parsed

  const row = {
    // Basis
    user_id: userId,
    Name: nameIdCombined || null,
    Notizen: extras.notizen || null,
    Besitzer: besitzer || null,
    Rasse: rasse || null,
    Größe: stockmass_cm || null,
    Zucht: extras.zucht || null,
    Zuchtziel: extras.zuchtziel || null,

    // Disziplinen
    Disziplin: extras.customDisziplin || disziplinen?.disziplin || null,
    "FK Gesamt": disziplinen?.gesFK || 0,

    "Disziplin 1": disziplinen?.disziplinenTK?.[0] || null,
    "FK 1": disziplinen?.fks?.[0]?.[0] || 0,
    "FK 1.1": disziplinen?.fks?.[0]?.[1] || 0,
    "FK 1.2": disziplinen?.fks?.[0]?.[2] || 0,
    "FK 1.3": disziplinen?.fks?.[0]?.[3] || 0,
    "FK 1.4": disziplinen?.fks?.[0]?.[4] || 0,
    "FK 1.5": disziplinen?.fks?.[0]?.[5] || 0,

    "Disziplin 2": disziplinen?.disziplinenTK?.[1] || null,
    "FK 2": disziplinen?.fks?.[1]?.[0] || 0,
    "FK 2.1": disziplinen?.fks?.[1]?.[1] || 0,
    "FK 2.2": disziplinen?.fks?.[1]?.[2] || 0,
    "FK 2.3": disziplinen?.fks?.[1]?.[3] || 0,
    "FK 2.4": disziplinen?.fks?.[1]?.[4] || 0,
    "FK 2.5": disziplinen?.fks?.[1]?.[5] || 0,

    "Disziplin 3": disziplinen?.disziplinenTK?.[2] || null,
    "FK 3": disziplinen?.fks?.[2]?.[0] || 0,
    "FK 3.1": disziplinen?.fks?.[2]?.[1] || 0,
    "FK 3.2": disziplinen?.fks?.[2]?.[2] || 0,
    "FK 3.3": disziplinen?.fks?.[2]?.[3] || 0,
    "FK 3.4": disziplinen?.fks?.[2]?.[4] || 0,
    "FK 3.5": disziplinen?.fks?.[2]?.[5] || 0,

    // Interieur
    Temperament: interieur?.temperament || null,
    Ausstrahlung: interieur?.ausstrahlung || null,
    Aufmerksamkeit: interieur?.aufmerksam || null,
    Ausgeglichenheit: interieur?.ausgeglichen || null,
    Händelbarkeit: interieur?.haendelbar || null,
    Nervenstärke: interieur?.nervenstark || null,
    Intelligenz: interieur?.intelligent || null,

    // Exterieur
    Kopf: exterieur?.kopf || null,
    Halsansatz: exterieur?.halsansatz || null,
    Hals: exterieur?.hals || null,
    Rücken: exterieur?.ruecken || null,

    // Beine
    "Vorderbeine Stand": beine?.vStand || null,
    "Vorderbeine Boden": beine?.vBoden || null,
    "Vorderbeine Zehen": beine?.vZehen || null,
    "Hinterbeine Stand": beine?.hStand || null,
    "Hinterbeine Boden": beine?.hBoden || null,
    "Hinterbeine Zehen": beine?.hZehen || null,

    // Bewertungen
    Interieur: praekoer?.interieur || null,
    Exterieur: praekoer?.exterieur || null,
    ...(geschlecht === "Stute"
      ? { Prämierung: praekoer?.note || null }
      : { Körung: praekoer?.note || null }),

    Mutter: eltern?.mutter || null,
    Vater: eltern?.vater || null,

    // Farbgene
    Extension: farbgene?.lines?.[0] || null,
    Agouti: farbgene?.lines?.[1] || null,
    "Cream/Pearl": farbgene?.lines?.[2] || null,
    Dun: farbgene?.lines?.[3] || null,
    Champagne: farbgene?.lines?.[4] || null,
    Mushroom: farbgene?.lines?.[5] || null,
    Silver: farbgene?.lines?.[6] || null,
    Graying: farbgene?.lines?.[7] || null,
    Kit: farbgene?.lines?.[8] || null,
    Overo: farbgene?.lines?.[9] || null,
    Leopard: farbgene?.lines?.[10] || null,
    Patn1: farbgene?.lines?.[11] || null,
    Patn2: farbgene?.untestable?.patn2 || "Nein",
    "Splashed White": farbgene?.lines?.[12] || null,
    Flaxen: farbgene?.untestable?.flaxen || "Nein",
    Rotfaktor: farbgene?.untestable?.rotfaktor || "Nein",
    Sooty: farbgene?.untestable?.sooty || "Nein",
    Rabicano: farbgene?.untestable?.rabicano || "Nein",
    Dapples: farbgene?.untestable?.dapples || "Nein",
    Pangare: farbgene?.untestable?.pangare || "Nein",

    Kopfabzeichen: kopfabzeichen || "Nein",
    Beinabzeichen: beinabzeichen || "Nein",

    // Rassenanteile
    "American Paint Horse": getBreed(rasseanteile, "American Paint Horse"),
    "American Quarter Horse": getBreed(rasseanteile, "American Quarter Horse"),
    Appaloosa: getBreed(rasseanteile, "Appaloosa"),
    "Arabisches Vollblut": getBreed(rasseanteile, "Arabisches Vollblut"),
    "Cape Boerperd": getBreed(rasseanteile, "Cape Boerperd"),
    Clydesdale: getBreed(rasseanteile, "Clydesdale"),
    "Deutsches Reitpony": getBreed(rasseanteile, "Deutsches Reitpony"),
    "Englisches Vollblut": getBreed(rasseanteile, "Englisches Vollblut"),
    Hannoveraner: getBreed(rasseanteile, "Hannoveraner"),
    Holsteiner: getBreed(rasseanteile, "Holsteiner"),
    Isländer: getBreed(rasseanteile, "Isländer"),
    Knabstrupper: getBreed(rasseanteile, "Knabstrupper"),
    Lipizzaner: getBreed(rasseanteile, "Lipizzaner"),
    "Mangalarga Marchador": getBreed(rasseanteile, "Mangalarga Marchador"),
    "Norwegisches Fjordpferd": getBreed(rasseanteile, "Norwegisches Fjordpferd"),
    Oldenburger: getBreed(rasseanteile, "Oldenburger"),
    "Pony of the Americas": getBreed(rasseanteile, "Pony of the Americas"),
    "Pura Raza Española": getBreed(rasseanteile, "Pura Raza Española"),
    "Puro Sangue Lusitano": getBreed(rasseanteile, "Puro Sangue Lusitano"),
    Shetlandpony: getBreed(rasseanteile, "Shetlandpony"),
    "Shire Horse": getBreed(rasseanteile, "Shire Horse"),
    Trakehner: getBreed(rasseanteile, "Trakehner"),

    // Rest
    Statur: statur || null,
    Link: parsed.link || extras.link || null,

    // Nur Hengste
    ...(geschlecht === "Hengst"
      ? {
          "ZG/HS/Eigener": extras.hengstOrt || null,
          Deckbereit: deckbereit || null,
        }
      : {}),
  }

  return row
}

function getBreed(rasseanteile, name) {
  const found = rasseanteile?.find((r) => r.breed === name)
  return found ? found.percent : 0
}
