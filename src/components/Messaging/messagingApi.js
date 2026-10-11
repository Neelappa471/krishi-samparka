// ---------------------------------------------------------------------------
// Supabase calls for private messaging.
// Tables: public.conversations, public.messages
// Function: public.start_conversation(p_listing_id, p_requirement_id)
// (see supabase/messaging.sql). Access is protected by Row Level Security.
// ---------------------------------------------------------------------------
// NOTE: if your config/supabase.js uses a default export, change this to:
//   import supabase from "../../config/supabase";
import { supabase } from "../../config/supabase";

export const MESSAGE_MAX_LENGTH = 2000;

// True when the messaging SQL has not been applied yet (missing function/table)
export function isMessagingNotSetUp(error) {
  if (!error) {
    return false;
  }
  const code = String(error.code || "");
  const text = String(error.message || "").toLowerCase();
  return (
    code === "PGRST202" ||
    code === "PGRST205" ||
    code === "42P01" ||
    code === "42883" ||
    text.includes("could not find the function") ||
    text.includes("could not find the table") ||
    (text.includes("relation") && text.includes("does not exist"))
  );
}

// Find or create the one private conversation for this listing / requirement.
// A buyer passes listingId, a farmer passes requirementId. Returns the id.
export async function startConversation({ listingId = null, requirementId = null }) {
  const { data, error } = await supabase.rpc("start_conversation", {
    p_listing_id: listingId,
    p_requirement_id: requirementId,
  });
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("No conversation was returned.");
  }
  return data;
}

// Conversations the signed-in user takes part in (RLS enforces this), newest
// activity first, each with the other person's name.
export async function fetchConversations(userId) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, user_a, user_b, created_at, last_message_at, last_message_preview")
    .order("last_message_at", { ascending: false });
  if (error) {
    throw error;
  }

  const rows = data || [];
  const otherIds = Array.from(
    new Set(rows.map((row) => (row.user_a === userId ? row.user_b : row.user_a)))
  );

  const names = {};
  if (otherIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", otherIds);
    if (profileError) {
      // Names are optional: the chat still works without them
      console.error("Could not load participant names:", profileError);
    } else {
      (profiles || []).forEach((profile) => {
        if (profile.full_name) {
          names[profile.id] = profile.full_name;
        }
      });
    }
  }

  return rows.map((row) => {
    const otherId = row.user_a === userId ? row.user_b : row.user_a;
    return { ...row, other_id: otherId, other_name: names[otherId] || "" };
  });
}

export async function fetchMessages(conversationId) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) {
    throw error;
  }
  return data || [];
}

export async function sendMessage({ conversationId, userId, body }) {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: userId, body: body })
    .select("id, conversation_id, sender_id, body, created_at")
    .single();
  if (error) {
    throw error;
  }
  return data;
}

// Realtime: calls onInsert(row) for every new message the user may read.
// Returns a function that removes the subscription. If realtime is not
// available the chat still works (the UI also polls).
export function subscribeToMessages(onInsert) {
  let channel = null;
  try {
    channel = supabase
      .channel("messages-" + Math.random().toString(36).slice(2))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (payload && payload.new) {
            onInsert(payload.new);
          }
        }
      )
      .subscribe();
  } catch (error) {
    console.error("Realtime messages unavailable:", error);
  }
  return () => {
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch (error) {
        // ignore
      }
    }
  };
}

// "14:05" for today, otherwise "10 Oct, 14:05"
export function formatChatTime(value, lang) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const locale = lang === "kn" ? "kn-IN" : "en-GB";
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return time;
  }
  return (
    date.toLocaleDateString(locale, { day: "numeric", month: "short" }) + ", " + time
  );
}