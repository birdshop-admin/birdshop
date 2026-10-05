"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
type Message = {
  id: string;
  created_at: string;
  sender_label: string | null;
  body: string;
};
export default function ChatHistory({
  conversationId,
  before,
}: {
  conversationId: string;
  before: { id: string; created_at: string };
}) {
  const [rows, setRows] = useState<Message[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  async function load() {
    if (busy) return;
    setBusy(true);
    setError("");
    const cursor = rows[0] ?? before;
    try {
      const result = await createClient()
        .from("service_messages")
        .select("id,created_at,sender_label,body")
        .eq("conversation_id", conversationId)
        .or(
          `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);
      if (result.error) throw new Error();
      setRows((result.data ?? []).reverse());
      setDone((result.data ?? []).length < 100);
    } catch {
      setError("Earlier messages could not load. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Earlier conversation history</summary>
      <p>Browse 100 messages at a time. The live thread remains below.</p>
      {rows.map((row) => (
        <article key={row.id}>
          <strong>{row.sender_label || "BirdShop"}</strong>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {row.body}
          </p>
        </article>
      ))}
      {!done && (
        <button type="button" disabled={busy} onClick={load}>
          {busy ? "Loading…" : "Load earlier messages"}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
