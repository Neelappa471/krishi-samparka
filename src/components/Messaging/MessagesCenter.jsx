import { useCallback, useEffect, useRef, useState } from "react";
import { translate } from "../../i18n/translations";
import {
  MESSAGE_MAX_LENGTH,
  fetchConversations,
  fetchMessages,
  isMessagingNotSetUp,
  sendMessage,
  subscribeToMessages,
} from "./messagingApi";
import ConversationList from "./ConversationList";
import ChatPanel from "./ChatPanel";

// How often to re-check for new messages while this page is open (a safety net
// in case realtime is not enabled).
const POLL_MS = 6000;

const CSS = `
.ks-mc { color: #1f2937; text-align: left;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Kannada", sans-serif; }
.ks-mc *, .ks-mc *::before, .ks-mc *::after { box-sizing: border-box; }
.ks-mc button, .ks-mc textarea { font-family: inherit; }
.ks-mc-head h1 { margin: 0; font-size: 24px; color: #111827; }
.ks-mc-head p { margin: 4px 0 14px; font-size: 14px; color: #4b5563; max-width: 640px; }
.ks-mc-split { display: grid; grid-template-columns: 320px 1fr; gap: 14px; align-items: stretch; }
.ks-mc-list-pane, .ks-mc-chat-pane { background: #fff; border: 1px solid #e3ece3; border-radius: 16px;
  padding: 14px; min-height: 480px; display: flex; flex-direction: column; min-width: 0; }
.ks-mc-pane-title { margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #111827; }
.ks-mc-list { display: grid; gap: 8px; overflow-y: auto; max-height: 520px; }
.ks-mc-conv { display: block; width: 100%; text-align: left; padding: 10px 12px; background: #fff;
  border: 1px solid #e3ece3; border-left: 5px solid var(--ks-mc-accent, #16a34a); border-radius: 12px;
  cursor: pointer; color: inherit; }
.ks-mc-conv:hover { background: #fbfefb; }
.ks-mc-conv[aria-pressed="true"] { background: #f0fdf4; border-color: var(--ks-mc-accent, #16a34a); }
.ks-mc-conv-top { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.ks-mc-conv-name { font-size: 15px; font-weight: 700; color: #111827; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
.ks-mc-conv-time { font-size: 11px; color: #6b7280; flex-shrink: 0; }
.ks-mc-conv-preview { display: block; margin-top: 3px; font-size: 13px; color: #4b5563; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
.ks-mc-info { margin: 0; padding: 10px 12px; font-size: 14px; color: #4b5563; background: #f6faf6;
  border-radius: 10px; line-height: 1.4; }
.ks-mc-placeholder { margin: auto; text-align: center; background: transparent; }
.ks-mc-error { margin: 8px 0; padding: 10px 12px; font-size: 14px; color: #b91c1c; background: #fef2f2;
  border: 1px solid #fecaca; border-radius: 10px; line-height: 1.4; }
.ks-mc-banner { margin: 0 0 12px; padding: 10px 12px; font-size: 14px; color: #92400e; background: #fffbeb;
  border: 1px solid #fde68a; border-radius: 10px; line-height: 1.4; }
.ks-mc-chat-head { display: flex; align-items: center; gap: 10px; padding-bottom: 10px;
  border-bottom: 1px solid #e5ece5; }
.ks-mc-chat-name { font-size: 17px; font-weight: 700; color: #111827; }
.ks-mc-back { display: none; min-height: 36px; padding: 0 12px; border: 1px solid #cfdccf; border-radius: 10px;
  background: #fff; color: #374151; font-size: 14px; cursor: pointer; }
.ks-mc-hint { margin: 8px 0 0; font-size: 12px; color: #6b7280; line-height: 1.4; }
.ks-mc-messages { flex: 1; overflow-y: auto; margin: 10px 0; padding: 4px 2px; display: flex;
  flex-direction: column; gap: 8px; min-height: 260px; max-height: 420px; }
.ks-mc-bubble-row { display: flex; }
.ks-mc-bubble-row.ks-mc-mine { justify-content: flex-end; }
.ks-mc-bubble { max-width: 78%; padding: 8px 12px; border-radius: 14px; background: #eef2ee; color: #111827; }
.ks-mc-mine .ks-mc-bubble { background: var(--ks-mc-accent, #16a34a); color: #fff; }
.ks-mc-bubble-text { font-size: 15px; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }
.ks-mc-bubble-time { margin-top: 3px; font-size: 11px; opacity: 0.75; text-align: right; }
.ks-mc-composer { display: flex; gap: 8px; align-items: flex-end; }
.ks-mc-input { flex: 1; min-height: 46px; padding: 8px 12px; border: 1.5px solid #c9d6c9; border-radius: 12px;
  font-size: 16px; resize: vertical; color: #111827; background: #fff; }
.ks-mc-input:focus { border-color: var(--ks-mc-accent, #16a34a); outline: none; }
.ks-mc-send { min-height: 46px; padding: 0 20px; border: none; border-radius: 12px;
  background: var(--ks-mc-accent, #16a34a); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }
.ks-mc-send:disabled { opacity: 0.55; cursor: not-allowed; }
.ks-mc button:focus-visible { outline: 3px solid #86efac; outline-offset: 2px; }
@media (max-width: 800px) {
  .ks-mc-split { grid-template-columns: 1fr; }
  .ks-mc-chat-pane { display: none; }
  .ks-mc-split.ks-mc-chat-open .ks-mc-list-pane { display: none; }
  .ks-mc-split.ks-mc-chat-open .ks-mc-chat-pane { display: flex; }
  .ks-mc-back { display: inline-block; }
}
`;

