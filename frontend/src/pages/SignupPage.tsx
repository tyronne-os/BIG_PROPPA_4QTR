/**
 * Sign up page — Big Proppa SaaS account creation.
 * No charge yet — account only, so the member can save tickets, slips, and
 * training history across sessions.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signup } from "../auth";

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

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
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 6) { setError("Password must be 6+ chars"); return; }
    setLoading(true);
    try {
      const u = await signup(email, username, password);
      if (u) {
        setDone(true);
        setTimeout(() => navigate("/"), 1500);
      } else {
        setError("Signup failed — try again.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "var(--bp-fg)" }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>💚</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 8 }}>Welcome to Big Proppa</h1>
        <p style={{ color: "var(--bp-muted)", marginBottom: 20 }}>Account created. You can now save tickets, slips, and training history.</p>
        <button onClick={() => navigate("/")} style={{ height: 40, padding: "0 20px", borderRadius: 999, border: "1px solid #d9b45a", background: "transparent", color: "#d9b45a", fontWeight: 800, cursor: "pointer" }}>
          CONTINUE
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", color: "var(--bp-fg)", padding: 20 }}>
      <div style={{ width: "min(440px, 92vw)", background: "var(--bp-card-bg)", border: "1px solid var(--bp-border)", borderRadius: 16, padding: 32, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", background: "linear-gradient(90deg,#d9b45a,#a78bfa)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          CREATE ACCOUNT
        </div>
        <div style={{ fontSize: 12, color: "var(--bp-muted)" }}>Free — no charge yet. Save your tickets and slips.</div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>EMAIL</label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
          </div>
          <div>
            <label style={labelStyle}>USERNAME</label>
            <input style={inputStyle} value={username} onChange={e => setUsername(e.target.value)} placeholder="bigproppa" autoComplete="username" required />
          </div>
          <div>
            <label style={labelStyle}>PASSWORD</label>
            <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" autoComplete="new-password" required />
          </div>
          <div>
            <label style={labelStyle}>CONFIRM PASSWORD</label>
            <input style={inputStyle} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••" autoComplete="new-password" required />
          </div>
          {error && <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 700 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            height: 44, borderRadius: 10, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg,#d9b45a,#8a6224)", color: "#0b0512",
            fontWeight: 900, fontSize: 14, letterSpacing: "0.08em",
          }}>
            {loading ? "CREATING…" : "CREATE ACCOUNT"}
          </button>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, fontSize: 12, color: "var(--bp-muted)" }}>
            <span>Already have an account?</span>
            <button type="button" onClick={() => navigate("/login")} style={{ background: "none", border: "none", color: "#d9b45a", fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}>
              LOG IN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
