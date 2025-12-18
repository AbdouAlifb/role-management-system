import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";

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

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService, private rbac: RbacService) {}

  private hasPerm(perms: string[] | undefined, key: string | null | undefined) {
    if (!key) return true; // no required permission => visible
    if (!perms || perms.length === 0) return false;
    if (perms.includes("*")) return true;
    return perms.includes(key);
  }

async ensureSessionPerms(req: any) {
  const tenantId = req.session?.tenantId;
  const userId = req.session?.userId;
  if (!tenantId || !userId) return [];

  const t = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { rbacVersion: true },
  });
  const v = t?.rbacVersion ?? 0;

  if (!req.session.permissions || req.session.permsVersion !== v) {
    req.session.permissions = await this.rbac.computeUserPermissions(userId, tenantId);
    req.session.permsVersion = v;
  }
  return req.session.permissions;
}


  async getMenuForUser(tenantId: string, userId: string, sessionPerms: string[]) {
    // Super admin shortcut: show all menu groups/functions for tenant
    if (sessionPerms.includes("*")) {
      return this.getAllMenuForTenant(tenantId, sessionPerms);
    }

    // 1) user -> groupIds
    const userGroups = await this.prisma.userGroup.findMany({
      where: { userId },
      select: { groupId: true },
    });
    const groupIds = userGroups.map((g) => g.groupId);
    if (groupIds.length === 0) return [] as MenuGroupOut[];

    // 2) groupIds -> roleIds
    const groupRoles = await this.prisma.groupRole.findMany({
      where: { groupId: { in: groupIds } },
      select: { roleId: true },
    });
    const roleIds = [...new Set(groupRoles.map((r) => r.roleId))];
    if (roleIds.length === 0) return [] as MenuGroupOut[];

    // 3) roleIds -> menuGroupIds
    const roleMenuGroups = await this.prisma.roleMenuGroup.findMany({
      where: { roleId: { in: roleIds } },
      select: { menuGroupId: true },
    });
    const menuGroupIds = [...new Set(roleMenuGroups.map((x) => x.menuGroupId))];
    if (menuGroupIds.length === 0) return [] as MenuGroupOut[];

    // 4) fetch groups + functions (ordered)
    const groups = await this.prisma.menuGroup.findMany({
      where: { tenantId, id: { in: menuGroupIds } },
      orderBy: [{ sequence: "asc" }, { name: "asc" }],
      include: {
        functions: {
          orderBy: [{ sequence: "asc" }],
          include: { menuFunction: true },
        },
      },
    });

    // 5) filter functions by requiredPermissionKey (enhanced)
    const out: MenuGroupOut[] = groups
      .map((g) => {
        const items: MenuItem[] = g.functions
          .map((gf) => ({
            id: gf.menuFunction.id,
            code: gf.menuFunction.code,
            name: gf.menuFunction.name,
            type: gf.menuFunction.type,
            path: gf.menuFunction.path,
            sequence: gf.sequence,
            requiredPermissionKey: gf.menuFunction.requiredPermissionKey,
          }))
          .filter((it) => this.hasPerm(sessionPerms, it.requiredPermissionKey));

        return {
          id: g.id,
          code: g.code,
          name: g.name,
          icon: g.icon,
          sequence: g.sequence,
          items,
        };
      })
      .filter((g) => g.items.length > 0); // hide empty groups

    return out;
  }

  private async getAllMenuForTenant(tenantId: string, sessionPerms: string[]) {
    const groups = await this.prisma.menuGroup.findMany({
      where: { tenantId },
      orderBy: [{ sequence: "asc" }, { name: "asc" }],
      include: {
        functions: {
          orderBy: [{ sequence: "asc" }],
          include: { menuFunction: true },
        },
      },
    });

    return groups.map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      icon: g.icon,
      sequence: g.sequence,
      items: g.functions
        .map((gf) => ({
          id: gf.menuFunction.id,
          code: gf.menuFunction.code,
          name: gf.menuFunction.name,
          type: gf.menuFunction.type,
          path: gf.menuFunction.path,
          sequence: gf.sequence,
          requiredPermissionKey: gf.menuFunction.requiredPermissionKey,
        }))
        .filter((it) => this.hasPerm(sessionPerms, it.requiredPermissionKey)),
    }));
  }
  async listGroupFunctions(tenantId: string) {
  return this.prisma.menuGroupFunction.findMany({
    where: { menuGroup: { tenantId } },
    include: { menuFunction: true },
    orderBy: [{ menuGroupId: "asc" }, { sequence: "asc" }],
  });
}

async listRoleGroups(tenantId: string) {
  return this.prisma.roleMenuGroup.findMany({
    where: { role: { tenantId } },
    orderBy: [{ roleId: "asc" }, { menuGroupId: "asc" }],
  });
}

}
