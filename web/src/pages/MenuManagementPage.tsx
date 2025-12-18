import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { MenuGroup, MenuFunction } from "../menu/menuTypes";

type Role = { id: string; name: string };
type Notice = { type: "success" | "error" | "info"; message: string };

function unwrapArray(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.items)) return x.items;
  if (Array.isArray(x?.data)) return x.data;
  if (Array.isArray(x?.roles)) return x.roles;
  if (Array.isArray(x?.groups)) return x.groups;
  if (Array.isArray(x?.functions)) return x.functions;
  return [];
}

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function typeLabel(t?: string) {
  const v = (t || "").toUpperCase();
  if (v === "M") return { label: "Menu", cls: "mmTag mmTag--blue" };
  if (v === "R") return { label: "Report", cls: "mmTag mmTag--green" };
  if (v === "L") return { label: "Link", cls: "mmTag mmTag--violet" };
  return { label: v || "Type", cls: "mmTag" };
}

export default function MenuManagementPage() {
  const [menuGroups, setMenuGroups] = useState<MenuGroup[]>([]);
  const [menuFunctions, setMenuFunctions] = useState<MenuFunction[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const timerRef = useRef<number | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Create Group
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [gCode, setGCode] = useState("");
  const [gName, setGName] = useState("");
  const [gSeq, setGSeq] = useState<string>("");
  const [gIcon, setGIcon] = useState("");

  // Create Function
  const [newFnOpen, setNewFnOpen] = useState(false);
  const [fCode, setFCode] = useState("");
  const [fName, setFName] = useState("");
  const [fType, setFType] = useState("M"); // legacy style default
  const [fPath, setFPath] = useState("");
  const [fPerm, setFPerm] = useState("");

  const [groupFns, setGroupFns] = useState<any[]>([]);
const [roleGroups, setRoleGroups] = useState<any[]>([]);


  // Attach function → group
  const [attachFnId, setAttachFnId] = useState("");
  const [attachSeq, setAttachSeq] = useState<string>("");

  // Attach group → role
  const [attachRoleId, setAttachRoleId] = useState("");

  // UI filters (UI only)
  const [groupQuery, setGroupQuery] = useState("");
  const [fnQuery, setFnQuery] = useState("");
  const [fnTypeFilter, setFnTypeFilter] = useState<"" | "M" | "R" | "L">("");

  const showNotice = (n: Notice, ms = 3000) => {
    setNotice(n);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setNotice(null), ms);
  };

  const loadAll = async () => {
    setLoading(true);
    setErr(null);
    try {
     const [g, f, r, gf, rg] = await Promise.all([
  api<any>("/menu-admin/groups"),
  api<any>("/menu-admin/functions"),
  api<any>("/admin/roles"),
  api<any>("/menu-admin/mappings/group-functions"),
  api<any>("/menu-admin/mappings/role-groups"),
]);

setGroupFns(unwrapArray(gf));
setRoleGroups(unwrapArray(rg));

      const groups = (unwrapArray(g) as MenuGroup[])
        .slice()
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

      const fns = (unwrapArray(f) as MenuFunction[])
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code));

      const roleList = (unwrapArray(r) as Role[]).slice().sort(byName);

      setMenuGroups(groups);
      setMenuFunctions(fns);
      setRoles(roleList);

      // keep selected group if still exists
      if (selectedGroupId && !groups.some((x) => x.id === selectedGroupId)) setSelectedGroupId("");
    } catch (e: any) {
      setErr(e?.data?.message || e?.message || "Failed to load menu admin data");
      setMenuGroups([]);
      setMenuFunctions([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedGroup = useMemo(
    () => menuGroups.find((g) => g.id === selectedGroupId) || null,
    [menuGroups, selectedGroupId]
  );

  const selectedGroupTitle = selectedGroup ? `${selectedGroup.code} — ${selectedGroup.name}` : "No menu group selected";

  const filteredGroups = useMemo(() => {
    const q = groupQuery.trim().toLowerCase();
    if (!q) return menuGroups;
    return menuGroups.filter((g) => {
      const s = `${g.code} ${g.name}`.toLowerCase();
      return s.includes(q);
    });
  }, [menuGroups, groupQuery]);

  const filteredFunctions = useMemo(() => {
    const q = fnQuery.trim().toLowerCase();
    return menuFunctions.filter((f) => {
      const matchesQuery = !q
        ? true
        : `${f.code} ${f.name} ${f.path ?? ""} ${f.requiredPermissionKey ?? ""}`.toLowerCase().includes(q);

      const matchesType = !fnTypeFilter ? true : String(f.type || "").toUpperCase() === fnTypeFilter;
      return matchesQuery && matchesType;
    });
  }, [menuFunctions, fnQuery, fnTypeFilter]);

  const createMenuGroup = async () => {
    const code = gCode.trim();
    const name = gName.trim();
    const sequence = gSeq.trim() ? Number(gSeq) : undefined;

    if (!code || !name) return showNotice({ type: "info", message: "Enter code + name." });

    setBusy(true);
    setErr(null);
    try {
      await api("/menu-admin/groups", {
        method: "POST",
        body: { code, name, sequence, icon: gIcon.trim() || undefined },
      });
      setGCode("");
      setGName("");
      setGSeq("");
      setGIcon("");
      setNewGroupOpen(false);
      showNotice({ type: "success", message: `Menu group “${code}” created ✅` });
      await loadAll();
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Create menu group failed";
      setErr(msg);
      showNotice({ type: "error", message: msg });
    } finally {
      setBusy(false);
    }
  };

  const createMenuFunction = async () => {
    const code = fCode.trim();
    const name = fName.trim();
    const type = fType.trim() || "M";
    const path = fPath.trim() || undefined;
    const requiredPermissionKey = fPerm.trim() || undefined;

    if (!code || !name) return showNotice({ type: "info", message: "Enter code + name." });

    setBusy(true);
    setErr(null);
    try {
      await api("/menu-admin/functions", {
        method: "POST",
        body: { code, name, type, path, requiredPermissionKey },
      });
      setFCode("");
      setFName("");
      setFType("M");
      setFPath("");
      setFPerm("");
      setNewFnOpen(false);
      showNotice({ type: "success", message: `Menu function “${code}” created ✅` });
      await loadAll();
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Create menu function failed";
      setErr(msg);
      showNotice({ type: "error", message: msg });
    } finally {
      setBusy(false);
    }
  };

  const attachFunctionToGroup = async () => {
    if (!selectedGroupId) return showNotice({ type: "info", message: "Select a menu group first." });
    if (!attachFnId) return showNotice({ type: "info", message: "Select a function to attach." });

    const sequence = attachSeq.trim() ? Number(attachSeq) : undefined;

    setBusy(true);
    setErr(null);
    try {
      await api(`/menu-admin/groups/${selectedGroupId}/functions/${attachFnId}`, {
        method: "POST",
        body: { sequence },
      });
      setAttachFnId("");
      setAttachSeq("");
      showNotice({ type: "success", message: "Function attached ✅" });
      await loadAll();
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Attach function failed";
      setErr(msg);
      showNotice({ type: "error", message: msg });
    } finally {
      setBusy(false);
    }
  };

  const attachMenuGroupToRole = async () => {
    if (!selectedGroupId) return showNotice({ type: "info", message: "Select a menu group first." });
    if (!attachRoleId) return showNotice({ type: "info", message: "Select a role." });

    setBusy(true);
    setErr(null);
    try {
await api(`/menu-admin/roles/${attachRoleId}/menu-groups/${selectedGroupId}`, { method: "POST" });
 await loadAll()
      setAttachRoleId("");
      showNotice({ type: "success", message: "Menu group attached to role ✅" });
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Attach menu group to role failed";
      setErr(msg);
      showNotice({ type: "error", message: msg });
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(() => {
    return {
      groups: menuGroups.length,
      functions: menuFunctions.length,
      roles: roles.length,
    };
  }, [menuGroups.length, menuFunctions.length, roles.length]);

const menuMap = useMemo(() => {
  // groupId -> attached functions (ordered by sequence)
  const byGroup = new Map<string, any[]>();

  for (const row of groupFns) {
    const gid = row.menuGroupId;
    const arr = byGroup.get(gid) ?? [];
    arr.push({
      sequence: row.sequence ?? 0,
      fn: row.menuFunction,
    });
    byGroup.set(gid, arr);
  }

  // roleId -> menuGroupIds
  const groupsByRole = new Map<string, Set<string>>();
  for (const row of roleGroups) {
    const rid = row.roleId;
    const set = groupsByRole.get(rid) ?? new Set<string>();
    set.add(row.menuGroupId);
    groupsByRole.set(rid, set);
  }

  // return groups with attached fns + which roles can see them
  return menuGroups.map((g) => {
    const items = (byGroup.get(g.id) ?? []).sort((a, b) => a.sequence - b.sequence);
    const visibleToRoles = roles
      .filter((r) => groupsByRole.get(r.id)?.has(g.id))
      .map((r) => r.name);

    return { group: g, items, visibleToRoles };
  });
}, [menuGroups, groupFns, roles, roleGroups]);

  
  return (
    <div className="mmPage">
      {/* Header */}
      <div className="mmHeader">
        <div>
          <div className="mmKicker">Administration</div>
          <h1 className="mmTitle">Menu Builder</h1>
          <div className="mmSub">
            Legacy model: <strong>Role → MenuGroup → MenuFunction</strong> (ordered by sequences).
          </div>
        </div>

        <div className="mmHeaderActions">
          <button className="mmBtn mmBtn--ghost" onClick={loadAll} disabled={busy}>
            ⟳ Refresh
          </button>
          <button className="mmBtn mmBtn--primary" onClick={() => setNewGroupOpen(true)} disabled={busy}>
            ＋ New Group
          </button>
          <button className="mmBtn mmBtn--primary" onClick={() => setNewFnOpen(true)} disabled={busy}>
            ＋ New Function
          </button>
        </div>
      </div>

      {notice && (
        <div className={`mmToast mmToast--${notice.type}`} role="status">
          <span className="mmDot" />
          <span>{notice.message}</span>
        </div>
      )}
      {err && (
        <div className="mmToast mmToast--error" role="alert">
          <span className="mmDot" />
          <span>
            <strong>Error:</strong> {err}
          </span>
        </div>
      )}

      {loading ? (
        <div className="mmLoading">Loading…</div>
      ) : (
        <>
          {/* 3 columns */}
          <div className="mmGrid">
            {/* LEFT: Groups */}
            <section className="mmPanel">
              <div className="mmPanelHead">
                <div className="mmPanelTitle">
                  <span className="mmPanelIcon">🧱</span>
                  <span>Menu Groups</span>
                </div>
                <span className="mmCount mmCount--blue">{counts.groups}</span>
              </div>

              <div className="mmHint">
                Legacy: <strong>adm_groupe</strong>
              </div>

              <div className="mmSearch">
                <span className="mmSearchIcon">🔎</span>
                <input
                  className="mmInput"
                  placeholder="Search groups…"
                  value={groupQuery}
                  onChange={(e) => setGroupQuery(e.target.value)}
                />
                {groupQuery ? (
                  <button className="mmClear" onClick={() => setGroupQuery("")} aria-label="Clear group search" type="button">
                    ✕
                  </button>
                ) : null}
              </div>

              <div className="mmList">
                {filteredGroups.map((g) => {
                  const active = g.id === selectedGroupId;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className={`mmItem ${active ? "isActive" : ""}`}
                      onClick={() => setSelectedGroupId(g.id)}
                    >
                      <div className="mmSeq">{pad2(g.sequence ?? 0)}</div>
                      <div className="mmItemBody">
                        <div className="mmItemTop">
                          <div className="mmItemCode">{g.code}</div>
                          <div className="mmChevron">›</div>
                        </div>
                        <div className="mmItemName">{g.name}</div>
                      </div>
                    </button>
                  );
                })}

                {filteredGroups.length === 0 ? <div className="mmEmpty">No groups found.</div> : null}
              </div>

              <div className="mmSelected">
                <div className="mmSelectedLabel">Selected</div>
                <div className="mmSelectedValue">{selectedGroupTitle}</div>
              </div>
            </section>

            {/* MIDDLE: Functions for selected group (attach box + preview) */}
            <section className="mmPanel">
              <div className="mmPanelHead">
                <div className="mmPanelTitle">
                  <span className="mmPanelIcon">🧩</span>
                  <span>Menu Functions</span>
                </div>
                <span className="mmCount mmCount--green">{counts.functions}</span>
              </div>

              <div className="mmHint">
                For selected: <strong>{selectedGroup ? selectedGroup.code : "—"}</strong>
              </div>

              <div className="mmAttachCard">
                <div className="mmAttachTitle">Attach Function</div>

                <select className="mmSelect" value={attachFnId} onChange={(e) => setAttachFnId(e.target.value)}>
                  <option value="">Select function to attach…</option>
                  {menuFunctions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} — {f.name} {f.path ? `(${f.path})` : ""}
                    </option>
                  ))}
                </select>

                <div className="mmAttachRow">
                  <input
                    className="mmInput mmInput--seq"
                    placeholder="Sequence"
                    value={attachSeq}
                    onChange={(e) => setAttachSeq(e.target.value)}
                  />
                  <button className="mmBtn mmBtn--attach" disabled={busy} onClick={attachFunctionToGroup} type="button">
                    {busy ? "Working…" : "Attach"}
                  </button>
                </div>

                <div className="mmHintSmall">
                  Legacy: <strong>adm_groupe_fonction</strong> (sequence optional)
                </div>
              </div>

              {/* Optional “attached list” if backend returns it inside MenuGroup (safe, won’t break if absent) */}
              <div className="mmMiniList">
                <div className="mmMiniHead">Attached (preview)</div>
                <div className="mmMiniHint">If your API returns group → functions, they appear here.</div>

                <div className="mmMiniBody">
                  {(() => {
                    const anySelected: any = selectedGroup as any;
                    const attached =
                      anySelected?.functions ||
                      anySelected?.menuFunctions ||
                      anySelected?.items ||
                      anySelected?.linkedFunctions ||
                      [];

                    if (!selectedGroup) return <div className="mmEmpty">Select a group to see attached functions.</div>;
                    if (!Array.isArray(attached) || attached.length === 0)
                      return <div className="mmEmpty">No attached functions found (or API doesn’t include them yet).</div>;

                    return attached.map((x: any, idx: number) => (
                      <div key={x?.id ?? `${idx}`} className="mmAttached">
                        <div className="mmAttachedLeft">
                          <span className="mmSeq mmSeq--small">{pad2(x?.sequence ?? idx + 1)}</span>
                          <div>
                            <div className="mmAttachedCode">{x?.code ?? "—"}</div>
                            <div className="mmAttachedName">{x?.name ?? ""}</div>
                          </div>
                        </div>
                        <div className="mmAttachedRight">
                          <span className={(typeLabel(x?.type).cls || "mmTag")}>{typeLabel(x?.type).label}</span>
                          <span className="mmPath">{x?.path ?? "-"}</span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </section>

            {/* RIGHT: Role assignments (attach group → role) */}
            <section className="mmPanel">
              <div className="mmPanelHead">
                <div className="mmPanelTitle">
                  <span className="mmPanelIcon">👥</span>
                  <span>Role Assignments</span>
                </div>
                <span className="mmCount mmCount--violet">{counts.roles}</span>
              </div>

              <div className="mmHint">Attach selected group to a role.</div>

              <div className="mmAttachCard">
                <div className="mmAttachTitle">Attach to Role</div>

                <select className="mmSelect" value={attachRoleId} onChange={(e) => setAttachRoleId(e.target.value)}>
                  <option value="">Select role…</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <button className="mmBtn mmBtn--primary mmBtn--wide" disabled={busy} onClick={attachMenuGroupToRole} type="button">
                  {busy ? "Working…" : "Attach Group to Role"}
                </button>

                <div className="mmHintSmall">
                  Legacy: <strong>adm_role_groupe</strong>
                </div>
              </div>

              <div className="mmTip">
                Once attached, users with that role (via your Group → Role mapping) can see this group in the sidebar.
              </div>
            </section>
          </div>

<section className="mmTablePanel">
  <div className="mmTableHead">
    <div>
      <div className="mmTableTitle">Menu Map (Groups → Functions)</div>
      <div className="mmSub">What will appear in the sidebar, and for which roles.</div>
    </div>
  </div>

  <div className="mmTableWrap">
    <table className="mmTable">
      <thead>
        <tr>
          <th>Group</th>
          <th>Seq</th>
          <th>Function</th>
          <th>Type</th>
          <th>Path</th>
          <th>Permission Key</th>
          <th>Visible to roles</th>
        </tr>
      </thead>
      <tbody>
        {menuMap.flatMap(({ group, items, visibleToRoles }) => {
          if (!items.length) {
            return (
              <tr key={`${group.id}-empty`}>
                <td className="mmMono">{group.code}</td>
                <td colSpan={5} style={{ opacity: 0.7 }}>No attached functions</td>
                <td>{visibleToRoles.join(", ") || "-"}</td>
              </tr>
            );
          }

          return items.map((it: any, idx: number) => (
            <tr key={`${group.id}-${it.fn.id}`}>
              <td className="mmMono">{idx === 0 ? `${group.code} — ${group.name}` : ""}</td>
              <td className="mmMono">{it.sequence}</td>
              <td>{it.fn.name}</td>
              <td>
                <span className={typeLabel(it.fn.type).cls}>{typeLabel(it.fn.type).label}</span>
              </td>
              <td className="mmMono">{it.fn.path ?? "-"}</td>
              <td className="mmMono">{it.fn.requiredPermissionKey ?? "-"}</td>
              <td style={{ whiteSpace: "nowrap" }}>{visibleToRoles.join(", ") || "-"}</td>
            </tr>
          ));
        })}
      </tbody>
    </table>
  </div>
</section>

          {/* Bottom: All functions table (search + type filter) */}
          <section className="mmTablePanel">
            <div className="mmTableHead">
              <div>
                <div className="mmTableTitle">All Menu Functions</div>
                <div className="mmSub">Complete list of available menu functions</div>
              </div>

              <div className="mmTableFilters">
                <div className="mmSearch mmSearch--compact">
                  <span className="mmSearchIcon">🔎</span>
                  <input
                    className="mmInput"
                    placeholder="Search functions…"
                    value={fnQuery}
                    onChange={(e) => setFnQuery(e.target.value)}
                  />
                  {fnQuery ? (
                    <button className="mmClear" onClick={() => setFnQuery("")} aria-label="Clear function search" type="button">
                      ✕
                    </button>
                  ) : null}
                </div>

                <select
                  className="mmSelect mmSelect--compact"
                  value={fnTypeFilter}
                  onChange={(e) => setFnTypeFilter(e.target.value as any)}
                >
                  <option value="">All Types</option>
                  <option value="M">Menu</option>
                  <option value="R">Report</option>
                  <option value="L">Link</option>
                </select>
              </div>
            </div>

            <div className="mmTableWrap">
              <table className="mmTable">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Path</th>
                    <th>Permission Key</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFunctions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="mmEmptyCell">
                        No functions match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredFunctions.map((f) => (
                      <tr key={f.id}>
                        <td className="mmMono">{f.code}</td>
                        <td>{f.name}</td>
                        <td>
                          <span className={typeLabel(f.type).cls}>{typeLabel(f.type).label}</span>
                        </td>
                        <td className="mmMono">{f.path ?? "-"}</td>
                        <td className="mmMono">{f.requiredPermissionKey ?? "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Create Group Modal */}
      {newGroupOpen && (
        <div className="mmModalBackdrop" onMouseDown={() => !busy && setNewGroupOpen(false)} role="dialog" aria-modal="true">
          <div className="mmModal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mmModalHead">
              <div>
                <div className="mmKicker">Create</div>
                <h3 className="mmModalTitle">New menu group</h3>
                <div className="mmSub">Example: DASHBOARD, USER_MGMT, REPORTS…</div>
              </div>
              <button className="mmIconClose" onClick={() => !busy && setNewGroupOpen(false)} aria-label="Close modal" type="button">
                ✕
              </button>
            </div>

            <label className="mmLabel">Code</label>
            <input className="mmInput mmInput--modal" value={gCode} onChange={(e) => setGCode(e.target.value)} disabled={busy} />

            <label className="mmLabel">Name</label>
            <input className="mmInput mmInput--modal" value={gName} onChange={(e) => setGName(e.target.value)} disabled={busy} />

            <label className="mmLabel">Sequence (optional)</label>
            <input className="mmInput mmInput--modal" value={gSeq} onChange={(e) => setGSeq(e.target.value)} disabled={busy} />

            <label className="mmLabel">Icon (optional)</label>
            <input className="mmInput mmInput--modal" value={gIcon} onChange={(e) => setGIcon(e.target.value)} disabled={busy} />

            <div className="mmModalActions">
              <button className="mmBtn mmBtn--ghost" onClick={() => !busy && setNewGroupOpen(false)} disabled={busy} type="button">
                Cancel
              </button>
              <button className="mmBtn mmBtn--primary" onClick={createMenuGroup} disabled={busy} type="button">
                {busy ? "Creating…" : "Create menu group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Function Modal */}
      {newFnOpen && (
        <div className="mmModalBackdrop" onMouseDown={() => !busy && setNewFnOpen(false)} role="dialog" aria-modal="true">
          <div className="mmModal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mmModalHead">
              <div>
                <div className="mmKicker">Create</div>
                <h3 className="mmModalTitle">New menu function</h3>
                <div className="mmSub">Example: users_list, role_assign, reports_list…</div>
              </div>
              <button className="mmIconClose" onClick={() => !busy && setNewFnOpen(false)} aria-label="Close modal" type="button">
                ✕
              </button>
            </div>

            <label className="mmLabel">Code</label>
            <input className="mmInput mmInput--modal" value={fCode} onChange={(e) => setFCode(e.target.value)} disabled={busy} />

            <label className="mmLabel">Name</label>
            <input className="mmInput mmInput--modal" value={fName} onChange={(e) => setFName(e.target.value)} disabled={busy} />

            <label className="mmLabel">Type</label>
            <select className="mmSelect" value={fType} onChange={(e) => setFType(e.target.value)} disabled={busy}>
              <option value="M">M (Module / Page)</option>
              <option value="R">R (Report)</option>
              <option value="L">L (Link)</option>
            </select>

            <label className="mmLabel">Path (route)</label>
            <input className="mmInput mmInput--modal" placeholder="/dashboard/users" value={fPath} onChange={(e) => setFPath(e.target.value)} disabled={busy} />

            <label className="mmLabel">Required permission key (optional)</label>
            <input className="mmInput mmInput--modal" placeholder="users.view" value={fPerm} onChange={(e) => setFPerm(e.target.value)} disabled={busy} />

            <div className="mmModalActions">
              <button className="mmBtn mmBtn--ghost" onClick={() => !busy && setNewFnOpen(false)} disabled={busy} type="button">
                Cancel
              </button>
              <button className="mmBtn mmBtn--primary" onClick={createMenuFunction} disabled={busy} type="button">
                {busy ? "Creating…" : "Create function"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
