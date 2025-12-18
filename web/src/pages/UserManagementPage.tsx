import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

type Group = { id: string; name: string; tenantId: string };
type Role = { id: string; name: string; tenantId?: string };

type MenuItem = {
  id: string;
  code: string;
  name: string;
  type: string;
  path?: string | null;
  sequence?: number | null;
  requiredPermissionKey?: string | null;
};

type MenuGroupOut = {
  id: string;
  code: string;
  name: string;
  icon?: string | null;
  sequence?: number | null;
  items: MenuItem[];
};

type User = {
  id: string;
  username: string;
  email?: string | null;
  tenantId: string;
  forcePasswordChange?: boolean;
  createdAt?: string;
  groups?: Group[]; // if backend includes it (optional)
};

type AccessSummary = {
  user: Pick<User, "id" | "username" | "email" | "forcePasswordChange" | "createdAt">;
  groups: Group[];
  roles: Role[];
  permissions: string[];
  menu: MenuGroupOut[];
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

function uniqBy<T>(arr: T[], keyFn: (x: T) => string) {
  const m = new Map<string, T>();
  for (const x of arr) m.set(keyFn(x), x);
  return [...m.values()];
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

  // Access summary (lazy per user)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [accessByUserId, setAccessByUserId] = useState<Record<string, AccessSummary>>({});
  const [accessLoading, setAccessLoading] = useState<Record<string, boolean>>({});
  const [bulkLoading, setBulkLoading] = useState(false);

  const groupsSorted = useMemo(() => groups.slice().sort((a, b) => a.name.localeCompare(b.name)), [groups]);

  const filteredUsers = useMemo(() => {
    const nq = norm(q);
    if (!nq) return users;

    return users.filter((u) => {
      const access = accessByUserId[u.id];
      const groupNames = (u.groups?.length ? u.groups : access?.groups || []).map((g) => g.name).join(" ");
      const roleNames = (access?.roles || []).map((r) => r.name).join(" ");
      const menuNames = (access?.menu || []).flatMap((g) => g.items.map((it) => it.name)).join(" ");
const permKeys = (access?.permissions || []).join(" ");
const hay = `${u.username} ${u.email || ""} ${groupNames} ${roleNames} ${permKeys} ${menuNames}`;

      return norm(hay).includes(nq);
    });
  }, [users, q, accessByUserId]);

  const loadAll = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const ensureAccess = async (userId: string) => {
    if (accessByUserId[userId]) return;

    setAccessLoading((p) => ({ ...p, [userId]: true }));
    try {
      const res = await api<AccessSummary>(`/menu-admin/users/${userId}/access`);
      setAccessByUserId((p) => ({ ...p, [userId]: res }));
    } catch (e: any) {
      setNotice({ type: "error", msg: e?.data?.message || e?.message || `Failed to load access for user ${userId}` });
    } finally {
      setAccessLoading((p) => ({ ...p, [userId]: false }));
    }
  };
  const prefetchAccessFor = async (ids: string[], concurrency = 5) => {
  const missing = ids.filter((id) => !accessByUserId[id]);
  for (let i = 0; i < missing.length; i += concurrency) {
    const batch = missing.slice(i, i + concurrency);
    await Promise.all(batch.map((id) => ensureAccess(id)));
  }
};


  const toggleAccess = async (userId: string) => {
    const next = !expanded[userId];
    setExpanded((p) => ({ ...p, [userId]: next }));
    if (next) await ensureAccess(userId);
  };

  const bulkLoadAccess = async () => {
    setBulkLoading(true);
    setNotice(null);

    try {
      // small concurrency (batch of 5)
      const ids = filteredUsers.map((u) => u.id).filter((id) => !accessByUserId[id]);
      for (let i = 0; i < ids.length; i += 5) {
        const batch = ids.slice(i, i + 5);
        await Promise.all(batch.map((id) => ensureAccess(id)));
      }
      setNotice({ type: "success", msg: "Loaded access for visible users." });
    } finally {
      setBulkLoading(false);
    }
  };


  useEffect(() => {
  if (!users.length) return;

  // Prefetch summaries for all users (or limit if you expect hundreds)
  // If you expect huge lists, change to users.slice(0, 50)
  const ids = users.map((u) => u.id);

  // run in background (don’t block rendering)
  setTimeout(() => {
    prefetchAccessFor(ids, 5);
  }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [users]);

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
      const payload = { username: u, password: p, email: em || undefined, groupIds: [groupId] };
      const created = await api<any>("/admin/users", { method: "POST", body: payload });

      const createdUser: User | undefined = created?.user || created?.data || created;
      const createdId = createdUser?.id;

      // optimistic: show immediately without flashing the whole page
      const gObj = groups.find((x) => x.id === groupId);
      if (createdId) {
        setUsers((prev) => {
          const nextUser: User = {
            ...createdUser!,
            groups: gObj ? [gObj] : createdUser?.groups,
            forcePasswordChange: createdUser?.forcePasswordChange ?? true,
          };
          return uniqBy([nextUser, ...prev], (x) => x.id);
        });
        setNotice({ type: "success", msg: `User "${u}" created.` });
        // reconcile in background
        loadAll({ silent: true });
      } else {
        await loadAll();
        setNotice({ type: "success", msg: "User created. (Reloaded list)" });
      }

      setUsername("");
      setEmail("");
      setPassword("");
      setGroupId("");
    } catch (e: any) {
      setNotice({ type: "error", msg: e?.data?.message || e?.message || "Failed to create user" });
    } finally {
      setBusy(false);
    }
  };

  const quickAssignGroup = async (userId: string, newGroupId: string) => {
    if (!newGroupId) return;

    setBusy(true);
    setNotice(null);

    try {
      // DTO expects groupIds: string[]
      await api(`/admin/users/${userId}/groups`, {
        method: "POST",
        body: { groupIds: [newGroupId] },
      });

      const gObj = groups.find((x) => x.id === newGroupId);
      if (gObj) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, groups: [gObj] } : u))
        );
      }

      // also invalidate access cache for that user (roles/menu may change)
      setAccessByUserId((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });

      setNotice({ type: "success", msg: "Group assigned." });
      loadAll({ silent: true });
    } catch (e: any) {
      setNotice({ type: "error", msg: e?.data?.message || e?.message || "Failed to assign group" });
    } finally {
      setBusy(false);
    }
  };

  const renderPills = (labels: string[], max = 3) => {
    if (labels.length === 0) return <span className="muted">—</span>;
    const shown = labels.slice(0, max);
    const more = labels.length - shown.length;

    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {shown.map((x) => (
          <span key={x} style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", fontSize: 12 }}>
            {x}
          </span>
        ))}
        {more > 0 ? (
          <span style={{ padding: "2px 8px", borderRadius: 999, border: "1px dashed rgba(0,0,0,0.18)", fontSize: 12, opacity: 0.75 }}>
            +{more}
          </span>
        ) : null}
      </div>
    );
  };

  const getAccessStats = (userId: string) => {
    const a = accessByUserId[userId];
    if (!a) return { roles: 0, groups: 0, pages: 0, sections: 0 };

    const sections = a.menu?.length || 0;
    const pages = (a.menu || []).reduce((acc, g) => acc + (g.items || []).filter((it) => !!it.path).length, 0);
    return { roles: a.roles?.length || 0, groups: a.groups?.length || 0, pages, sections };
  };

  return (
    <div className="panel">
      <div className="panelHeader">
        <div>
          <h2>User Management</h2>
          <p className="muted">Create users, assign Groups, and review effective Roles + Menu access.</p>
        </div>

        <div className="panelActions" style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" onClick={() => loadAll()} disabled={loading || busy}>
            Refresh
          </button>
          <button className="btn ghost" onClick={bulkLoadAccess} disabled={loading || busy || bulkLoading}>
            {bulkLoading ? "Loading access…" : "Load access (visible)"}
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
                <input className="input" placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </label>

              <label className="label">
                Email (optional)
                <input className="input" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </label>

              <label className="label">
                Password
                <input className="input" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" type="password" />
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
                RBAC chain: <strong>Group → Role → Permission</strong>. Menu chain: <strong>Role → MenuGroup → MenuFunction</strong>.
              </div>
            </div>
          </div>

          {/* RIGHT: List */}
          <div className="card">
            <div className="cardTitleRow between">
              <div>
                <h3 className="cardTitle">All Users</h3>
                <p className="muted">Overview: groups, roles and accessible pages</p>
              </div>

              <div className="searchRow">
                <input className="input" placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>

            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 240 }}>User</th>
                    <th style={{ width: 240 }}>Groups</th>
                    <th style={{ width: 180 }}>Roles</th>
                    <th style={{ width: 180 }}>Permission</th>
                    <th style={{ width: 200 }}>Menu</th>
                    <th style={{ width: 140 }}>Status</th>
                    <th style={{ width: 240 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="muted">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const a = accessByUserId[u.id];
                      const isAccessPending = !!accessLoading[u.id] && !a;

                      const roleLabels = a?.roles?.map(r => r.name) ?? [];
                      const permLabels = a?.permissions ?? [];
                      const stats = getAccessStats(u.id);

                      const displayGroups = (u.groups?.length ? u.groups : a?.groups || []).map((g) => g.name);
                      const displayRoles = (a?.roles || []).map((r) => r.name);

                      const status = u.forcePasswordChange
                        ? { label: "Must change password", kind: "warn" }
                        : { label: "Active", kind: "ok" };

                      const isExpanded = !!expanded[u.id];
                      const isAccessLoading = !!accessLoading[u.id];

                      return (
                        <>
                          <tr key={u.id}>
                            <td>
                              <div style={{ fontWeight: 700 }}>{u.username}</div>
                              <div className="muted" style={{ fontSize: 12 }}>
                                {u.email || "—"}
                              </div>
                            </td>

                          <td>
  {(() => {
    const a = accessByUserId[u.id];
    const displayGroups = (u.groups?.length ? u.groups : a?.groups || []).map((g) => g.name);

    if (!displayGroups.length && accessLoading[u.id]) {
      return <span className="muted">Loading…</span>;
    }
    return renderPills(displayGroups, 2);
  })()}
</td>
<td>
  {isAccessPending ? <span className="muted">Loading…</span> : renderPills(roleLabels, 2)}
</td>

<td>
  {isAccessPending ? <span className="muted">Loading…</span> : renderPills(permLabels, 3)}
</td>

                            <td>
                              {!a ? (
                                <span className="muted">—</span>
                              ) : (
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13 }}>{stats.roles}</div>
                                  <div className="muted" style={{ fontSize: 12 }}>
                                    {displayRoles.slice(0, 2).join(", ")}
                                    {displayRoles.length > 2 ? "…" : ""}
                                  </div>
                                </div>
                              )}
                            </td>






<td>
  {isAccessPending ? (
    <span className="muted">Loading…</span>
  ) : (
    <span>
      <strong>{stats.pages}</strong> pages / <strong>{stats.sections}</strong> sections
    </span>
  )}
</td>

                            

                            <td>
                              <span className={`pill ${status.kind}`}>{status.label}</span>
                            </td>

                            <td>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <select
                                  className="input"
                                  style={{ width: 170 }}
                                  defaultValue=""
                                  onChange={(e) => quickAssignGroup(u.id, e.target.value)}
                                  disabled={busy}
                                >
                                  <option value="">Assign group…</option>
                                  {groupsSorted.map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.name}
                                    </option>
                                  ))}
                                </select>

                                <button className="btn ghost" onClick={() => toggleAccess(u.id)} disabled={busy}>
                                  {isExpanded ? "Hide access" : isAccessLoading ? "Loading…" : "View access"}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded ? (
                            <tr key={`${u.id}-details`}>
                              <td colSpan={6} style={{ background: "rgba(0,0,0,0.02)" }}>
                                {!a ? (
                                  <div className="muted" style={{ padding: 12 }}>
                                    {isAccessLoading ? "Loading access…" : "No access data."}
                                  </div>
                                ) : (
                                  <div style={{ padding: 12, display: "grid", gap: 12 }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                      <div className="card" style={{ margin: 0 }}>
                                        <div className="cardTitleRow">
                                          <h3 className="cardTitle" style={{ fontSize: 14 }}>
                                            Groups & Roles
                                          </h3>
                                        </div>
                                        <div style={{ display: "grid", gap: 8 }}>
                                          <div>
                                            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                                              Groups
                                            </div>
                                            {renderPills(a.groups.map((g) => g.name), 6)}
                                          </div>
                                          <div>
                                            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                                              Roles
                                            </div>
                                            {renderPills(a.roles.map((r) => r.name), 6)}
                                          </div>
                                          <div>
                                            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                                              Permissions ({a.permissions.length})
                                            </div>
                                            <div className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
                                              {a.permissions.slice(0, 20).join(", ")}
                                              {a.permissions.length > 20 ? " …" : ""}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="card" style={{ margin: 0 }}>
                                        <div className="cardTitleRow">
                                          <h3 className="cardTitle" style={{ fontSize: 14 }}>
                                            Menu Access
                                          </h3>
                                        </div>

                                        <div style={{ display: "grid", gap: 10 }}>
                                          {(a.menu || []).length === 0 ? (
                                            <div className="muted">No menu sections visible for this user.</div>
                                          ) : (
                                            (a.menu || []).map((g) => (
                                              <div key={g.id} style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: 10 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                                  <div style={{ fontWeight: 800, fontSize: 13 }}>
                                                    {(g.icon ? `${g.icon} ` : "") + g.name}
                                                  </div>
                                                  <div className="muted" style={{ fontSize: 12 }}>
                                                    {(g.items || []).length} items
                                                  </div>
                                                </div>

                                                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                                                  {(g.items || []).map((it) => (
                                                    <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                                      <div style={{ fontSize: 13 }}>{it.name}</div>
                                                      <div className="muted" style={{ fontSize: 12 }}>
                                                        {it.path || "—"}
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ) : null}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              Tip: click <strong>Load access (visible)</strong> to populate Roles + Menu columns quickly.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
