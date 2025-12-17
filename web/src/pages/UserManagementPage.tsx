import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

type Group = { id: string; name: string; tenantId: string };
type User = {
  id: string;
  username: string;
  email?: string | null;
  tenantId: string;
  forcePasswordChange?: boolean;
  createdAt?: string;
  groups?: Group[]; // if backend includes it (optional)
};

function unwrapArray(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.items)) return x.items;
  if (Array.isArray(x?.data)) return x.data;
  if (Array.isArray(x?.users)) return x.users;
  if (Array.isArray(x?.groups)) return x.groups;
  return [];
}

function norm(s: string) {
  return (s || "").toLowerCase().trim();
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // create form
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [groupId, setGroupId] = useState("");

  // UI
  const [q, setQ] = useState("");

  const groupsSorted = useMemo(
    () => groups.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [groups]
  );

  const filteredUsers = useMemo(() => {
    const nq = norm(q);
    if (!nq) return users;
    return users.filter((u) => {
      const hay = `${u.username} ${u.email || ""} ${(u.groups || []).map((g) => g.name).join(" ")}`;
      return norm(hay).includes(nq);
    });
  }, [users, q]);

  const loadAll = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [u, g] = await Promise.all([api<any>("/admin/users"), api<any>("/admin/groups")]);
      setUsers(unwrapArray(u) as User[]);
      setGroups(unwrapArray(g) as Group[]);
    } catch (e: any) {
      setErr(e?.data?.message || e?.message || "Failed to load users/groups");
      setUsers([]);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const createUser = async () => {
    const u = username.trim();
    const p = password.trim();
    const em = email.trim();

    if (!u) return setNotice({ type: "error", msg: "Username is required." });
    if (!p) return setNotice({ type: "error", msg: "Password is required." });
    if (!groupId) return setNotice({ type: "error", msg: "Please select a group." });

    setBusy(true);
    setErr(null);
    setNotice(null);

    try {
      // 1) Create user
   const payload = { username: u, password: p, email: em || undefined, groupIds: [groupId] };
console.log("[UM] create user payload", payload);

const created = await api<any>("/admin/users", { method: "POST", body: payload });
console.log("[UM] create user response", created);

      console.log("data")
      const createdUser: User | undefined =
        created?.user || created?.data || created; // tolerate different shapes

      const createdId = createdUser?.id;
      if (!createdId) {
        // fallback: reload and stop
        await loadAll();
        setNotice({ type: "success", msg: "User created. (Reloaded list)" });
      } else {
        // 2) Assign group (role-group)
       const assignPayload = { groupIds: [groupId] };
console.log("[UM] assign groups payload", assignPayload);

await api(`/admin/users/${createdId}/groups`, {
  method: "POST",
  body: assignPayload,
});

        setNotice({ type: "success", msg: `User "${u}" created and added to group.` });
        await loadAll();
      }

      setUsername("");
      setEmail("");
      setPassword("");
      setGroupId("");
    } catch (e: any) {
      setNotice({
        type: "error",
        msg: e?.data?.message || e?.message || "Failed to create user",
      });
    } finally {
      setBusy(false);
    }
  };

  const quickAssignGroup = async (userId: string, newGroupId: string) => {
    if (!newGroupId) return;
    setBusy(true);
    setNotice(null);
    try {
const payload = { groupIds: [newGroupId] };
console.log("[UM] quick assign payload", payload);

await api(`/admin/users/${userId}/groups`, {
  method: "POST",
  body: payload,
});
      setNotice({ type: "success", msg: "Group assigned." });
      await loadAll();
    } catch (e: any) {
      setNotice({ type: "error", msg: e?.data?.message || e?.message || "Failed to assign group" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <div className="panelHeader">
        <div>
          <h2>User Management</h2>
          <p className="muted">Create users and assign them to Groups (Groups carry Roles → Permissions).</p>
        </div>

        <div className="panelActions">
          <button className="btn ghost" onClick={loadAll} disabled={loading || busy}>
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div className={`toast ${notice.type}`}>
          <span>{notice.msg}</span>
          <button className="toastX" onClick={() => setNotice(null)}>
            ✕
          </button>
        </div>
      )}

      {err && (
        <div className="alert">
          <strong>Error:</strong> {err}
        </div>
      )}

      {loading ? (
        <div className="muted">Loading…</div>
      ) : (
        <div className="umGrid">
          {/* LEFT: Create */}
          <div className="card">
            <div className="cardTitleRow">
              <div>
                <h3 className="cardTitle">Add New User</h3>
                <p className="muted">Create a user account and attach it to a Group.</p>
              </div>
            </div>

            <div className="formGrid">
              <label className="label">
                Username
                <input
                  className="input"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </label>

              <label className="label">
                Email (optional)
                <input
                  className="input"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>

              <label className="label">
                Password
                <input
                  className="input"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  type="password"
                />
              </label>

              <label className="label">
                Group
                <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  <option value="">Select a group…</option>
                  {groupsSorted.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>

              <button className="btn primary" onClick={createUser} disabled={busy}>
                {busy ? "Working…" : "+ Add User"}
              </button>

              <div className="muted" style={{ fontSize: 12 }}>
                Tip: if you want “Roles” in the UI, keep it at the Group level (because RBAC is Group → Role → Permission).
              </div>
            </div>
          </div>

          {/* RIGHT: List */}
          <div className="card">
            <div className="cardTitleRow between">
              <div>
                <h3 className="cardTitle">All Users</h3>
                <p className="muted">Manage existing accounts</p>
              </div>

              <div className="searchRow">
                <input
                  className="input"
                  placeholder="Search users…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 280 }}>User</th>
                    <th style={{ width: 220 }}>Group</th>
                    <th style={{ width: 150 }}>Status</th>
                    <th style={{ width: 190 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const userGroups = u.groups || [];
                      const mainGroup = userGroups[0]?.name || "—";

                      const status =
                        u.forcePasswordChange ? { label: "Must change password", kind: "warn" } : { label: "Active", kind: "ok" };

                      return (
                        <tr key={u.id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{u.username}</div>
                            {/* <div className="muted" style={{ fontSize: 12 }}>
                              {u.email || "—"} • <span className="mono">{u.id}</span>
                            </div> */}
                          </td>

                          <td>
                            <div className="pill">{mainGroup}</div>
                            {userGroups.length > 1 && (
                              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                                +{userGroups.length - 1} more
                              </div>
                            )}
                          </td>

                          <td>
                            <span className={`badge ${status.kind}`}>{status.label}</span>
                          </td>

                          <td>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                              <select
                                className="input"
                                defaultValue=""
                                onChange={(e) => {
                                  const gid = e.target.value;
                                  e.currentTarget.value = "";
                                  quickAssignGroup(u.id, gid);
                                }}
                                disabled={busy}
                              >
                                <option value="" disabled>
                                  Assign group…
                                </option>
                                {groupsSorted.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
