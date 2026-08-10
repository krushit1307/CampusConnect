import { useParams } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface Club {
  name: string;
  description: string | null;
  mission: string | null;
  vision: string | null;
}

export default function PrintableCharter() {
  const { slug } = useParams();
  const [club, setClub] = useState<Club | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data } = await supabase
        .from("clubs")
        .select("name,description,mission,vision")
        .eq("slug", slug)
        .single();

      if (data) setClub(data);
    }

    load();
  }, [slug]);

  if (!club) return <div>Loading...</div>;

  return (
    <main
      style={{
        maxWidth: 800,
        margin: "40px auto",
        padding: 40,
        fontFamily: "Arial",
        lineHeight: 1.7,
      }}
    >
      <h1>{club.name}</h1>

      <hr />

      <h2>Description</h2>
      <p>{club.description || "No description available."}</p>

      <h2>Mission</h2>
      <p>{club.mission || "Not specified."}</p>

      <h2>Vision</h2>
      <p>{club.vision || "Not specified."}</p>
    </main>
  );
}
