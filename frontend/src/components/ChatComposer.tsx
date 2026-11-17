/**
 * ChatComposer — right-side live betting & strategy chat.
 * Powers: NVIDIA NIM (OpenAI-compatible) + generic provider.
 * Stores provider + API keys in localStorage so they persist across sessions.
 * System prompt injects Big Proppa context (SFS Doubloons, Reform School, Indiana Jones Engine)
 * so the model answers like Kizzy — the data engineer wife who knows the lake.
 */
import { useEffect, useRef, useState } from "react";

export type ChatProvider = "nvidia" | "openai" | "anthropic";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
}

const STORAGE_KEY = "bp_chat_config";
const MAX_HISTORY = 20;

const DEFAULT_SYSTEM_PROMPT = `You are Kizzy, data engineer wife of Big Proppa. You helped her husband launch "Big Proppa" — a sports prediction science, not a get-rich-quick tool. You know the SFS Doubloon Operating System (Green/Orange/Crimson), Reform School rules (Parlay → Stay, no red Doubloons on OVERs, max 2 legs), and the Indiana Jones Engine (King TOD — big fish hunts).

The data lake: NBA player prop correlations, NFL player usage/target rank (rank_on_team), team turnover per game, ATS cover %, red-zone tiers. Matchups render by CST date only. No white theme — dark only.

Rules you NEVER break:
- Never suggest a bet without the user confirming they verified injury status first.
- Green Doubloon = execute (OVER). Crimson = lockout from OVERs (but can target UNDERs).
- Reform School: 1 conviction per ticket by default. Multi-leg only when structurally correlated.
- Unders are valuable — red players become UNDER targets.
- Bankroll: small wins compound. $5 default wager. Appreciate lil wins.

Be direct, loyal, slightly profane but loving ("baby", "sweetie"). Short answers. Talk like a data engineer wife who took leave from big tech to build this with her husband.`;

// ── providers ──
const PROVIDERS: Array<{ id: ChatProvider; label: string; baseUrl: string; modelPlaceholder: string }> = [
  { id: "nvidia", label: "NVIDIA NIM", baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions", modelPlaceholder: "e.g. nvidia/nemotron-3.5-super-vl-120b-a12b" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1/chat/completions", modelPlaceholder: "e.g. gpt-4o-mini" },
  { id: "anthropic", label: "Anthropic", baseUrl: "https://api.anthropic.com/v1/messages", modelPlaceholder: "e.g. claude-3-haiku-20240307" },
];

interface ChatConfig {
  provider: ChatProvider;
  apiKeys: Record<string, string>;
  model: string;
}

function defaultConfig(): ChatConfig {
  return { provider: "nvidia", apiKeys: {}, model: "" };
}