function sameMessages(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  if (a.length === 0) {
    return true;
  }
  return a[a.length - 1].id === b[b.length - 1].id;
}

function detailOf(error) {
  return error && error.message ? error.message : "";
}

// The whole Messages page: conversation list + open chat.
// Props:
//   user                  the signed-in Supabase user
//   lang                  "en" | "kn"
//   initialConversationId a conversation to open (after "Contact ...")
//   accent                colour for bubbles / highlights
function MessagesCenter({ user, lang, initialConversationId = null, accent = "#16a34a" }) {
  const t = useCallback((key, params) => translate(lang, key, params), [lang]);
  const userId = user ? user.id : null;

  const [conversations, setConversations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null); // { notSetUp, detail }
  const [selectedId, setSelectedId] = useState(initialConversationId);
  const [chatOpen, setChatOpen] = useState(Boolean(initialConversationId));

  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null); // detail text
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const mountedRef = useRef(true);
  const selectedIdRef = useRef(selectedId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadConversations = useCallback(
    async (silent) => {
      if (!userId) {
        return;
      }
      if (!silent) {
        setListLoading(true);
      }
      try {
        const rows = await fetchConversations(userId);
        if (!mountedRef.current) {
          return;
        }
        setConversations(rows);
        setListError(null);
      } catch (error) {
        console.error("Could not load conversations:", error);
        if (mountedRef.current && !silent) {
          setListError({ notSetUp: isMessagingNotSetUp(error), detail: detailOf(error) });
        }
      } finally {
        if (mountedRef.current && !silent) {
          setListLoading(false);
        }
      }
    },
    [userId]
  );

  const loadMessages = useCallback(async (conversationId, silent) => {
    if (!conversationId) {
      return;
    }
    if (!silent) {
      setMessagesLoading(true);
      setMessagesError(null);
    }
    try {
      const rows = await fetchMessages(conversationId);
      if (!mountedRef.current || selectedIdRef.current !== conversationId) {
        return;
      }
      setMessages((current) => (sameMessages(current, rows) ? current : rows));
    } catch (error) {
      console.error("Could not load messages:", error);
      if (!silent && mountedRef.current && selectedIdRef.current === conversationId) {
        setMessagesError(detailOf(error) || "unknown error");
      }
    } finally {
      if (!silent && mountedRef.current && selectedIdRef.current === conversationId) {
        setMessagesLoading(false);
      }
    }
  }, []);

  // Load the list when the user is known
  useEffect(() => {
    loadConversations(false);
  }, [loadConversations]);

  // "Contact ..." opened a specific conversation
  useEffect(() => {
    if (initialConversationId) {
      setSelectedId(initialConversationId);
      setChatOpen(true);
      loadConversations(true);
    }
  }, [initialConversationId, loadConversations]);

  // Load the messages of the selected conversation
  useEffect(() => {
    selectedIdRef.current = selectedId;
    setMessages([]);
    setSendError("");
    if (selectedId) {
      loadMessages(selectedId, false);
    }
  }, [selectedId, loadMessages]);

  // Realtime: new messages appear without a refresh
  useEffect(() => {
    if (!userId) {
      return undefined;
    }
    const unsubscribe = subscribeToMessages((row) => {
      if (!mountedRef.current) {
        return;
      }
      if (row.conversation_id === selectedIdRef.current) {
        setMessages((current) =>
          current.some((message) => message.id === row.id) ? current : [...current, row]
        );
      }
      loadConversations(true);
    });
    return unsubscribe;
  }, [userId, loadConversations]);

  // Safety net: poll while the page is open and visible
  useEffect(() => {
    if (!userId) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      loadConversations(true);
      if (selectedIdRef.current) {
        loadMessages(selectedIdRef.current, true);
      }
    }, POLL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [userId, loadConversations, loadMessages]);

  const handleSelect = (id) => {
    setSelectedId(id);
    setChatOpen(true);
  };

  const handleSend = async (text) => {
    const body = String(text || "").trim();
    if (!body) {
      setSendError(t("chat.emptyMessage"));
      return false;
    }
    if (body.length > MESSAGE_MAX_LENGTH) {
      setSendError(t("chat.tooLong", { max: MESSAGE_MAX_LENGTH }));
      return false;
    }
    const conversationId = selectedIdRef.current;
    if (!userId || !conversationId) {
      return false;
    }

    setSending(true);
    setSendError("");
    try {
      const row = await sendMessage({ conversationId, userId, body });
      if (!mountedRef.current) {
        return true;
      }
      setMessages((current) =>
        current.some((message) => message.id === row.id) ? current : [...current, row]
      );
      loadConversations(true);
      return true;
    } catch (error) {
      console.error("Could not send the message:", error);
      if (mountedRef.current) {
        setSendError(
          isMessagingNotSetUp(error)
            ? t("chat.notSetUp")
            : t("chat.sendFailed", { detail: detailOf(error) || t("common.unknownError") })
        );
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setSending(false);
      }
    }
  };

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedId) ||
    (selectedId
      ? { id: selectedId, other_name: "", other_id: null, last_message_preview: "" }
      : null);

  if (!user) {
    return (
      <div className="ks-mc" style={{ "--ks-mc-accent": accent }}>
        <style>{CSS}</style>
        <p className="ks-mc-info">{t("msg.notLoggedIn")}</p>
      </div>
    );
  }

  return (
    <div className="ks-mc" style={{ "--ks-mc-accent": accent }}>
      <style>{CSS}</style>

      <div className="ks-mc-head">
        <h1>{t("chat.title")}</h1>
        <p>{t("chat.subtitle")}</p>
      </div>

      {listError && (
        <p className={listError.notSetUp ? "ks-mc-banner" : "ks-mc-error"} role="alert">
          {listError.notSetUp
            ? t("chat.notSetUp")
            : t("chat.loadFailed", { detail: listError.detail || t("common.unknownError") })}{" "}
          {!listError.notSetUp && (
            <button
              type="button"
              className="ks-mc-back"
              style={{ display: "inline-block" }}
              onClick={() => loadConversations(false)}
            >
              {t("chat.retry")}
            </button>
          )}
        </p>
      )}

      <div className={"ks-mc-split" + (chatOpen ? " ks-mc-chat-open" : "")}>
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          loading={listLoading}
          onSelect={handleSelect}
          t={t}
          lang={lang}
        />
        <ChatPanel
          conversation={selectedConversation}
          messages={messages}
          currentUserId={userId}
          loading={messagesLoading}
          error={
            messagesError !== null
              ? t("chat.messagesFailed", { detail: messagesError })
              : ""
          }
          sending={sending}
          sendError={sendError}
          onSend={handleSend}
          onBack={() => setChatOpen(false)}
          t={t}
          lang={lang}
        />
      </div>
    </div>
  );
}

export default MessagesCenter;