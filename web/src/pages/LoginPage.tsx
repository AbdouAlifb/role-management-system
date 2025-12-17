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
    <div className="auth">
      <div className="auth__left">
        <div className="brand brand--light">
          <div className="brand__logo">🛡️</div>
          <div>
            <div className="brand__name">InsureTech</div>
            <div className="brand__sub">Enterprise Portal</div>
          </div>
        </div>

        <h1 className="auth__title">Secure Access to Your Insurance Platform</h1>
        <p className="auth__subtitle">
          Manage policies, claims, and customer relationships with enterprise-grade security.
        </p>

        <div className="feature">
          <div className="feature__icon">🔒</div>
          <div>
            <div className="feature__title">Bank-Level Security</div>
            <div className="feature__desc">Session cookies + CSRF protection + strict RBAC.</div>
          </div>
        </div>

        <div className="feature">
          <div className="feature__icon">⚡</div>
          <div>
            <div className="feature__title">Fast & Scalable</div>
            <div className="feature__desc">Neon Postgres + Redis sessions ready for load.</div>
          </div>
        </div>
      </div>

      <div className="auth__right">
        <form className="card" onSubmit={onSubmit}>
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

          <button className="btn btn--primary" disabled={loading}>
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
