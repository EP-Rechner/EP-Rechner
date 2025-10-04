// pages/profil/[id].js
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Profil() {
  const router = useRouter();
  const { id } = router.query; // Profil-ID aus URL
  const [user, setUser] = useState(null); // eingeloggter User
  const [profileUser, setProfileUser] = useState(null); // betrachtetes Profil
  const [zuchten, setZuchten] = useState([]);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  const [newZucht, setNewZucht] = useState({ rasse: "", zuchtziel: "", zg: "" });

  // 🔹 Eingeloggten User holen
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    getUser();
  }, []);

 useEffect(() => {
  if (!router.isReady) return;

  const loadProfile = async () => {
    const currentId = router.query.id?.toString() || null;
    console.log("Profil-ID aus URL:", currentId);

    const { data: profiles, error: userErr } = await supabase
      .from("user_profile_info")
      .select("id, username, last_sign_in_at");

    if (userErr) {
      console.error("Fehler beim Laden:", userErr);
      return;
    }

    // Manuelles Filtern, um Typprobleme zu vermeiden
    const foundProfile = profiles.find((p) => p.id === currentId);
    console.log("Gefundenes Profil:", foundProfile);

    setProfileUser(foundProfile || null);

    const { data: zuchtData, error: zuchtErr } = await supabase
      .from("zuchten")
      .select("*")
      .eq("user_id", currentId)
      .order("created_at", { ascending: false });

    if (zuchtErr) console.error("Fehler beim Laden der Zuchten:", zuchtErr);
    setZuchten(zuchtData || []);
  };

  loadProfile();
}, [router.isReady, router.query.id]);



  // 🔹 Prüfen, ob eigenes Profil
  useEffect(() => {
    if (user && id) {
      setIsOwnProfile(user.id === id);
    }
  }, [user, id]);

  // 🔹 Neue Zucht speichern
  const addZucht = async () => {
    if (!newZucht.rasse) return;
    const { error } = await supabase.from("zuchten").insert([
      {
        user_id: user.id,
        rasse: newZucht.rasse,
        zuchtziel: newZucht.zuchtziel,
        zg: newZucht.zg,
      },
    ]);
    if (error) console.error(error);
    else {
      setNewZucht({ rasse: "", zuchtziel: "", zg: "" });
      const { data } = await supabase
        .from("zuchten")
        .select("*")
        .eq("user_id", user.id);
      setZuchten(data || []);
    }
  };

  // 🔹 Datum formatieren
  const formatDate = (dateString) => {
    if (!dateString) return "–";
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (!profileUser) return <p>Lade Profil...</p>;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">
  Profil von {profileUser?.username || "Unbekannt"}
</h1>

<p>
  <strong>Letzter Login:</strong>{" "}
  {formatDate(profileUser?.last_sign_in_at)}
</p>


      <section className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Zuchttabelle</h2>
        {isOwnProfile && (
          <div className="flex gap-2 mb-3">
            <input
              className="border p-1 rounded"
              placeholder="Rasse"
              value={newZucht.rasse}
              onChange={(e) =>
                setNewZucht({ ...newZucht, rasse: e.target.value })
              }
            />
            <input
              className="border p-1 rounded"
              placeholder="Zuchtziel"
              value={newZucht.zuchtziel}
              onChange={(e) =>
                setNewZucht({ ...newZucht, zuchtziel: e.target.value })
              }
            />
            <input
              className="border p-1 rounded"
              placeholder="ZG"
              value={newZucht.zg}
              onChange={(e) =>
                setNewZucht({ ...newZucht, zg: e.target.value })
              }
            />
            <button
              onClick={addZucht}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >
              Hinzufügen
            </button>
          </div>
        )}

        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100 text-center">
              <th className="border p-2">Rasse</th>
              <th className="border p-2">Zuchtziel</th>
              <th className="border p-2">ZG</th>
            </tr>
          </thead>
          <tbody>
            {zuchten.map((z, i) => (
              <tr key={i} className="text-center">
                <td className="border p-2">{z.rasse}</td>
                <td className="border p-2">{z.zuchtziel}</td>
                <td className="border p-2">{z.zg}</td>
              </tr>
            ))}
            {zuchten.length === 0 && (
              <tr>
                <td colSpan="3" className="text-center p-2 text-gray-500">
                  Keine Zuchten eingetragen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold mb-2">ZGs</h2>
        <p className="text-gray-500">Noch keine Daten.</p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold mb-2">ZPs</h2>
        <p className="text-gray-500">Noch keine Daten.</p>
      </section>
    </main>
  );
}
