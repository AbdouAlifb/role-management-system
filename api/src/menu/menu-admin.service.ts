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
      return await this.prisma.menuFunction.create({
        data: {
          tenantId,
          code: dto.code,
          name: dto.name,
          type: dto.type,
          path: dto.path ?? null,
          requiredPermissionKey: dto.requiredPermissionKey ?? null,
        },
      });
    } catch (e: any) {
      throw new ConflictException("MenuFunction code already exists for this tenant");
    }
  }

  async attachFunctionToGroup(tenantId: string, groupId: string, functionId: string, sequence?: number) {
    // ensure tenant match
    const group = await this.prisma.menuGroup.findFirst({ where: { id: groupId, tenantId } });
    if (!group) throw new NotFoundException("MenuGroup not found");

    const fn = await this.prisma.menuFunction.findFirst({ where: { id: functionId, tenantId } });
    if (!fn) throw new NotFoundException("MenuFunction not found");

    return this.prisma.menuGroupFunction.upsert({
      where: { menuGroupId_menuFunctionId: { menuGroupId: groupId, menuFunctionId: functionId } },
      update: { sequence: sequence ?? null },
      create: { menuGroupId: groupId, menuFunctionId: functionId, sequence: sequence ?? null },
    });
  }

  async attachMenuGroupToRole(tenantId: string, roleId: string, menuGroupId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId } });
    if (!role) throw new NotFoundException("Role not found");

    const group = await this.prisma.menuGroup.findFirst({ where: { id: menuGroupId, tenantId } });
    if (!group) throw new NotFoundException("MenuGroup not found");

    return this.prisma.roleMenuGroup.upsert({
      where: { roleId_menuGroupId: { roleId, menuGroupId } },
      update: {},
      create: { roleId, menuGroupId },
    });
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

}

