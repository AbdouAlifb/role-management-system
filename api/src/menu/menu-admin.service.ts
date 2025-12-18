import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateMenuGroupDto } from "./dto/create-menu-group.dto";
import { CreateMenuFunctionDto } from "./dto/create-menu-function.dto";
import { MenuService } from "./menu.service";
import { RbacService } from "../rbac/rbac.service";
@Injectable()
export class MenuAdminService {
  
  
  constructor(
    private prisma: PrismaService,
    private menu: MenuService,
    private rbac: RbacService
  ) {}
  
  

  async createMenuGroup(tenantId: string, dto: CreateMenuGroupDto) {
    try {
      return await this.prisma.menuGroup.create({
        data: {
          tenantId,
          code: dto.code,
          name: dto.name,
          sequence: dto.sequence ?? null,
          icon: dto.icon ?? null,
        },
      });
    } catch (e: any) {
      throw new ConflictException("MenuGroup code already exists for this tenant");
    }
  }
  
async createMenuFunction(tenantId: string, dto: CreateMenuFunctionDto) {
  try {
    const fn = await this.prisma.menuFunction.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        type: dto.type, // ✅ REQUIRED by Prisma schema
        path: dto.path ?? null,
        requiredPermissionKey: dto.requiredPermissionKey ?? null,
      },
    });

    if (fn.requiredPermissionKey) {
      await this.ensurePermissionKeysExist(
        tenantId,
        [fn.requiredPermissionKey],
        "Auto (menu function)"
      );
    }

    return fn;
  } catch {
    throw new ConflictException("Menu function code already exists");
  }
}



async attachFunctionToGroup(
  tenantId: string,
  groupId: string,
  functionId: string,
  sequence?: number,
) {
  const mg = await this.prisma.menuGroup.findFirst({ where: { id: groupId, tenantId } });
  if (!mg) throw new NotFoundException("Menu group not found");

  const fn = await this.prisma.menuFunction.findFirst({ where: { id: functionId, tenantId } });
  if (!fn) throw new NotFoundException("Menu function not found");

  const link = await this.prisma.menuGroupFunction.upsert({
    where: { menuGroupId_menuFunctionId: { menuGroupId: groupId, menuFunctionId: functionId } },
    update: { sequence: sequence ?? null }, // ✅ store/update sequence
    create: { menuGroupId: groupId, menuFunctionId: functionId, sequence: sequence ?? null }, // ✅ store
  });

  // ✅ if the group is already linked to roles, auto-grant this function permission to them
  if (fn.requiredPermissionKey) {
    await this.ensurePermissionKeysExist(tenantId, [fn.requiredPermissionKey], "Auto (menu function attach)");

    const roleLinks = await this.prisma.roleMenuGroup.findMany({
      where: { menuGroupId: groupId, role: { tenantId } },
      select: { roleId: true },
    });

    if (roleLinks.length) {
      const perm = await this.prisma.permission.findUnique({
        where: { tenantId_key: { tenantId, key: fn.requiredPermissionKey } },
        select: { id: true },
      });

      if (perm) {
        await this.prisma.rolePermission.createMany({
          data: roleLinks.map(r => ({ roleId: r.roleId, permissionId: perm.id })),
          skipDuplicates: true,
        });
        await this.bumpRbacVersion(tenantId);
      }
    }
  }

  return link;
}



