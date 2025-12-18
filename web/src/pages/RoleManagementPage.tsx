import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";

type Role = { id: string; name: string; tenantId: string };
type Permission = { id: string; key: string; tenantId: string; description?: string | null };
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

function permCategory(key: string) {
  const k = (key || "").trim();
  if (!k) return "other";
  if (k === "*") return "system";
  const idx = k.indexOf(".");
  return idx > 0 ? k.slice(0, idx) : "other";
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
  const [selectedGroupByRoleId, setSelectedGroupByRoleId] = useState<Record<string, string>>({});
  const [selectedRoleByGroupId, setSelectedRoleByGroupId] = useState<Record<string, string>>({});

  const [attachBusyKey, setAttachBusyKey] = useState<string | null>(null);

  // Permissions UX
  const [rolePerms, setRolePerms] = useState<Record<string, Permission[]>>({});
  const [rolePermsLoading, setRolePermsLoading] = useState<Record<string, boolean>>({});
  const [rolePermsError, setRolePermsError] = useState<Record<string, string>>({});

  const [permModalRole, setPermModalRole] = useState<Role | null>(null);
  const [permModalQuery, setPermModalQuery] = useState("");
  const [permModalCategory, setPermModalCategory] = useState<string>("all");
  const [permModalSelected, setPermModalSelected] = useState<Set<string>>(new Set());
  const [permModalBusy, setPermModalBusy] = useState(false);

  const showNotice = (n: Notice, ms = 2800) => {
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

      // Keep only existing role/group keys for selection state
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
    const anyModalOpen = createRoleOpen || createGroupOpen || !!permModalRole;
    if (anyModalOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [createRoleOpen, createGroupOpen, permModalRole]);

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

  const permCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of perms) {
      const c = permCategory(p.key);
      counts[c] = (counts[c] || 0) + 1;
    }
    const keys = Object.keys(counts).sort();
    return [
      { key: "all", label: "All", count: perms.length },
      ...keys.map((k) => ({ key: k, label: k === "system" ? "system" : k, count: counts[k] })),
    ];
  }, [perms]);

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

  // ---- Role permissions: load + bulk grant ----

  const loadRolePermissions = async (roleId: string) => {
    setRolePermsLoading((p) => ({ ...p, [roleId]: true }));
    setRolePermsError((p) => ({ ...p, [roleId]: "" }));

    try {
      // Expecting one of: Permission[] | {items: Permission[]} | {permissions: Permission[]}
      const res = await api<any>(`/admin/roles/${roleId}/permissions`);
      const list = (unwrapArray(res) as Permission[]).slice().sort(byKey);
      setRolePerms((prev) => ({ ...prev, [roleId]: list }));
      return list;
    } catch (e: any) {
      const msg =
        e?.data?.message ||
        e?.message ||
        "Could not load permissions for this role (missing endpoint?)";
      setRolePermsError((p) => ({ ...p, [roleId]: msg }));
      setRolePerms((prev) => ({ ...prev, [roleId]: [] }));
      return [];
    } finally {
      setRolePermsLoading((p) => ({ ...p, [roleId]: false }));
    }
  };

  const openPermModal = async (role: Role) => {
    setPermModalRole(role);
    setPermModalQuery("");
    setPermModalCategory("all");
    setPermModalSelected(new Set());
    setPermModalBusy(false);

    // Try to preload current perms (if endpoint exists)
    const existing =
      rolePerms[role.id] ??
      (await loadRolePermissions(role.id).catch(() => []));

    if (existing?.length) {
      setPermModalSelected(new Set(existing.map((p) => p.id)));
    }
  };

  const closePermModal = () => {
    if (permModalBusy) return;
    setPermModalRole(null);
    setPermModalSelected(new Set());
    setPermModalQuery("");
    setPermModalCategory("all");
  };

  const permModalVisiblePerms = useMemo(() => {
    const q = permModalQuery.trim().toLowerCase();
    const cat = permModalCategory;

    return perms.filter((p) => {
      const inCat = cat === "all" ? true : permCategory(p.key) === cat;
      if (!inCat) return false;
      if (!q) return true;
      return p.key.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    });
  }, [perms, permModalQuery, permModalCategory]);

  const togglePermSelected = (permId: string) => {
    setPermModalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

const grantSelectedPerms = async () => {
  const role = permModalRole;
  if (!role) return;

  const selectedIds = Array.from(permModalSelected);
  if (selectedIds.length === 0) {
    return showNotice({ type: "info", message: "Select at least one permission." });
  }

  setPermModalBusy(true);
  setErr(null);

  try {
    // ✅ NEW: single bulk set
    await api(`/admin/roles/${role.id}/permissions`, {
      method: "PUT",
      body: { permissionIds: selectedIds },
    });

    // ✅ Update local cache instantly (no extra round-trip needed)
    const assigned = perms.filter((p) => permModalSelected.has(p.id)).slice().sort(byKey);
    setRolePerms((prev) => ({ ...prev, [role.id]: assigned }));

    showNotice({
      type: "success",
      message: `Permissions updated for “${role.name}” ✅`,
    });
  } catch (e: any) {
    const msg = e?.data?.message || e?.message || "Update permissions failed";
    setErr(msg);
    showNotice({ type: "error", message: msg });
  } finally {
    setPermModalBusy(false);
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
                <th className="rmTh">Permissions</th>
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

                  const selectedGroup = selectedGroupByRoleId[r.id] ?? "";

                  const knownPerms = rolePerms[r.id];
                  const permsLoading = !!rolePermsLoading[r.id];
                  const permsErr = rolePermsError[r.id];

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
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <button className="rmBtn rmBtn--primary" onClick={() => openPermModal(r)}>
                              Manage permissions
                            </button>

                            <button
                              className="rmBtn rmBtn--ghost"
                              onClick={() => loadRolePermissions(r.id)}
                              disabled={permsLoading}
                            >
                              {permsLoading ? "Loading…" : "View permissions"}
                            </button>

                            {knownPerms ? (
                              <span className="rmSub" style={{ marginLeft: 2 }}>
                                Known: <strong>{knownPerms.length}</strong>
                              </span>
                            ) : (
                              <span className="rmSub">Not loaded yet</span>
                            )}
                          </div>

                          {permsErr ? (
                            <div className="rmSub" style={{ opacity: 0.9 }}>
                              {String(permsErr)}
                            </div>
                          ) : null}

                          {knownPerms && knownPerms.length > 0 ? (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {knownPerms.slice(0, 8).map((p) => (
                                <span key={p.id} className="rmChip rmChip--gray" title={p.id}>
                                  {p.key}
                                </span>
                              ))}
                              {knownPerms.length > 8 ? (
                                <span className="rmSub">+{knownPerms.length - 8} more…</span>
                              ) : null}
                            </div>
                          ) : knownPerms && knownPerms.length === 0 ? (
                            <div className="rmSub">No permissions assigned.</div>
                          ) : null}
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
                <div className="rmModal__sub">Example: SUPPORT, FINANCE, CLAIMS_AGENT…</div>
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
                <div className="rmModal__sub">Example: Claims Team, Finance Team, Support Team…</div>
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

      {/* Permissions Modal (bulk) */}
      {permModalRole && (
        <div className="rmModalBackdrop" onMouseDown={closePermModal} role="dialog" aria-modal="true">
          <div
            className="rmModal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ width: "min(980px, 95vw)" }}
          >
            <div className="rmModal__head">
              <div>
                <div className="rmKicker">Permissions</div>
                <h3 className="rmModal__title">Manage permissions for “{permModalRole.name}”</h3>
                <div className="rmModal__sub">
                  Select multiple permissions, then click <strong>Grant selected</strong>.
                </div>
              </div>

              <button className="rmIconClose" onClick={closePermModal} aria-label="Close modal">
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 12 }}>
              {/* Left: categories */}
              <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)", paddingRight: 10 }}>
                <div className="rmSub" style={{ marginBottom: 8, fontWeight: 700 }}>
                  Categories
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflow: "auto" }}>
                  {permCategories.map((c) => {
                    const active = permModalCategory === c.key;
                    return (
                      <button
                        key={c.key}
                        className={`rmBtn ${active ? "rmBtn--primary" : "rmBtn--ghost"}`}
                        style={{ justifyContent: "space-between" }}
                        onClick={() => setPermModalCategory(c.key)}
                        type="button"
                      >
                        <span style={{ textTransform: "capitalize" }}>{c.label}</span>
                        <span className="rmBadge rmBadge--violet">{c.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: list */}
              <div>
                <div className="rmSearch" style={{ marginBottom: 10 }}>
                  <span className="rmSearch__icon">🔍</span>
                  <input
                    className="rmInput"
                    placeholder="Search permissions…"
                    value={permModalQuery}
                    onChange={(e) => setPermModalQuery(e.target.value)}
                  />
                  {permModalQuery ? (
                    <button className="rmClear" onClick={() => setPermModalQuery("")} aria-label="Clear permission search">
                      ✕
                    </button>
                  ) : null}
                </div>

                <div className="rmSub" style={{ marginBottom: 10 }}>
                  Selected: <strong>{permModalSelected.size}</strong>
                </div>

                <div
                  style={{
                    maxHeight: 360,
                    overflow: "auto",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  {permModalVisiblePerms.length === 0 ? (
                    <div className="rmSub">No permissions match.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {permModalVisiblePerms.map((p) => {
                        const checked = permModalSelected.has(p.id);
                        return (
                          <label
                            key={p.id}
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "flex-start",
                              padding: 10,
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,0.06)",
                              background: checked ? "rgba(255,255,255,0.04)" : "transparent",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermSelected(p.id)}
                              disabled={permModalBusy}
                              style={{ marginTop: 4 }}
                            />
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <div style={{ fontWeight: 750 }}>{p.key}</div>
                              <div className="rmSub" style={{ fontSize: 12 }}>
                                {p.description ? p.description : <span className="rmRoleId">{p.id}</span>}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rmModal__actions" style={{ marginTop: 12 }}>
                  <button className="rmBtn rmBtn--ghost" onClick={closePermModal} disabled={permModalBusy}>
                    Close
                  </button>

                  <button
                    className="rmBtn rmBtn--primary"
                    onClick={grantSelectedPerms}
                    disabled={permModalBusy || permModalSelected.size === 0}
                  >
                    {permModalBusy ? "Granting…" : "Grant selected"}
                  </button>
                </div>

                <div className="rmSub" style={{ marginTop: 8 }}>
                  Tip: grant <strong>*</strong> only for “super admin” roles.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
