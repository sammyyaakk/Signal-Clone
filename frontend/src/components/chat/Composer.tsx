import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Mic, Plus, Smile } from "lucide-react";
import { sendTyping } from "@/lib/socket";
import { useChat } from "@/store/chat";

const TYPING_IDLE_MS = 2500;

/** Signal's input bar: attach | rounded text capsule with emoji toggle | mic or send. */
export function Composer({ conversationId }: { conversationId: number }) {
  const sendMessage = useChat((s) => s.sendMessage);
  const comingSoon = useChat((s) => s.comingSoon);
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

  return (
    <footer className="composer">
      <button className="icon-button" aria-label="Attach" onClick={() => comingSoon("Attachments")}>
        <Plus />
      </button>
      <div className="composer-input">
        <textarea ref={inputRef} rows={1} placeholder="Signal message" value={text}
          onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />
        <button className="icon-button" aria-label="Emoji" onClick={() => comingSoon("Emoji and stickers")}>
          <Smile />
        </button>
      </div>
      {text.trim() ? (
        <button className="send-button" aria-label="Send" onClick={submit}>
          <ArrowUp size={20} strokeWidth={2.5} />
        </button>
      ) : (
        <button className="icon-button" aria-label="Voice message" onClick={() => comingSoon("Voice messages")}>
          <Mic />
        </button>
      )}
    </footer>
  );
}
