import { formatChatTime } from "./messagingApi";

// Left column: the user's conversations, newest activity first.
function ConversationList({ conversations, selectedId, loading, onSelect, t, lang }) {
  return (
    <div className="ks-mc-list-pane">
      <h2 className="ks-mc-pane-title">{t("chat.conversations")}</h2>

      {loading && conversations.length === 0 && (
        <p className="ks-mc-info">{t("chat.loadingConversations")}</p>
      )}

      {!loading && conversations.length === 0 && (
        <p className="ks-mc-info">{t("chat.noConversations")}</p>
      )}

      <div className="ks-mc-list">
        {conversations.map((conversation) => (
          <button
            type="button"
            key={conversation.id}
            className="ks-mc-conv"
            aria-pressed={selectedId === conversation.id}
            onClick={() => onSelect(conversation.id)}
          >
            <span className="ks-mc-conv-top">
              <span className="ks-mc-conv-name">
                {conversation.other_name || t("chat.unknownUser")}
              </span>
              <span className="ks-mc-conv-time">
                {formatChatTime(conversation.last_message_at, lang)}
              </span>
            </span>
            {conversation.last_message_preview && (
              <span className="ks-mc-conv-preview">{conversation.last_message_preview}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ConversationList;
