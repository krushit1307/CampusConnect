import { createClient } from "@/lib/supabase/client";
import * as Y from "yjs";

export async function fetchNoteSnapshot(groupId: string): Promise<Uint8Array | null> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("group_notes")
      .select("yjs_state")
      .eq("group_id", groupId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching note snapshot:", error);
      return null;
    }

    if (data?.yjs_state) {
      // Decode hex string back to Uint8Array (Postgres BYTEA comes back as hex in some clients, or base64)
      // Supabase JS client usually returns bytea as a hex string like '\x0123...' or just '0123...'
      // Let's check format. Often it is a hex string, or base64 string.
      // But actually, it's safer to use base64 for yjs state in the DB if we handle it as text, or let supabase handle bytea.
      // Assuming it's base64 encoded if we saved it that way, or let's use base64 for simplicity in the DB (TEXT column)?
      // The migration used BYTEA. Supabase JS returns BYTEA as a hex string starting with \x.

      const hexString = data.yjs_state.startsWith("\\x") ? data.yjs_state.slice(2) : data.yjs_state;
      if (!hexString) return null;

      const bytes = new Uint8Array(Math.ceil(hexString.length / 2));
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hexString.substring(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    }

    return null;
  } catch (err) {
    console.error("fetchNoteSnapshot failed:", err);
    return null;
  }
}

export async function saveNoteSnapshot(groupId: string, doc: Y.Doc): Promise<boolean> {
  const supabase = createClient();
  try {
    const update = Y.encodeStateAsUpdate(doc);

    // Convert Uint8Array to hex string for BYTEA column
    const hex = Array.from(update)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const hexString = `\\x${hex}`;

    // Get plain text content for fallback/searchability if needed (optional)
    const content = ""; // We can extract text if we want, but YJS state is what matters.

    const { error } = await supabase.from("group_notes").upsert(
      {
        group_id: groupId,
        yjs_state: hexString,
        content: content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "group_id" },
    );

    if (error) {
      console.error("Error saving note snapshot:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("saveNoteSnapshot failed:", err);
    return false;
  }
}
