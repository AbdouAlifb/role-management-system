import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      nav("/dashboard", { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth auth--center">
      {/* Decorative animated sides (no logic impact) */}
      <div className="authFx authFx--l" aria-hidden="true" />
      <div className="authFx authFx--r" aria-hidden="true" />

      <div className="authCenter">
        <img className="authLogo" src="/logo.jpeg" alt="Logo" />

        <form className="card authCard" onSubmit={onSubmit}>
          <div className="authHead">
            <div className="authBrand">InsureTech</div>
            <div className="authSub">Enterprise Portal</div>
          </div>

          <h2>Welcome Back</h2>
          <p className="muted">Sign in to your account</p>

          <label className="label">Username</label>
          <input
            className="input"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />

          <label className="label">Password</label>
          <input
            className="input"
            placeholder="Enter your password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {err ? <div className="error">{err}</div> : null}

          <button className="btn btn--primary" disabled={loading} aria-busy={loading}>
            {loading ? "Signing in..." : "Sign In →"}
          </button>

          <div className="muted small center" style={{ marginTop: 14 }}>
            Contact IT Support if you can’t access your account.
          </div>
        </form>
      </div>
    </div>
  );
}
