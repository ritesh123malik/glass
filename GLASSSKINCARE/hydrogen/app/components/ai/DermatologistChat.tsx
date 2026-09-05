import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
}

const STORAGE_KEY = "glassskincare:chat:messages";
const MAX_MESSAGES = 20;
const SUGGESTIONS = [
  "Build my custom routine ✨",
  "Analyze my skin type 🔬",
  "Recommend for oily skin 💧",
];

function loadStored(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

function persist(messages: Message[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(messages.slice(-MAX_MESSAGES)),
    );
  } catch {
    /* fail silently */
  }
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface DermatologistChatProps {
  ready?: boolean;
}

export function DermatologistChat({ ready = true }: DermatologistChatProps) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages(loadStored());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/ai-session", { method: "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => {
        if (!cancelled) {
          /* session will be minted on first call */
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    persist(messages);
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages, streaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  if (!ready) return null;

  async function submitMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setError(null);
    const userMsg: Message = { id: makeId(), role: "user", content: trimmed };
    const assistantId = makeId();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    const nextHistory = [...messages, userMsg, assistantMsg];
    setMessages(nextHistory);
    setInput("");
    setStreaming(true);

    const payloadMessages = nextHistory
      .filter((m) => m.content.length > 0 || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    const requestMessages = payloadMessages.slice(0, -1);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: requestMessages }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail =
          res.status === 401
            ? "Session expired — please refresh and try again."
            : res.status === 502
              ? "Our skincare AI is taking a breather. Try again in a moment."
              : `Chat service returned ${res.status}.`;
        setError(detail);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }

      if (!res.body) {
        setError("Chat stream unavailable.");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload) as { text?: string };
            const token = parsed.text ?? "";
            if (!token) continue;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + token }
                  : m,
              ),
            );
          } catch {
            /* ignore malformed event */
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : "Connection lost. Try again.",
      );
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitMessage(input);
    }
  }

  function clearConversation() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setStreaming(false);
  }

  return (
    <>
      {/* Floating Trigger Button */}
      {!open && (
        <button
          type="button"
          aria-label="Open AI dermatologist chat"
          onClick={() => {
            setOpen(true);
            setMinimized(false);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="fixed bottom-6 right-6 z-40 h-16 w-16 bg-brand-yellow border-4 border-brand-text rounded-full shadow-play hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center cursor-pointer group"
        >
          <div className="relative flex items-center justify-center">
            <ChatIcon />
            <span className="absolute -top-2 -right-2 h-4 w-4 bg-brand-magenta border-2 border-brand-text rounded-full animate-ping" />
            <span className="absolute -top-2 -right-2 h-4 w-4 bg-brand-magenta border-2 border-brand-text rounded-full" />
          </div>
        </button>
      )}

      {/* Chat Window Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="AI dermatologist chat"
          className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-3rem)] bg-brand-bg border-4 border-brand-text rounded-3xl shadow-play flex flex-col overflow-hidden transition-all"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-brand-yellow border-b-4 border-brand-text select-none">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-white border-2 border-brand-text rounded-xl shadow-play flex items-center justify-center text-xl">
                🩺
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-bold text-xl text-brand-text">
                    Dr. Glass
                  </h2>
                  <span className="bg-brand-mint text-brand-text text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 border border-brand-text shadow-play rounded-full">
                    Online ✨
                  </span>
                </div>
                <p className="font-rounded font-semibold text-xs text-brand-text/70">
                  AI Skincare Specialist
                </p>
              </div>
            </div>

            {/* Header Control Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Clear conversation"
                title="Clear Chat"
                onClick={clearConversation}
                className="h-9 w-9 bg-white text-brand-text border-2 border-brand-text shadow-play rounded-xl hover:bg-brand-pink transition-all flex items-center justify-center cursor-pointer active:translate-y-0.5"
              >
                <TrashIcon />
              </button>
              <button
                type="button"
                aria-label="Minimize"
                title="Minimize"
                onClick={() => setMinimized((m) => !m)}
                className="h-9 w-9 bg-white text-brand-text border-2 border-brand-text shadow-play rounded-xl hover:bg-brand-sky transition-all flex items-center justify-center cursor-pointer active:translate-y-0.5"
              >
                <MinimizeIcon />
              </button>
              <button
                type="button"
                aria-label="Close"
                title="Close"
                onClick={() => setOpen(false)}
                className="h-9 w-9 bg-white text-brand-text border-2 border-brand-text shadow-play rounded-xl hover:bg-brand-magenta hover:text-white transition-all flex items-center justify-center cursor-pointer active:translate-y-0.5"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Message Scroll Area */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-brand-bg"
              >
                {messages.length === 0 ? (
                  <EmptyState onSuggestion={(prompt) => void submitMessage(prompt)} />
                ) : (
                  messages.map((m) => <Bubble key={m.id} message={m} />)
                )}

                {streaming && messages[messages.length - 1]?.content === "" && (
                  <TypingIndicator />
                )}

                {error && (
                  <div className="bg-red-100 border-2 border-red-500 text-red-700 font-rounded font-bold text-xs p-3 rounded-xl shadow-play">
                    ⚠️ {error}
                  </div>
                )}
              </div>

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitMessage(input);
                }}
                className="p-4 bg-white border-t-4 border-brand-text flex items-end gap-3"
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Dr. Glass about your skin..."
                  rows={1}
                  disabled={streaming}
                  className="flex-1 resize-none bg-brand-bg border-2 border-brand-text text-brand-text font-rounded font-semibold text-sm rounded-xl px-4 py-3 placeholder:text-brand-text/40 focus:outline-none focus:ring-2 focus:ring-brand-magenta shadow-play disabled:opacity-60 max-h-32"
                />
                <button
                  type="submit"
                  disabled={streaming || !input.trim()}
                  className="h-12 w-12 bg-brand-accent text-white border-2 border-brand-text rounded-xl shadow-play hover:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
                  aria-label="Send"
                >
                  <SendIcon />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-4 py-3 rounded-2xl border-2 border-brand-text shadow-play text-sm leading-relaxed ${
          isUser
            ? "bg-brand-magenta text-white font-rounded font-bold rounded-br-none"
            : "bg-white text-brand-text font-rounded font-semibold rounded-bl-none"
        }`}
      >
        {message.content || (
          <span className="inline-flex gap-1.5 items-center py-1">
            <Dot delay="0ms" />
            <Dot delay="150ms" />
            <Dot delay="300ms" />
          </span>
        )}
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-2 w-2 rounded-full bg-brand-text animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-white border-2 border-brand-text shadow-play px-4 py-3 rounded-2xl rounded-bl-none">
        <span className="inline-flex gap-1.5 items-center">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </span>
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (p: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-4 my-auto">
      <div className="h-16 w-16 bg-brand-yellow border-4 border-brand-text rounded-2xl shadow-play flex items-center justify-center text-3xl mb-4">
        🩺
      </div>
      <h3 className="font-display font-bold text-2xl text-brand-text mb-2">
        Meet Dr. Glass ✨
      </h3>
      <p className="font-rounded font-semibold text-xs text-brand-text/80 mb-6 max-w-[280px]">
        Your personal AI skincare advisor. Ask me anything about your skin type, routines, or product ingredients!
      </p>
      <div className="flex flex-col gap-3 w-full">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className="w-full bg-white text-brand-text font-display font-bold text-xs uppercase tracking-wider py-3 border-2 border-brand-text rounded-xl shadow-play hover:bg-brand-pink hover:translate-y-0.5 transition-all cursor-pointer"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────

function ChatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7 text-brand-text"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 text-white"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export default DermatologistChat;