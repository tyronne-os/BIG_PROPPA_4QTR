/**
 * Log in page — Big Proppa SaaS sign in.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputStyle: React.CSSProperties = {
    height: 34, padding: "0 12px", borderRadius: 8,
    border: "1px solid var(--bp-border)", background: "var(--bp-card-bg)",
    color: "var(--bp-fg)", fontSize: 13, width: "100%", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: "var(--bp-muted)", letterSpacing: "0.1em",
    display: "block", marginBottom: 4,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(email, password);
      if (u) navigate("/");
      else setError("Invalid email or password.");
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", color: "var(--bp-fg)", padding: 20 }}>
      <div style={{ width: "min(440px, 92vw)", background: "var(--bp-card-bg)", border: "1px solid var(--bp-border)", borderRadius: 16, padding: 32, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", background: "linear-gradient(90deg,#d9b45a,#a78bfa)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          LOG IN
        </div>
        <div style={{ fontSize: 12, color: "var(--bp-muted)" }}>Welcome back to Big Proppa.</div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>EMAIL</label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
          </div>
          <div>
            <label style={labelStyle}>PASSWORD</label>
            <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" autoComplete="current-password" required />
          </div>
          {error && <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 700 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            height: 44, borderRadius: 10, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg,#d9b45a,#8a6224)", color: "#0b0512",
            fontWeight: 900, fontSize: 14, letterSpacing: "0.08em",
          }}>
            {loading ? "SIGNING IN…" : "LOG IN"}
          </button>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, fontSize: 12, color: "var(--bp-muted)" }}>
            <span>New to Big Proppa?</span>
            <button type="button" onClick={() => navigate("/signup")} style={{ background: "none", border: "none", color: "#d9b45a", fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}>
              CREATE ACCOUNT
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