async attachMenuGroupToRole(tenantId: string, roleId: string, menuGroupId: string) {
  const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw new NotFoundException("Role not found");

  const mg = await this.prisma.menuGroup.findFirst({ where: { id: menuGroupId, tenantId } });
  if (!mg) throw new NotFoundException("Menu group not found");

  const link = await this.prisma.roleMenuGroup.upsert({
    where: { roleId_menuGroupId: { roleId, menuGroupId } },
    update: {},
    create: { roleId, menuGroupId },
  });

  const groupFns = await this.prisma.menuGroupFunction.findMany({
    where: { menuGroupId },
    include: { menuFunction: true },
  });

  const keys = this.uniqKeys(groupFns.map(x => x.menuFunction.requiredPermissionKey));
  const autoGranted = await this.grantPermissionKeysToRole(tenantId, roleId, keys);

  return { link, autoGranted };
}


  async listMenuGroups(tenantId: string) {
    return this.prisma.menuGroup.findMany({
      where: { tenantId },
      orderBy: [{ sequence: "asc" }, { name: "asc" }],
    });
  }

  async listMenuFunctions(tenantId: string) {
    return this.prisma.menuFunction.findMany({
      where: { tenantId },
      orderBy: [{ code: "asc" }],
    });
  }
  async listGroupFunctions(tenantId: string) {
  return this.prisma.menuGroupFunction.findMany({
    where: { menuGroup: { tenantId } },
    include: {
      menuGroup: true,
      menuFunction: true,
    },
    orderBy: [{ menuGroup: { sequence: "asc" } }, { sequence: "asc" }],
  });
}

async listRoleMenuGroups(tenantId: string) {
  return this.prisma.roleMenuGroup.findMany({
    where: { role: { tenantId } },
    include: {
      role: true,
      menuGroup: true,
    },
  });
}
async getUserAccessSummary(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, username: true, email: true, forcePasswordChange: true, createdAt: true },
    });
    if (!user) throw new NotFoundException("User not found");

    // groups
    const userGroups = await this.prisma.userGroup.findMany({
      where: { userId },
      include: { group: true },
    });
    const groups = userGroups.map((ug) => ({ id: ug.group.id, name: ug.group.name, tenantId: ug.group.tenantId }));
    const groupIds = userGroups.map((ug) => ug.groupId);

    // roles (via groupRole)
    const groupRoles = groupIds.length
      ? await this.prisma.groupRole.findMany({
          where: { groupId: { in: groupIds } },
          include: { role: true },
        })
      : [];
    const roleMap = new Map<string, { id: string; name: string; tenantId: string }>();
    for (const gr of groupRoles) roleMap.set(gr.role.id, { id: gr.role.id, name: gr.role.name, tenantId: gr.role.tenantId });
    const roles = [...roleMap.values()].sort((a, b) => a.name.localeCompare(b.name));

    // permissions + menu (reuse your proven logic)
    const permissions = await this.rbac.computeUserPermissions(userId, tenantId);
    const menu = await this.menu.getMenuForUser(tenantId, userId, permissions);

    return { user, groups, roles, permissions, menu };
  }

  private async bumpRbacVersion(tenantId: string) {
  await this.prisma.tenant.update({
    where: { id: tenantId },
    data: { rbacVersion: { increment: 1 } },
  });
}

private uniqKeys(keys: Array<string | null | undefined>) {
  return Array.from(new Set(keys.map(k => (k ?? "").trim()).filter(Boolean)));
}

private async ensurePermissionKeysExist(tenantId: string, keys: string[], prefix = "Auto (menu)") {
  const uniq = this.uniqKeys(keys);
  for (const key of uniq) {
    await this.prisma.permission.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: {},
      create: { tenantId, key, description: `${prefix}: ${key}` },
    });
  }
  return uniq;
}

private async grantPermissionKeysToRole(tenantId: string, roleId: string, keys: string[]) {
  const uniq = await this.ensurePermissionKeysExist(tenantId, keys, "Auto (menu attach)");
  if (uniq.length === 0) return { granted: 0, keys: [] as string[] };

  const perms = await this.prisma.permission.findMany({
    where: { tenantId, key: { in: uniq } },
    select: { id: true, key: true },
  });

  await this.prisma.rolePermission.createMany({
    data: perms.map(p => ({ roleId, permissionId: p.id })),
    skipDuplicates: true,
  });

  await this.bumpRbacVersion(tenantId);

  return { granted: perms.length, keys: perms.map(p => p.key) };
}

}

