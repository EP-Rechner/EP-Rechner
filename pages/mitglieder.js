import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Mitglieder() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔹 Eingeloggten User laden
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/login"); // Weiterleitung, wenn nicht eingeloggt
        return;
      }
      setUser(data.user);
    };
    getUser();
  }, [router]);

  // 🔹 Mitglieder aus der View laden
  useEffect(() => {
    const loadMitglieder = async () => {
      const { data, error } = await supabase
        .from("user_profile_info")
        .select("id, username, last_sign_in_at")
        .order("username", { ascending: true });

      if (error) {
        console.error("Fehler beim Laden der Mitglieder:", error);
        return;
      }

      setMitglieder(data || []);
      setLoading(false);
    };

    loadMitglieder();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "–";
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading) return <p>Lade Mitglieder...</p>;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Mitgliederübersicht</h1>

      {mitglieder.length === 0 ? (
        <p className="text-gray-500">Keine Mitglieder gefunden.</p>
      ) : (
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100 text-center">
              <th className="border p-2">Username</th>
              <th className="border p-2">Letzter Login</th>
            </tr>
          </thead>
          <tbody>
            {mitglieder.map((m) => (
              <tr key={m.id} className="text-center hover:bg-gray-50">
                <td className="border p-2 text-blue-600 underline">
                  <Link href={`/profil/${m.id}`}>{m.username || "Unbekannt"}</Link>
                </td>
                <td className="border p-2">{formatDate(m.last_sign_in_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
