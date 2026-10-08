import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { sendTyping } from "@/lib/socket";
import { useChat } from "@/store/chat";
import { Icon } from "../ui/Icon";

const TYPING_IDLE_MS = 2500;

export function Composer({ conversationId }: { conversationId: number }) {
  const sendMessage = useChat((s) => s.sendMessage);
  const toast = useChat((s) => s.toast);
  const [text, setText] = useState("");
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isTyping = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const stopTyping = () => {
    clearTimeout(typingTimer.current);
    if (isTyping.current) sendTyping(conversationId, false);
    isTyping.current = false;
  };

  // ChatPane is keyed by conversation, so this runs once per opened chat.
  useEffect(() => {
    inputRef.current?.focus();
    return stopTyping; // leaving the chat stops the indicator
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const onChange = (value: string) => {
    setText(value);
    if (!isTyping.current) sendTyping(conversationId, true);
    isTyping.current = true;
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    stopTyping();
    setText("");
    sendMessage(conversationId, body);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const comingSoon = (feature: string) => () => toast(`${feature} are coming soon`);

  return (
    <footer className="composer">
      <div className="composer-input">
        <button className="icon-button" aria-label="Emoji" onClick={comingSoon("Emoji")}>
          <Icon name="emoji" />
        </button>
        <textarea ref={inputRef} rows={1} placeholder="Message" value={text}
          onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />
      </div>
      {text.trim() ? (
        <button className="send-button" aria-label="Send" onClick={submit}>
          <Icon name="send" size={18} />
        </button>
      ) : (
        <>
          <button className="icon-button" aria-label="Attach" onClick={comingSoon("Attachments")}>
            <Icon name="add" />
          </button>
          <button className="icon-button" aria-label="Voice message" onClick={comingSoon("Voice messages")}>
            <Icon name="mic" />
          </button>
        </>
      )}
    </footer>
  );
}