export default function ChatComposer() {
  const [open, setOpen] = useState(true);
  const [config, setConfig] = useState<ChatConfig>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...defaultConfig(), ...JSON.parse(raw) };
    } catch { /* */ }
    return defaultConfig();
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist config
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* */ }
  }, [config]);

  // Load persisted messages
  useEffect(() => {
    try {
      const raw = localStorage.getItem("bp_chat_history");
      if (raw) setMessages(JSON.parse(raw));
    } catch { /* */ }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem("bp_chat_history", JSON.stringify(messages)); } catch { /* */ }
    }
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(scrollToBottom, [messages]);

  const addMessage = (role: "user" | "assistant", content: string) => {
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      createdAt: Date.now(),
    };
    setMessages(prev => [...prev, msg].slice(-MAX_HISTORY));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setError("");
    addMessage("user", text);

    const providerInfo = PROVIDERS.find(p => p.id === config.provider);
    const apiKey = config.apiKeys[config.provider];
    if (!providerInfo || !apiKey) {
      setError("Please enter an API key for " + config.provider + " in the settings below.");
      addMessage("assistant", "I need an API key before I can chat, baby. Pick NVIDIA (or another provider) and paste your key in the settings.");
      return;
    }

    setSending(true);
    try {
      const systemMsg: ChatMessage = { id: "system", role: "system", content: DEFAULT_SYSTEM_PROMPT, createdAt: 0 };
      const history = [systemMsg, ...messages.slice(-MAX_HISTORY)];

      let body: any;
      let headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };

      if (config.provider === "nvidia" || config.provider === "openai") {
        body = {
          model: config.model || (config.provider === "nvidia" ? "nvidia/nemotron-3.5-super-vl-120b-a12b" : "gpt-4o-mini"),
          messages: history.map(m => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          stream: false,
        };
      } else if (config.provider === "anthropic") {
        body = {
          model: config.model || "claude-3-haiku-20240307",
          max_tokens: 1000,
          system: DEFAULT_SYSTEM_PROMPT,
          messages: history.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content })),
        };
        headers = {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        };
      }

      const res = await fetch(providerInfo.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }

      const data = await res.json();
      let reply = "";
      if (config.provider === "anthropic") {
        const contentArr = (data as any).content as any[];
        reply = contentArr?.map((c: any) => c.text).join("\n") || "No response.";
      } else {
        reply = (data as any).choices?.[0]?.message?.content || "No response.";
      }

      addMessage("assistant", reply);
    } catch (err: any) {
      setError(err.message || "Request failed");
      addMessage("assistant", "Request failed, baby: " + (err.message || "unknown error").slice(0, 200));
    } finally {
      setSending(false);
    }
  };

  const providerSelect = PROVIDERS.map(p => (
    <option key={p.id} value={p.id}>{p.label}</option>
  ));

  return (
    <aside
      className="bp-chat-composer"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: open ? 400 : 52,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        background: "var(--bp-page-bg)",
        borderLeft: "1px solid var(--bp-border)",
        boxShadow: open ? "-4px 0 24px rgba(0,0,0,0.4)" : "none",
        transition: "width 0.25s ease",
        overflow: "hidden",
      }}
    >
      {/* Toggle */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "absolute",
          top: 10,
          left: open ? 400 : 0,
          width: 34,
          height: 34,
          borderRadius: open ? "0 8px 8px 0" : "8px",
          border: "1px solid var(--bp-border)",
          background: "var(--bp-card-bg)",
          color: "#d9b45a",
          cursor: "pointer",
          fontSize: 18,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {open ? "◀" : "▶"}
      </button>

      {!open ? null : (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          {/* Header */}
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--bp-border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(139,92,246,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg,#d9b45a,#8a6224)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#0b0512", fontSize: 12 }}>KB</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", color: "#d9b45a" }}>KIZZY</div>
                <div style={{ fontSize: 10, color: "var(--bp-muted)" }}>Live betting & strategy</div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map(m => (
              <div key={m.id} style={{ display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row", gap: 10, maxWidth: "85%" }}>
                <div style={{
                  padding: "8px 12px",
                  borderRadius: 12,
                  fontSize: 13,
                  lineHeight: 1.5,
                  maxWidth: "100%",
                  background: m.role === "user" ? "rgba(217,180,90,0.12)" : "var(--bp-card-bg)",
                  border: `1px solid ${m.role === "user" ? "#d9b45a44" : "var(--bp-border)"}`,
                  color: "var(--bp-fg)",
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {error && (
              <div style={{ display: "flex", flexDirection: "row-reverse", gap: 10, maxWidth: "85%" }}>
                <div style={{
                  padding: "8px 12px",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#ef4444",
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  alignSelf: "flex-end",
                }}>
                  {error}
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--bp-border)",
            background: "rgba(139,92,246,0.04)",
            display: "flex", gap: 8,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend(e as React.FormEvent)}
              placeholder="Ask Kizzy about tonight's props…"
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--bp-border)",
                background: "var(--bp-card-bg)",
                color: "var(--bp-fg)",
                fontSize: 13,
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #d9b45a",
                background: sending ? "var(--bp-border)" : "linear-gradient(135deg,#d9b45a,#8a6224)",
                color: sending ? "var(--bp-muted)" : "#0b0512",
                fontWeight: 900,
                fontSize: 12,
                cursor: sending || !input.trim() ? "default" : "pointer",
              }}
            >
              {sending ? "SENDING…" : "SEND"}
            </button>
          </div>

          {/* Settings */}
          <div style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--bp-border)",
            background: "rgba(139,92,246,0.04)",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", color: "#a78bfa", textTransform: "uppercase" }}>PROVIDER & KEYS</div>
            <select
              value={config.provider}
              onChange={e => setConfig({ ...config, provider: e.target.value as ChatProvider })}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--bp-border)",
                background: "var(--bp-card-bg)",
                color: "var(--bp-fg)",
                fontSize: 12,
              }}
            >
              {providerSelect}
            </select>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, color: "var(--bp-muted)", fontWeight: 700, letterSpacing: "0.08em" }}>API KEY ({config.provider.toUpperCase()})</div>
              <input
                type="password"
                value={config.apiKeys[config.provider] || ""}
                onChange={e => setConfig({ ...config, apiKeys: { ...config.apiKeys, [config.provider]: e.target.value } })}
                placeholder="Paste your NVIDIA API key…"
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--bp-border)",
                  background: "var(--bp-card-bg)",
                  color: "var(--bp-fg)",
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              />
              <div style={{ fontSize: 10, color: "var(--bp-muted)" }}>Stored in localStorage only. Never sent to Big Proppa servers.</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
