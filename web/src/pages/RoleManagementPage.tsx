import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";

type Role = { id: string; name: string; tenantId: string };
type Permission = { id: string; key: string; tenantId: string };
type Group = { id: string; name: string; tenantId: string };

type Notice = { type: "success" | "error" | "info"; message: string };

function unwrapArray(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.items)) return x.items;
  if (Array.isArray(x?.data)) return x.data;
  if (Array.isArray(x?.roles)) return x.roles;
  if (Array.isArray(x?.permissions)) return x.permissions;
  if (Array.isArray(x?.groups)) return x.groups;
  return [];
}

function byStr(a: string, b: string) {
  return a.localeCompare(b);
}
function byName(a: { name: string }, b: { name: string }) {
  return byStr(a.name, b.name);
}
function byKey(a: { key: string }, b: { key: string }) {
  return byStr(a.key, b.key);
}

function hashToIndex(input: string, mod: number) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % mod;
}

function roleBadge(role: Role): "System" | "Custom" {
  const n = role.name.toLowerCase();
  if (n.includes("super") || n.includes("system") || n.includes("root")) return "System";
  return "Custom";
}

export default function RoleManagementPage() {
  const [view, setView] = useState<"roles" | "groups">("roles");

  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const [roleQuery, setRoleQuery] = useState("");
  const [permQuery, setPermQuery] = useState("");
  const [groupQuery, setGroupQuery] = useState("");

  // Modals
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);

  const [newRoleName, setNewRoleName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  const roleInputRef = useRef<HTMLInputElement | null>(null);
  const groupInputRef = useRef<HTMLInputElement | null>(null);

  // Row selections
  const [selectedPermByRoleId, setSelectedPermByRoleId] = useState<Record<string, string>>({});
  const [selectedGroupByRoleId, setSelectedGroupByRoleId] = useState<Record<string, string>>({});
  const [selectedRoleByGroupId, setSelectedRoleByGroupId] = useState<Record<string, string>>({});

  const [grantBusyRoleId, setGrantBusyRoleId] = useState<string | null>(null);
  const [attachBusyKey, setAttachBusyKey] = useState<string | null>(null);

  const showNotice = (n: Notice, ms = 3000) => {
    setNotice(n);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), ms);
  };

  const loadAll = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setErr(null);

    try {
      const [r, p, g] = await Promise.all([
        api<any>("/admin/roles"),
        api<any>("/admin/permissions"),
        api<any>("/admin/groups"),
      ]);

      const roleList = (unwrapArray(r) as Role[]).slice().sort(byName);
      const permList = (unwrapArray(p) as Permission[]).slice().sort(byKey);
      const groupList = (unwrapArray(g) as Group[]).slice().sort(byName);

      setRoles(roleList);
      setPerms(permList);
      setGroups(groupList);

      // Keep only existing keys
      setSelectedPermByRoleId((prev) => {
        const next: Record<string, string> = {};
        for (const role of roleList) if (prev[role.id]) next[role.id] = prev[role.id];
        return next;
      });
      setSelectedGroupByRoleId((prev) => {
        const next: Record<string, string> = {};
        for (const role of roleList) if (prev[role.id]) next[role.id] = prev[role.id];
        return next;
      });
      setSelectedRoleByGroupId((prev) => {
        const next: Record<string, string> = {};
        for (const group of groupList) if (prev[group.id]) next[group.id] = prev[group.id];
        return next;
      });
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to load RBAC data";
      setErr(msg);
      if (!opts?.silent) {
        setRoles([]);
        setPerms([]);
        setGroups([]);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  // Lock body scroll when any modal open
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (createRoleOpen || createGroupOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [createRoleOpen, createGroupOpen]);

  // Autofocus
  useEffect(() => {
    if (createRoleOpen) window.setTimeout(() => roleInputRef.current?.focus(), 0);
  }, [createRoleOpen]);

  useEffect(() => {
    if (createGroupOpen) window.setTimeout(() => groupInputRef.current?.focus(), 0);
  }, [createGroupOpen]);

  const filteredRoles = useMemo(() => {
    const q = roleQuery.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }, [roles, roleQuery]);

  const filteredPerms = useMemo(() => {
    const q = permQuery.trim().toLowerCase();
    if (!q) return perms;
    return perms.filter((p) => p.key.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [perms, permQuery]);

  const filteredGroups = useMemo(() => {
    const q = groupQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q) || g.id.toLowerCase().includes(q));
  }, [groups, groupQuery]);

  const createRole = async () => {
    const name = newRoleName.trim();
    if (!name) return showNotice({ type: "info", message: "Please enter a role name." });

    setBusy(true);
    setErr(null);

    try {
      await api("/admin/roles", { method: "POST", body: { name } });
      setNewRoleName("");
      setCreateRoleOpen(false);
      showNotice({ type: "success", message: `Role “${name}” created ✅` });
      await loadAll({ silent: true });
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Create role failed";
      setErr(msg);
      showNotice({ type: "error", message: msg });
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return showNotice({ type: "info", message: "Please enter a group name." });

    setBusy(true);
    setErr(null);

    try {
      await api("/admin/groups", { method: "POST", body: { name } });
      setNewGroupName("");
      setCreateGroupOpen(false);
      showNotice({ type: "success", message: `Group “${name}” created ✅` });
      await loadAll({ silent: true });
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Create group failed";
      setErr(msg);
      showNotice({ type: "error", message: msg });
    } finally {
      setBusy(false);
    }
  };

  const grantPermission = async (role: Role, permId: string) => {
    if (!permId) return;

    setGrantBusyRoleId(role.id);
    setErr(null);

    try {
      const perm = perms.find((p) => p.id === permId);
      await api(`/admin/roles/${role.id}/permissions/${permId}`, { method: "POST" });

      showNotice({
        type: "success",
        message: `Granted “${perm?.key ?? "permission"}” → “${role.name}” ✅`,
      });

      await loadAll({ silent: true });
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Grant permission failed";
      setErr(msg);
      showNotice({ type: "error", message: msg });
    } finally {
      setGrantBusyRoleId(null);
    }
  };

  const attachRoleToGroup = async (group: Group, role: Role) => {
    const key = `${group.id}:${role.id}`;
    setAttachBusyKey(key);
    setErr(null);

    try {
      await api(`/admin/groups/${group.id}/roles/${role.id}`, { method: "POST" });
      showNotice({ type: "success", message: `Attached “${role.name}” → “${group.name}” ✅` });
      await loadAll({ silent: true });
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Attach role to group failed";
      setErr(msg);
      showNotice({ type: "error", message: msg });
    } finally {
      setAttachBusyKey(null);
    }
  };

  const avatarPalette = ["rmAvatar--blue", "rmAvatar--violet", "rmAvatar--green", "rmAvatar--orange", "rmAvatar--pink"];
  const avatarIcon = ["♛", "⌂", "👤", "👁", "🎧"];

  return (
    <div className="rmPage">
      <div className="rmTop">
        <div>
          <div className="rmKicker">Administration</div>
          <h1 className="rmH1">RBAC Management</h1>
          <div className="rmSub">
            Roles hold permissions. <strong>Users get access via Groups</strong> (users → groups → roles → permissions).
          </div>
        </div>

        <div className="rmActions">
          <button className="rmBtn rmBtn--ghost" onClick={() => loadAll({ silent: false })}>
            <span className="rmBtn__icon">⟳</span>
            Refresh
          </button>

          {view === "roles" ? (
            <button className="rmBtn rmBtn--primary" onClick={() => setCreateRoleOpen(true)}>
              <span className="rmBtn__icon">＋</span>
              New Role
            </button>
          ) : (
            <button className="rmBtn rmBtn--primary" onClick={() => setCreateGroupOpen(true)}>
              <span className="rmBtn__icon">＋</span>
              New Group
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
        <button
          className={`rmBtn ${view === "roles" ? "rmBtn--primary" : "rmBtn--ghost"}`}
          onClick={() => setView("roles")}
        >
          Roles
        </button>
        <button
          className={`rmBtn ${view === "groups" ? "rmBtn--primary" : "rmBtn--ghost"}`}
          onClick={() => setView("groups")}
        >
          Groups
        </button>
      </div>

      <div className="rmDivider" />

      {notice && (
        <div className={`rmToast rmToast--${notice.type}`} role="status">
          <span className="rmToast__dot" />
          <span>{notice.message}</span>
        </div>
      )}

      {err && (
        <div className="rmToast rmToast--error" role="alert">
          <span className="rmToast__dot" />
          <span>
            <strong>Error:</strong> {err}
          </span>
        </div>
      )}

      {/* Search cards */}
      <div className="rmCards">
        {view === "roles" ? (
          <>
            <div className="rmCard">
              <div className="rmCard__head">
                <div className="rmCard__title">Roles</div>
                <div className="rmCard__count">
                  <span className="rmBadge rmBadge--blue">{filteredRoles.length}</span>
                  <span className="rmCountMuted"> / {roles.length}</span>
                </div>
              </div>

              <div className="rmSearch">
                <span className="rmSearch__icon">🔍</span>
                <input
                  className="rmInput"
                  placeholder="Search roles…"
                  value={roleQuery}
                  onChange={(e) => setRoleQuery(e.target.value)}
                />
                {roleQuery ? (
                  <button className="rmClear" onClick={() => setRoleQuery("")} aria-label="Clear role search">
                    ✕
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rmCard">
              <div className="rmCard__head">
                <div className="rmCard__title">Permissions</div>
                <div className="rmCard__count">
                  <span className="rmBadge rmBadge--violet">{filteredPerms.length}</span>
                  <span className="rmCountMuted"> / {perms.length}</span>
                </div>
              </div>

              <div className="rmSearch">
                <span className="rmSearch__icon">🔍</span>
                <input
                  className="rmInput"
                  placeholder="Search permissions…"
                  value={permQuery}
                  onChange={(e) => setPermQuery(e.target.value)}
                />
                {permQuery ? (
                  <button className="rmClear" onClick={() => setPermQuery("")} aria-label="Clear permission search">
                    ✕
                  </button>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="rmCard">
              <div className="rmCard__head">
                <div className="rmCard__title">Groups</div>
                <div className="rmCard__count">
                  <span className="rmBadge rmBadge--blue">{filteredGroups.length}</span>
                  <span className="rmCountMuted"> / {groups.length}</span>
                </div>
              </div>

              <div className="rmSearch">
                <span className="rmSearch__icon">🔍</span>
                <input
                  className="rmInput"
                  placeholder="Search groups…"
                  value={groupQuery}
                  onChange={(e) => setGroupQuery(e.target.value)}
                />
                {groupQuery ? (
                  <button className="rmClear" onClick={() => setGroupQuery("")} aria-label="Clear group search">
                    ✕
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rmCard">
              <div className="rmCard__head">
                <div className="rmCard__title">Roles</div>
                <div className="rmCard__count">
                  <span className="rmBadge rmBadge--violet">{roles.length}</span>
                </div>
              </div>
              <div className="rmSub" style={{ padding: 12 }}>
                Tip: Create a group like <strong>Support Team</strong>, then attach the <strong>SUPPORT</strong> role.
              </div>
            </div>
          </>
        )}
      </div>

      {/* CONTENT */}
      <div className="rmTableCard">
        {loading ? (
          <div className="rmLoading">Loading…</div>
        ) : view === "roles" ? (
          <table className="rmTable">
            <thead>
              <tr>
                <th className="rmTh">Role</th>
                <th className="rmTh">Grant Permission</th>
                <th className="rmTh">Attach To Group</th>
              </tr>
            </thead>

            <tbody>
              {filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={3} className="rmEmpty">
                    No roles match your search.
                  </td>
                </tr>
              ) : (
                filteredRoles.map((r) => {
                  const type = roleBadge(r);
                  const idx = hashToIndex(r.id, avatarPalette.length);
                  const icon = avatarIcon[hashToIndex(r.id, avatarIcon.length)];

                  const selectedPerm = selectedPermByRoleId[r.id] ?? "";
                  const selectedGroup = selectedGroupByRoleId[r.id] ?? "";

                  return (
                    <tr key={r.id} className="rmRow">
                      <td className="rmTd">
                        <div className="rmRoleCell">
                          <div className={`rmAvatar ${avatarPalette[idx]}`} aria-hidden="true">
                            {icon}
                          </div>

                          <div className="rmRoleMeta">
                            <div className="rmRoleLine">
                              <div className="rmRoleName">{r.name}</div>
                              {type === "System" ? (
                                <span className="rmChip rmChip--blue">System</span>
                              ) : (
                                <span className="rmChip rmChip--gray">Custom</span>
                              )}
                            </div>
                            <div className="rmRoleId">{r.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="rmTd">
                        <div className="rmGrant">
                          <select
                            className="rmSelect"
                            value={selectedPerm}
                            disabled={grantBusyRoleId === r.id}
                            onChange={(e) =>
                              setSelectedPermByRoleId((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                          >
                            <option value="" disabled>
                              Select permission…
                            </option>
                            {filteredPerms.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.key}
                              </option>
                            ))}
                          </select>

                          <button
                            className="rmBtn rmBtn--primary rmBtn--grant"
                            disabled={!selectedPerm || grantBusyRoleId === r.id}
                            onClick={() => grantPermission(r, selectedPerm)}
                          >
                            {grantBusyRoleId === r.id ? "Granting…" : "Grant"}
                          </button>
                        </div>
                      </td>

                      <td className="rmTd">
                        {groups.length === 0 ? (
                          <div className="rmSub">
                            No groups yet.{" "}
                            <button className="rmBtn rmBtn--ghost" onClick={() => setView("groups")}>
                              Create a group
                            </button>
                          </div>
                        ) : (
                          <div className="rmGrant">
                            <select
                              className="rmSelect"
                              value={selectedGroup}
                              onChange={(e) =>
                                setSelectedGroupByRoleId((prev) => ({ ...prev, [r.id]: e.target.value }))
                              }
                            >
                              <option value="" disabled>
                                Select group…
                              </option>
                              {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>

                            <button
                              className="rmBtn rmBtn--primary rmBtn--grant"
                              disabled={!selectedGroup || attachBusyKey === `${selectedGroup}:${r.id}`}
                              onClick={() => {
                                const g = groups.find((x) => x.id === selectedGroup);
                                if (!g) return;
                                attachRoleToGroup(g, r).then(() =>
                                  setSelectedGroupByRoleId((prev) => ({ ...prev, [r.id]: "" }))
                                );
                              }}
                            >
                              {attachBusyKey === `${selectedGroup}:${r.id}` ? "Attaching…" : "Attach"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="rmTable">
            <thead>
              <tr>
                <th className="rmTh">Group</th>
                <th className="rmTh">Attach Role</th>
              </tr>
            </thead>

            <tbody>
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={2} className="rmEmpty">
                    No groups match your search.
                  </td>
                </tr>
              ) : (
                filteredGroups.map((g) => {
                  const selectedRoleId = selectedRoleByGroupId[g.id] ?? "";
                  const selectedRole = roles.find((r) => r.id === selectedRoleId) || null;

                  return (
                    <tr key={g.id} className="rmRow">
                      <td className="rmTd">
                        <div style={{ fontWeight: 700 }}>{g.name}</div>
                        <div className="rmRoleId">{g.id}</div>
                        <div className="rmSub" style={{ marginTop: 6 }}>
                          Users are assigned to this group.
                        </div>
                      </td>

                      <td className="rmTd">
                        <div className="rmGrant">
                          <select
                            className="rmSelect"
                            value={selectedRoleId}
                            onChange={(e) =>
                              setSelectedRoleByGroupId((prev) => ({ ...prev, [g.id]: e.target.value }))
                            }
                          >
                            <option value="" disabled>
                              Select role…
                            </option>
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>

                          <button
                            className="rmBtn rmBtn--primary rmBtn--grant"
                            disabled={!selectedRole || attachBusyKey === `${g.id}:${selectedRole?.id}`}
                            onClick={() => {
                              if (!selectedRole) return;
                              attachRoleToGroup(g, selectedRole).then(() =>
                                setSelectedRoleByGroupId((prev) => ({ ...prev, [g.id]: "" }))
                              );
                            }}
                          >
                            {attachBusyKey === `${g.id}:${selectedRole?.id}` ? "Attaching…" : "Attach"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Role Modal */}
      {createRoleOpen && (
        <div className="rmModalBackdrop" onMouseDown={() => !busy && setCreateRoleOpen(false)} role="dialog" aria-modal="true">
          <div className="rmModal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="rmModal__head">
              <div>
                <div className="rmKicker">Create</div>
                <h3 className="rmModal__title">New role</h3>
                <div className="rmModal__sub">Example: SUPPORT, FINANCE, AGENCY_ADMIN…</div>
              </div>

              <button className="rmIconClose" onClick={() => !busy && setCreateRoleOpen(false)} aria-label="Close modal">
                ✕
              </button>
            </div>

            <label className="rmLabel">Role name</label>
            <input
              ref={roleInputRef}
              className="rmInput rmInput--modal"
              placeholder="Enter role name…"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              disabled={busy}
            />

            <div className="rmModal__actions">
              <button className="rmBtn rmBtn--ghost" onClick={() => !busy && setCreateRoleOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button className="rmBtn rmBtn--primary" onClick={createRole} disabled={busy}>
                {busy ? "Creating…" : "Create role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {createGroupOpen && (
        <div className="rmModalBackdrop" onMouseDown={() => !busy && setCreateGroupOpen(false)} role="dialog" aria-modal="true">
          <div className="rmModal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="rmModal__head">
              <div>
                <div className="rmKicker">Create</div>
                <h3 className="rmModal__title">New group</h3>
                <div className="rmModal__sub">Example: Support Team, Finance Team, Agency Managers…</div>
              </div>

              <button className="rmIconClose" onClick={() => !busy && setCreateGroupOpen(false)} aria-label="Close modal">
                ✕
              </button>
            </div>

            <label className="rmLabel">Group name</label>
            <input
              ref={groupInputRef}
              className="rmInput rmInput--modal"
              placeholder="Enter group name…"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              disabled={busy}
            />

            <div className="rmModal__actions">
              <button className="rmBtn rmBtn--ghost" onClick={() => !busy && setCreateGroupOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button className="rmBtn rmBtn--primary" onClick={createGroup} disabled={busy}>
                {busy ? "Creating…" : "Create group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
