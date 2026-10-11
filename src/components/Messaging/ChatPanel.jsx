import { useEffect, useRef, useState } from "react";
import { MESSAGE_MAX_LENGTH, formatChatTime } from "./messagingApi";

// Right column: the open conversation (messages + composer).
function ChatPanel({
  conversation,
  messages,
  currentUserId,
  loading,
  error,
  sending,
  sendError,
  onSend,
  onBack,
  t,
  lang,
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);
  const conversationId = conversation ? conversation.id : null;

  // Start with an empty box when another conversation is opened
  useEffect(() => {
    setDraft("");
  }, [conversationId]);

  // Keep the newest message in view
  useEffect(() => {
    const element = listRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages.length, conversationId]);

  if (!conversation) {
    return (
      <div className="ks-mc-chat-pane">
        <p className="ks-mc-info ks-mc-placeholder">{t("chat.selectConversation")}</p>
      </div>
    );
  }

  const submit = async () => {
    if (sending || !draft.trim()) {
      return;
    }
    const sent = await onSend(draft);
    if (sent) {
      setDraft("");
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="ks-mc-chat-pane">
      <div className="ks-mc-chat-head">
        <button type="button" className="ks-mc-back" onClick={onBack}>
          ← {t("chat.back")}
        </button>
        <span className="ks-mc-chat-name">
          {conversation.other_name || t("chat.unknownUser")}
        </span>
      </div>

      <p className="ks-mc-hint">{t("chat.phoneHint")}</p>

      <div className="ks-mc-messages" ref={listRef} aria-live="polite">
        {loading && messages.length === 0 && (
          <p className="ks-mc-info">{t("chat.loadingMessages")}</p>
        )}
        {!loading && !error && messages.length === 0 && (
          <p className="ks-mc-info">{t("chat.noMessages")}</p>
        )}
        {error && (
          <p className="ks-mc-error" role="alert">
            {error}
          </p>
        )}

        {messages.map((message) => {
          const mine = message.sender_id === currentUserId;
          return (
            <div
              key={message.id}
              className={"ks-mc-bubble-row" + (mine ? " ks-mc-mine" : " ks-mc-theirs")}
            >
              <div className="ks-mc-bubble">
                <div className="ks-mc-bubble-text">{message.body}</div>
                <div className="ks-mc-bubble-time">
                  {formatChatTime(message.created_at, lang)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sendError && (
        <p className="ks-mc-error" role="alert">
          {sendError}
        </p>
      )}

      <form className="ks-mc-composer" onSubmit={handleSubmit}>
        <textarea
          className="ks-mc-input"
          rows={2}
          value={draft}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder={t("chat.placeholder")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button type="submit" className="ks-mc-send" disabled={sending || !draft.trim()}>
          {sending ? t("chat.sending") : t("chat.send")}
        </button>
      </form>
    </div>
  );
}

export default ChatPanel;